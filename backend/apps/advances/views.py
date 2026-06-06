from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from .models import SalaryAdvance
from .serializers import SalaryAdvanceSerializer


def _is_admin(user) -> bool:
    return user.has_business_permission("all")


class SalaryAdvanceViewSet(viewsets.ModelViewSet):
    serializer_class   = SalaryAdvanceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["statut"]
    search_fields      = ["motif", "user__prenom", "user__nom"]
    ordering_fields    = ["created_at", "date_demande", "montant"]

    def get_queryset(self):
        user = self.request.user
        qs   = SalaryAdvance.objects.select_related("user", "approved_by")
        if not _is_admin(user):
            qs = qs.filter(user=user)
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        user = self.request.user
        # Si admin et qu'il a spécifié un user_id → utilise cet employé
        # Sinon → la demande est pour l'utilisateur connecté
        target_user_id = self.request.data.get("user_id")
        if _is_admin(user) and target_user_id:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                target_user = User.objects.get(id=int(target_user_id))
                serializer.save(user=target_user, statut="en_attente")
                return
            except (User.DoesNotExist, ValueError):
                pass
        serializer.save(user=user, statut="en_attente")

    def update(self, request, *args, **kwargs):
        if not _is_admin(request.user):
            advance = self.get_object()
            if advance.user != request.user:
                return Response({"detail": "Permission refusée."}, status=403)
            if advance.statut != "en_attente":
                return Response({"detail": "Impossible de modifier une demande traitée."}, status=400)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        advance = self.get_object()
        if not _is_admin(request.user):
            if advance.user != request.user:
                return Response({"detail": "Permission refusée."}, status=403)
            if advance.statut != "en_attente":
                return Response({"detail": "Impossible de supprimer une demande traitée."}, status=400)
        advance.delete()
        return Response(status=204)

    # ── Liste des employés (pour le select admin) ──────────────────────────────
    @action(detail=False, methods=["get"], url_path="employees")
    def employees(self, request):
        if not _is_admin(request.user):
            return Response({"detail": "Permission refusée."}, status=403)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        users = User.objects.filter(is_active=True).select_related("role").order_by("prenom", "nom")
        return Response([
            {
                "id":     u.id,
                "nom":    f"{u.prenom} {u.nom}".strip() or u.username,
                "role":   u.role.name if u.role else None,
                "site":   u.site,
            }
            for u in users
        ])

    # ── Dashboard ──────────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        qs = self.get_queryset()
        en_attente_qs = qs.filter(statut="en_attente")
        approuve_qs   = qs.filter(statut="approuve")
        return Response({
            "total":           qs.count(),
            "en_attente":      en_attente_qs.count(),
            "approuve":        approuve_qs.count(),
            "refuse":          qs.filter(statut="refuse").count(),
            "montant_total":   sum(a.montant for a in approuve_qs),
            "montant_attente": sum(a.montant for a in en_attente_qs),
        })

    # ── Approuver ──────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        if not _is_admin(request.user):
            return Response({"detail": "Permission refusée."}, status=403)
        advance = self.get_object()
        if advance.statut != "en_attente":
            return Response({"detail": "Cette demande a déjà été traitée."}, status=400)
        advance.statut      = "approuve"
        advance.approved_at = timezone.now()
        advance.approved_by = request.user
        advance.notes_admin = request.data.get("notes_admin", "") or None
        advance.save()
        return Response(SalaryAdvanceSerializer(advance).data)

    # ── Refuser ────────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="refuse")
    def refuse(self, request, pk=None):
        if not _is_admin(request.user):
            return Response({"detail": "Permission refusée."}, status=403)
        advance = self.get_object()
        if advance.statut != "en_attente":
            return Response({"detail": "Cette demande a déjà été traitée."}, status=400)
        advance.statut      = "refuse"
        advance.approved_at = timezone.now()
        advance.approved_by = request.user
        advance.notes_admin = request.data.get("notes_admin", "") or None
        advance.save()
        return Response(SalaryAdvanceSerializer(advance).data)