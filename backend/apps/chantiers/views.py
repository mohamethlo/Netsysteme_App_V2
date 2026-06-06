from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import get_user_model

from .models import Chantier
from .serializers import ChantierSerializer, UserMiniSerializer

User = get_user_model()

RT_ROLE_NAMES = ["Responsable Technique", "responsable_technique", "Administrateur", "Administration"]


def _can_manage(user) -> bool:
    if user.has_business_permission("all"):
        return True
    role_name = getattr(getattr(user, "role", None), "name", "")
    return role_name in RT_ROLE_NAMES or user.has_business_permission("chantiers")


class ChantierViewSet(viewsets.ModelViewSet):
    serializer_class   = ChantierSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["statut"]
    search_fields      = ["nom", "adresse", "description"]
    ordering_fields    = ["date_debut", "created_at", "statut"]

    def get_queryset(self):
        user = self.request.user
        qs   = Chantier.objects.select_related("responsable").prefetch_related("techniciens").order_by("-created_at")
        if not _can_manage(user):
            # Technicien voit seulement les chantiers auxquels il est affecté
            qs = qs.filter(techniciens=user)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        if not _can_manage(request.user):
            return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    # ── Assigner / retirer des techniciens ────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="affecter")
    def affecter(self, request, pk=None):
        if not _can_manage(request.user):
            return Response({"detail": "Permission refusée."}, status=403)
        chantier = self.get_object()
        ids = request.data.get("technicien_ids", [])
        if not isinstance(ids, list):
            return Response({"detail": "technicien_ids doit être une liste."}, status=400)
        techs = User.objects.filter(id__in=ids, is_active=True)
        chantier.techniciens.set(techs)
        return Response(ChantierSerializer(chantier).data)

    # ── Liste techniciens disponibles ─────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="techniciens-disponibles")
    def techniciens_disponibles(self, request):
        techs = User.objects.filter(
            role__name__iexact="technicien", is_active=True
        ).select_related("role")
        return Response(UserMiniSerializer(techs, many=True).data)

    # ── Dashboard stats ───────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        qs = self.get_queryset()
        return Response({
            "total":      qs.count(),
            "en_attente": qs.filter(statut="en_attente").count(),
            "en_cours":   qs.filter(statut="en_cours").count(),
            "termine":    qs.filter(statut="termine").count(),
            "suspendu":   qs.filter(statut="suspendu").count(),
        })
