# ─────────────────────────────────────────────────────────────────────────────
#  apps/users/views.py
# ─────────────────────────────────────────────────────────────────────────────
from django.contrib.auth import get_user_model
from django.db.models import Count, Case, When
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend

from .models import Role
from .permissions import IsAdminUser
from .serializers import (
    RoleSerializer, RoleWriteSerializer,
    UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    ProfileUpdateSerializer, ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    AVAILABLE_PERMISSIONS,
)

User = get_user_model()


# ─────────────────────────────────────────────────────────────────────────────
#  Auth
# ─────────────────────────────────────────────────────────────────────────────
class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]


class LogoutView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh = RefreshToken(request.data.get("refresh"))
            refresh.blacklist()
        except Exception:
            pass
        return Response({"detail": "Déconnexion réussie."})


# ─────────────────────────────────────────────────────────────────────────────
#  Profil utilisateur connecté
# ─────────────────────────────────────────────────────────────────────────────
class MeView(generics.RetrieveAPIView):
    serializer_class   = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class ProfileUpdateView(generics.UpdateAPIView):
    serializer_class   = ProfileUpdateSerializer
    permission_classes = [IsAuthenticated]
    http_method_names  = ["patch"]

    def get_object(self):
        return self.request.user


class ChangePasswordView(generics.GenericAPIView):
    serializer_class   = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Mot de passe modifié avec succès."})


# ─────────────────────────────────────────────────────────────────────────────
#  Rôles  (admin only)
# ─────────────────────────────────────────────────────────────────────────────
class RoleViewSet(viewsets.ModelViewSet):
    """
    GET    /api/auth/roles/           → liste (sans pagination)
    POST   /api/auth/roles/           → créer
    GET    /api/auth/roles/{id}/      → détail
    PATCH  /api/auth/roles/{id}/      → modifier
    DELETE /api/auth/roles/{id}/      → supprimer (si aucun utilisateur lié)
    """
    queryset           = Role.objects.all().order_by("name")
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends    = [SearchFilter]
    search_fields      = ["name"]
    pagination_class   = None  # Toujours retourner la liste complète

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return RoleWriteSerializer
        return RoleSerializer

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.users.exists():
            return Response(
                {"detail": f"Impossible de supprimer : {role.users.count()} utilisateur(s) utilisent ce rôle."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        role.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
#  Utilisateurs  (admin only)
# ─────────────────────────────────────────────────────────────────────────────
class UserViewSet(viewsets.ModelViewSet):
    """
    GET    /api/auth/users/                     → liste paginée
    POST   /api/auth/users/                     → créer
    GET    /api/auth/users/{id}/                → détail
    PATCH  /api/auth/users/{id}/                → modifier
    DELETE /api/auth/users/{id}/                → supprimer (inactifs seulement)
    GET    /api/auth/users/stats/               → compteurs
    GET    /api/auth/users/available-permissions/ → liste des permissions
    POST   /api/auth/users/{id}/toggle-active/  → activer/désactiver
    POST   /api/auth/users/{id}/reset-password/ → réinitialiser le mot de passe
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["is_active"]
    search_fields      = ["nom", "prenom", "username", "email", "telephone"]
    ordering_fields    = ["nom", "prenom", "created_at", "last_login"]

    def get_queryset(self):
        qs = User.objects.select_related("role").order_by("nom", "prenom")
        # Le frontend envoie ?role__name__iexact=<nom> ou ?role=<id>
        role_name = self.request.query_params.get("role__name__iexact")
        role_id   = self.request.query_params.get("role")
        if role_name:
            qs = qs.filter(role__name__iexact=role_name)
        elif role_id:
            try:
                qs = qs.filter(role_id=int(role_id))
            except (ValueError, TypeError):
                qs = qs.filter(role__name__iexact=role_id)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ["update", "partial_update"]:
            return UserUpdateSerializer
        return UserSerializer

    # ── Suppression protégée (inactifs seulement) ──────────────────────────────
    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user == request.user:
            return Response(
                {"detail": "Vous ne pouvez pas supprimer votre propre compte."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.is_active:
            return Response(
                {"detail": "Désactivez l'utilisateur avant de le supprimer."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Stats ──────────────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        agg = User.objects.aggregate(
            total=Count("id"),
            actifs=Count(Case(When(is_active=True, then=1))),
            inactifs=Count(Case(When(is_active=False, then=1))),
            administrateurs=Count(Case(When(role__name__iexact="administrateur", then=1))),
            commerciaux=Count(Case(When(role__name__iexact="commercial", then=1))),
            techniciens=Count(Case(When(role__name__iexact="technicien", then=1))),
        )
        return Response(agg)

    # ── Liste permissions disponibles ─────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="available-permissions")
    def available_permissions(self, request):
        return Response(AVAILABLE_PERMISSIONS)

    # ── Toggle actif/inactif ──────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="toggle-active")
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        if user == request.user:
            return Response(
                {"detail": "Vous ne pouvez pas vous désactiver vous-même."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_active = not user.is_active
        user.save(update_fields=["is_active"])
        return Response(UserSerializer(user).data)

    # ── Liste complète pour envoi SMS (notes de service) ─────────────────────
    @action(detail=False, methods=["get"], url_path="all-for-sms")
    def all_for_sms(self, request):
        """Retourne tous les employés actifs (sans pagination) pour l'envoi groupé de SMS."""
        role_id = request.query_params.get("role")
        qs = User.objects.select_related("role").filter(is_active=True).order_by("nom", "prenom")
        if role_id:
            qs = qs.filter(role__id=role_id)
        return Response(UserSerializer(qs, many=True).data)

    # ── Réinitialisation du mot de passe ──────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        user     = self.get_object()
        password = request.data.get("password", "").strip()
        if len(password) < 6:
            return Response(
                {"detail": "Le mot de passe doit contenir au moins 6 caractères."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(password)
        user.save(update_fields=["password"])
        return Response({"detail": f"Mot de passe de {user.prenom} réinitialisé avec succès."})