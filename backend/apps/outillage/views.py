from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import get_user_model

from .models import Outil, ReservationOutil
from .serializers import OutilSerializer, ReservationOutilSerializer, UserMiniSerializer
from apps.messaging.utils import notify_user, notify_rt_and_admins

User = get_user_model()

RT_ROLE_NAMES = ["Responsable Technique", "responsable_technique", "Administrateur", "Administration"]


def _nom(user) -> str:
    if user is None:
        return "—"
    prenom = getattr(user, "prenom", "") or ""
    nom    = getattr(user, "nom",    "") or ""
    return f"{prenom} {nom}".strip() or getattr(user, "username", str(user.pk))


def _can_manage(user) -> bool:
    if user.has_business_permission("all"):
        return True
    role_name = getattr(getattr(user, "role", None), "name", "")
    return role_name in RT_ROLE_NAMES or user.has_business_permission("outillage")


class OutilViewSet(viewsets.ModelViewSet):
    serializer_class   = OutilSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["categorie", "is_active"]
    search_fields      = ["nom", "description", "numero_serie"]
    ordering_fields    = ["nom", "categorie", "created_at"]

    def get_queryset(self):
        return Outil.objects.all()

    def create(self, request, *args, **kwargs):
        if not _can_manage(request.user):
            return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not _can_manage(request.user):
            return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not _can_manage(request.user):
            return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class ReservationOutilViewSet(viewsets.ModelViewSet):
    serializer_class   = ReservationOutilSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["statut", "technicien"]
    search_fields      = ["outil__nom", "notes"]
    ordering_fields    = ["date_debut", "created_at", "statut"]

    def get_queryset(self):
        user = self.request.user
        qs   = ReservationOutil.objects.select_related(
            "outil", "technicien", "chantier"
        ).order_by("-created_at")
        if not _can_manage(user):
            # Technicien voit seulement ses propres réservations
            qs = qs.filter(technicien=user)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        role_name = getattr(getattr(user, "role", None), "name", "")
        if role_name.lower() in ["technicien", "technician"]:
            instance = serializer.save(created_by=user, technicien=user)
        else:
            instance = serializer.save(created_by=user)
        tech_nom  = _nom(instance.technicien)
        outil_nom = instance.outil.nom
        notify_rt_and_admins(
            f"📦 Nouvelle réservation : {tech_nom} demande « {outil_nom} » "
            f"du {instance.date_debut} au {instance.date_fin}."
        )

    # ── Approuver / Refuser une réservation ───────────────────────────────────
    @action(detail=True, methods=["post"], url_path="approuver")
    def approuver(self, request, pk=None):
        if not _can_manage(request.user):
            return Response({"detail": "Permission refusée."}, status=403)
        reservation = self.get_object()
        if reservation.statut not in ["en_attente"]:
            return Response({"detail": "Seules les réservations en attente peuvent être approuvées."}, status=400)
        reservation.statut = "approuvee"
        reservation.save(update_fields=["statut"])
        notify_user(
            reservation.technicien,
            f"✅ Votre réservation de « {reservation.outil.nom} » a été approuvée.",
        )
        return Response(ReservationOutilSerializer(reservation).data)

    @action(detail=True, methods=["post"], url_path="refuser")
    def refuser(self, request, pk=None):
        if not _can_manage(request.user):
            return Response({"detail": "Permission refusée."}, status=403)
        reservation = self.get_object()
        reservation.statut = "refusee"
        reservation.save(update_fields=["statut"])
        notify_user(
            reservation.technicien,
            f"❌ Votre réservation de « {reservation.outil.nom} » a été refusée.",
        )
        return Response(ReservationOutilSerializer(reservation).data)

    @action(detail=True, methods=["post"], url_path="remettre")
    def remettre(self, request, pk=None):
        """RT confirme avoir remis le matériel au technicien."""
        if not _can_manage(request.user):
            return Response({"detail": "Seul un responsable peut enregistrer la remise."}, status=403)
        reservation = self.get_object()
        if reservation.statut != "approuvee":
            return Response({"detail": "La réservation doit être approuvée avant la remise."}, status=400)
        reservation.statut = "remis"
        reservation.save(update_fields=["statut"])
        notify_user(
            reservation.technicien,
            f"🔧 Le matériel « {reservation.outil.nom} » vous a été remis. "
            f"Confirmez la réception dans l'application.",
        )
        return Response(ReservationOutilSerializer(reservation).data)

    @action(detail=True, methods=["post"], url_path="confirmer-reception")
    def confirmer_reception(self, request, pk=None):
        """Technicien confirme avoir bien reçu le matériel."""
        reservation = self.get_object()
        if reservation.technicien != request.user and not _can_manage(request.user):
            return Response({"detail": "Permission refusée."}, status=403)
        if reservation.statut != "remis":
            return Response({"detail": "Le matériel doit d'abord être marqué comme remis par le responsable."}, status=400)
        reservation.statut = "en_cours"
        reservation.save(update_fields=["statut"])
        tech_nom = _nom(reservation.technicien)
        notify_rt_and_admins(
            f"✔️ {tech_nom} a confirmé la réception de « {reservation.outil.nom} ».",
        )
        return Response(ReservationOutilSerializer(reservation).data)

    @action(detail=True, methods=["post"], url_path="retourner")
    def retourner(self, request, pk=None):
        """Technicien déclare avoir retourné l'outil — en attente de confirmation RT."""
        reservation = self.get_object()
        if not _can_manage(request.user) and reservation.technicien != request.user:
            return Response({"detail": "Permission refusée."}, status=403)
        if reservation.statut not in ["en_cours"]:
            return Response({"detail": "Seules les réservations en cours peuvent être déclarées retournées."}, status=400)
        reservation.statut = "retour_declare"
        reservation.save(update_fields=["statut"])
        tech_nom = _nom(reservation.technicien)
        notify_rt_and_admins(
            f"🔄 {tech_nom} déclare avoir retourné « {reservation.outil.nom} ». "
            f"Veuillez confirmer la réception.",
        )
        return Response(ReservationOutilSerializer(reservation).data)

    @action(detail=True, methods=["post"], url_path="confirmer-retour")
    def confirmer_retour(self, request, pk=None):
        """RT confirme la réception effective du matériel."""
        if not _can_manage(request.user):
            return Response({"detail": "Seul un responsable peut confirmer le retour."}, status=403)
        reservation = self.get_object()
        if reservation.statut != "retour_declare":
            return Response({"detail": "Seules les réservations en retour déclaré peuvent être confirmées."}, status=400)
        reservation.statut = "retournee"
        reservation.save(update_fields=["statut"])
        notify_user(
            reservation.technicien,
            f"✅ Le retour de « {reservation.outil.nom} » a été confirmé. Merci !",
        )
        return Response(ReservationOutilSerializer(reservation).data)

    # ── Stats dashboard ───────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        qs = self.get_queryset()
        return Response({
            "total":      qs.count(),
            "en_attente": qs.filter(statut="en_attente").count(),
            "approuvees": qs.filter(statut="approuvee").count(),
            "en_cours":   qs.filter(statut="en_cours").count(),
            "retournees": qs.filter(statut="retournee").count(),
            "refusees":   qs.filter(statut="refusee").count(),
        })
