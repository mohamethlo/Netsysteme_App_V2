from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from .models import DepenseTerrain, JustificatifDepense
from .serializers import (
    DepenseTerrainSerializer,
    JustificatifSerializer,
    JustificatifUploadSerializer,
)

MANAGER_ROLES = [
    "Administrateur", "Dev_administration", "administration",
    "Responsable Technique", "responsable_technique",
]


def _can_manage(user) -> bool:
    if user.has_business_permission("all"):
        return True
    role_name = getattr(getattr(user, "role", None), "name", "") or ""
    return role_name in MANAGER_ROLES or user.has_business_permission("depenses_terrain")


class DepenseTerrainViewSet(viewsets.ModelViewSet):
    serializer_class   = DepenseTerrainSerializer
    permission_classes = [IsAuthenticated]
    parser_classes     = [JSONParser, MultiPartParser, FormParser]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["statut", "type_depense", "technicien"]
    search_fields      = ["description", "technicien__prenom", "technicien__nom"]
    ordering_fields    = ["date_depense", "montant", "created_at", "statut"]

    def get_queryset(self):
        qs = DepenseTerrain.objects.select_related(
            "technicien", "chantier"
        ).prefetch_related("justificatifs").order_by("-created_at")
        if not _can_manage(self.request.user):
            qs = qs.filter(technicien=self.request.user)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        role_name = getattr(getattr(user, "role", None), "name", "") or ""
        if not _can_manage(user):
            serializer.save(created_by=user, technicien=user)
        else:
            serializer.save(created_by=user)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not _can_manage(request.user) and instance.technicien != request.user:
            return Response({"detail": "Permission refusée."}, status=403)
        if not _can_manage(request.user) and instance.statut != "en_attente":
            return Response({"detail": "Impossible de modifier une dépense déjà traitée."}, status=400)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if not _can_manage(request.user) and instance.technicien != request.user:
            return Response({"detail": "Permission refusée."}, status=403)
        if instance.statut not in ["en_attente", "refusee"]:
            return Response({"detail": "Impossible de supprimer une dépense approuvée ou remboursée."}, status=400)
        return super().destroy(request, *args, **kwargs)

    # ── Justificatifs ─────────────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="justificatifs",
            parser_classes=[MultiPartParser, FormParser])
    def add_justificatif(self, request, pk=None):
        depense = self.get_object()
        if not _can_manage(request.user) and depense.technicien != request.user:
            return Response({"detail": "Permission refusée."}, status=403)

        serializer = JustificatifUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        fichier = serializer.validated_data["fichier"]
        nom     = serializer.validated_data.get("nom") or fichier.name

        justif = JustificatifDepense.objects.create(
            depense=depense, fichier=fichier, nom=nom,
        )
        return Response(
            JustificatifSerializer(justif, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["delete"],
            url_path=r"justificatifs/(?P<justif_id>\d+)")
    def delete_justificatif(self, request, pk=None, justif_id=None):
        depense = self.get_object()
        if not _can_manage(request.user) and depense.technicien != request.user:
            return Response({"detail": "Permission refusée."}, status=403)

        try:
            justif = depense.justificatifs.get(pk=justif_id)
        except JustificatifDepense.DoesNotExist:
            return Response({"detail": "Justificatif introuvable."}, status=404)

        justif.fichier.delete(save=False)
        justif.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Workflow statut ───────────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="approuver")
    def approuver(self, request, pk=None):
        if not _can_manage(request.user):
            return Response({"detail": "Permission refusée."}, status=403)
        depense = self.get_object()
        if depense.statut != "en_attente":
            return Response({"detail": "Seules les dépenses en attente peuvent être approuvées."}, status=400)
        depense.statut = "approuvee"
        depense.save(update_fields=["statut"])
        return Response(DepenseTerrainSerializer(depense, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="refuser")
    def refuser(self, request, pk=None):
        if not _can_manage(request.user):
            return Response({"detail": "Permission refusée."}, status=403)
        depense = self.get_object()
        notes   = request.data.get("notes_admin", "")
        depense.statut = "refusee"
        if notes:
            depense.notes_admin = notes
        depense.save(update_fields=["statut", "notes_admin"])
        return Response(DepenseTerrainSerializer(depense, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="rembourser")
    def rembourser(self, request, pk=None):
        if not _can_manage(request.user):
            return Response({"detail": "Permission refusée."}, status=403)
        depense = self.get_object()
        if depense.statut != "approuvee":
            return Response({"detail": "Seules les dépenses approuvées peuvent être marquées remboursées."}, status=400)
        depense.statut = "remboursee"
        depense.save(update_fields=["statut"])
        return Response(DepenseTerrainSerializer(depense, context={"request": request}).data)

    # ── Stats ─────────────────────────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        qs = self.get_queryset()
        from django.db.models import Sum
        total_montant = qs.filter(statut__in=["approuvee", "remboursee"]).aggregate(
            total=Sum("montant")
        )["total"] or 0
        return Response({
            "total":       qs.count(),
            "en_attente":  qs.filter(statut="en_attente").count(),
            "approuvees":  qs.filter(statut="approuvee").count(),
            "refusees":    qs.filter(statut="refusee").count(),
            "remboursees": qs.filter(statut="remboursee").count(),
            "montant_total": float(total_montant),
        })
