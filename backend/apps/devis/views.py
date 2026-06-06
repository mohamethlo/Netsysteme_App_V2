from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from .models import Devis, LigneDevis
from .serializers import DevisSerializer
from apps.messaging.utils import notify_user, notify_admins

_TECH_ROLES = ["technicien", "technician", "responsable technique"]


def _nom(u):
    if u is None:
        return ""
    prenom = getattr(u, "prenom", "") or ""
    nom    = getattr(u, "nom",    "") or ""
    return f"{prenom} {nom}".strip() or getattr(u, "username", str(u.id))


def _role(user) -> str:
    return getattr(getattr(user, "role", None), "name", "") or ""


def _is_admin(user) -> bool:
    return user.has_business_permission("all")


def _is_commercial(user) -> bool:
    return _role(user).lower() == "commercial"


def _is_technicien(user) -> bool:
    return _role(user).lower() in _TECH_ROLES


class DevisViewSet(viewsets.ModelViewSet):
    serializer_class   = DevisSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["status"]
    search_fields      = ["nom", "prenom", "telephone", "commentaire"]
    ordering_fields    = ["created_at", "status"]

    def get_queryset(self):
        user = self.request.user
        qs   = Devis.objects.select_related("user", "assigned_to").prefetch_related("lignes").order_by("-created_at")
        if _is_admin(user):
            return qs
        if _is_commercial(user):
            return qs.filter(user=user)
        if _is_technicien(user):
            return qs.filter(assigned_to=user)
        from django.db.models import Q
        return qs.filter(Q(user=user) | Q(assigned_to=user)).distinct()

    def perform_create(self, serializer):
        user = self.request.user
        if not _is_admin(user) and not _is_commercial(user):
            raise PermissionDenied("Seuls les commerciaux peuvent créer des devis.")
        instance = serializer.save(user=user, status="pending")
        client   = f"{instance.prenom or ''} {instance.nom or ''}".strip() or "—"
        notify_admins(
            f"📝 Nouveau devis créé par {_nom(user)} — Client : {client}."
        )

    def perform_update(self, serializer):
        devis = serializer.instance
        user  = self.request.user
        if not _is_admin(user) and devis.user != user:
            raise PermissionDenied("Seul le commercial ayant créé ce devis peut le modifier.")
        if devis.status == "completed":
            raise PermissionDenied("Un devis complété ne peut plus être modifié.")
        serializer.save()

    # ── Stats dashboard ────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        qs = self.get_queryset()
        return Response({
            "total":     qs.count(),
            "pending":   qs.filter(status="pending").count(),
            "assigned":  qs.filter(status="assigned").count(),
            "completed": qs.filter(status="completed").count(),
            "recent":    DevisSerializer(qs.order_by("-created_at")[:5], many=True).data,
        })

    # ── Liste techniciens + RT (pour assignation) ─────────────────────────────
    @action(detail=False, methods=["get"], url_path="technicians")
    def technicians(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        techs = User.objects.filter(
            role__name__in=["Technicien", "Technician", "Responsable Technique"],
            is_active=True,
        ).select_related("role")
        return Response([
            {"id": u.id, "nom": _nom(u), "role": getattr(getattr(u, "role", None), "name", None)}
            for u in techs
        ])

    # ── Assigner un technicien / RT (commercial propriétaire ou admin) ─────────
    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        devis = self.get_object()

        if not _is_admin(request.user):
            if devis.user != request.user:
                return Response({"detail": "Seul le commercial ayant créé ce devis peut l'assigner."}, status=403)

        if devis.status == "completed":
            return Response({"detail": "Impossible de réassigner un devis déjà complété."}, status=400)

        tech_id = request.data.get("technician_id")
        if not tech_id:
            return Response({"detail": "Technicien requis."}, status=400)

        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            tech = User.objects.select_related("role").get(id=int(tech_id))
        except (User.DoesNotExist, ValueError):
            return Response({"detail": "Technicien introuvable."}, status=404)

        if not _is_technicien(tech) and not _is_admin(tech):
            return Response({"detail": "Cet utilisateur n'est pas un technicien ni un responsable technique."}, status=400)

        devis.assigned_to = tech
        devis.status      = "assigned"
        devis.save(update_fields=["assigned_to", "status"])
        client = f"{devis.prenom or ''} {devis.nom or ''}".strip() or "—"
        # Notifier le technicien assigné
        notify_user(
            tech,
            f"📝 Un devis vous a été assigné — Client : {client}. "
            f"Veuillez renseigner les matériels nécessaires.",
        )
        # Notifier les admins
        notify_admins(
            f"👤 Devis #{devis.id} assigné à {_nom(tech)} — Client : {client}."
        )
        return Response(DevisSerializer(devis).data)

    # ── Remplir les matériels (technicien / RT) — sans prix ───────────────────
    @action(detail=True, methods=["post"], url_path="materiels")
    def fill_materiels(self, request, pk=None):
        devis = self.get_object()

        if not _is_admin(request.user) and devis.assigned_to != request.user:
            return Response({"detail": "Seul le technicien assigné peut remplir les matériels."}, status=403)

        if devis.status != "assigned":
            return Response({"detail": "Ce devis n'est pas en statut 'Assigné'."}, status=400)

        lignes_data = request.data.get("lignes", [])
        commentaire = request.data.get("commentaire", "").strip()

        if not lignes_data:
            return Response({"detail": "Au moins une ligne de matériel est requise."}, status=400)

        devis.lignes.all().delete()
        for ligne in lignes_data:
            designation = str(ligne.get("designation", "")).strip()
            if not designation:
                continue
            LigneDevis.objects.create(
                devis=devis,
                designation=designation,
                quantite=max(1, int(ligne.get("quantite", 1))),
                prix_unitaire=None,  # Le commercial fixe les prix après négociation
            )

        if commentaire:
            devis.commentaire = commentaire
        devis.status = "completed"
        devis.save(update_fields=["status", "commentaire"])
        client = f"{devis.prenom or ''} {devis.nom or ''}".strip() or "—"
        msg = (
            f"✅ Devis #{devis.id} complété par {_nom(request.user)} — "
            f"Client : {client}. Les matériels sont prêts pour chiffrage."
        )
        # Notifier le commercial créateur
        if devis.user:
            notify_user(devis.user, msg)
        # Notifier les admins
        notify_admins(msg)
        return Response(DevisSerializer(devis).data)

    # ── Fixer les prix (commercial propriétaire ou admin) ─────────────────────
    @action(detail=True, methods=["post"], url_path="prix")
    def set_prix(self, request, pk=None):
        devis = self.get_object()

        if not _is_admin(request.user) and devis.user != request.user:
            return Response({"detail": "Seul le commercial ayant créé ce devis peut fixer les prix."}, status=403)

        if devis.status != "completed":
            return Response({"detail": "Les prix ne peuvent être fixés que sur un devis complété."}, status=400)

        lignes_data = request.data.get("lignes", [])
        for item in lignes_data:
            try:
                ligne = devis.lignes.get(id=int(item["id"]))
                prix  = item.get("prix_unitaire")
                ligne.prix_unitaire = float(prix) if prix not in (None, "", "0", 0) else None
                ligne.save(update_fields=["prix_unitaire"])
            except (LigneDevis.DoesNotExist, ValueError, KeyError):
                pass

        # Notifier le technicien assigné que les prix ont été fixés
        if devis.assigned_to:
            notify_user(
                devis.assigned_to,
                f"💰 Les prix du devis #{devis.id} ont été fixés par le commercial.",
            )
        return Response(DevisSerializer(devis).data)

    # ── Supprimer (admin uniquement) ──────────────────────────────────────────
    def destroy(self, request, *args, **kwargs):
        if not _is_admin(request.user):
            return Response({"detail": "Permission refusée."}, status=403)
        return super().destroy(request, *args, **kwargs)
