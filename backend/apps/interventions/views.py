import datetime
import io
import base64

from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from .models import Intervention, InterventionMaterial
from .serializers import InterventionSerializer, InterventionWriteSerializer
from apps.messaging.utils import notify_user, notify_admins, notify_rt_and_admins


def _user_nom(u) -> str:
    if u is None:
        return ""
    prenom = getattr(u, "prenom", "") or ""
    nom    = getattr(u, "nom",    "") or ""
    return f"{prenom} {nom}".strip() or getattr(u, "username", str(u.id))


COMMERCIAL_ROLES = ["commercial", "Commercial"]
RT_ROLES         = ["Responsable Technique", "responsable_technique"]
ADMIN_ROLES      = ["Administrateur", "Dev_administration", "administration"]


def _role(user) -> str:
    return getattr(getattr(user, "role", None), "name", "") or ""


def _is_admin(user) -> bool:
    return user.has_business_permission("all") or _role(user) in ADMIN_ROLES


def _is_commercial(user) -> bool:
    return _role(user) in COMMERCIAL_ROLES


def _is_rt(user) -> bool:
    return _role(user) in RT_ROLES


def _can_create(user) -> bool:
    return _is_admin(user) or _is_commercial(user)


class InterventionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["statut", "priorite", "type_intervention", "technicien"]
    search_fields      = [
        "titre", "description",
        "client__nom", "client__prenom", "client__entreprise",
        "client_libre_nom",
        "technicien__prenom", "technicien__nom",
    ]
    ordering_fields    = ["date_prevue", "created_at", "statut", "priorite"]

    def get_queryset(self):
        user = self.request.user
        qs   = (
            Intervention.objects
            .select_related("client", "technicien", "created_by", "responsable")
            .prefetch_related("autres_intervenants", "materiels__article")
            .order_by("-created_at")
        )

        if not _is_admin(user):
            if _is_commercial(user):
                qs = qs.filter(created_by=user)
            elif _is_rt(user):
                qs = qs.filter(responsable=user)
            else:
                # Technicien simple : uniquement ses propres interventions
                qs = qs.filter(
                    Q(technicien=user) | Q(autres_intervenants=user)
                ).distinct()

        date_filter = self.request.query_params.get("date")
        if date_filter == "today":
            qs = qs.filter(date_prevue__date=timezone.now().date())
        elif date_filter == "week":
            qs = qs.filter(date_prevue__gte=timezone.now() - datetime.timedelta(days=7))
        elif date_filter == "month":
            now = timezone.now()
            qs = qs.filter(date_prevue__year=now.year, date_prevue__month=now.month)

        period = self.request.query_params.get("period")
        if period == "today":
            qs = qs.filter(date_prevue__date=timezone.now().date())
        elif period == "week":
            qs = qs.filter(date_prevue__gte=timezone.now() - datetime.timedelta(days=7))
        elif period == "month":
            now = timezone.now()
            qs = qs.filter(date_prevue__year=now.year, date_prevue__month=now.month)

        return qs

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return InterventionWriteSerializer
        return InterventionSerializer

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "request": self.request}

    

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        if not _can_create(request.user):
            return Response(
                {"detail": "Seuls les commerciaux peuvent créer des interventions."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        self.perform_create(serializer)
        inv      = serializer.instance
        client   = inv.client_nom if hasattr(inv, "client_nom") else (
            f"{inv.client.nom or ''} {inv.client.prenom or ''}".strip() if inv.client else inv.client_libre_nom or "—"
        )
        msg = f"📋 Nouvelle intervention créée — Client : {client or '—'}, Type : {inv.type_intervention or '—'}."
        # Notifier le RT assigné s'il existe
        if inv.responsable:
            notify_user(
                inv.responsable,
                f"📋 Une nouvelle intervention vous a été assignée — "
                f"Client : {client or '—'}, Type : {inv.type_intervention or '—'}.",
            )
        # Notifier les admins
        notify_admins(msg)
        return Response(
            InterventionSerializer(inv, context={"request": request}).data,
            status=201,
        )

    def update(self, request, *args, **kwargs):
        intervention = self.get_object()
        user = request.user
        # Techniciens simples ne peuvent pas modifier
        if not _is_admin(user) and not _is_commercial(user) and not _is_rt(user):
            return Response({"detail": "Permission refusée."}, status=403)
        # RT peut uniquement modifier ses propres interventions
        if _is_rt(user) and intervention.responsable != user:
            return Response({"detail": "Vous n'êtes pas le responsable de cette intervention."}, status=403)
        return super().update(request, *args, **kwargs)

    # ── Dashboard ──────────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        qs    = self.get_queryset()
        today = timezone.now().date()
        now   = timezone.now()
        return Response({
            "total":         qs.count(),
            "planifiees":    qs.filter(statut="planifiee").count(),
            "en_cours":      qs.filter(statut="en_cours").count(),
            "terminees":     qs.filter(statut="terminee").count(),
            "annulees":      qs.filter(statut="annulee").count(),
            "aujourd_hui":   qs.filter(date_prevue__date=today).count(),
            "cette_semaine": qs.filter(date_prevue__gte=now - datetime.timedelta(days=7)).count(),
            "urgentes":      qs.filter(priorite="urgente", statut__in=["planifiee", "en_cours"]).count(),
            "recent":        InterventionSerializer(
                qs.order_by("-created_at")[:5], many=True,
                context={"request": request}
            ).data,
        })

    # ── Changer le statut ──────────────────────────────────────────────────────
    @action(detail=True, methods=["patch"], url_path="change-status")
    def change_status(self, request, pk=None):
        intervention = self.get_object()
        user         = request.user
        if _is_commercial(user):
            return Response(
                {"detail": "Les commerciaux ne peuvent pas changer le statut d'une intervention."},
                status=status.HTTP_403_FORBIDDEN,
            )
        new_status   = request.data.get("statut")
        valid        = ["planifiee", "en_cours", "terminee", "annulee"]
        if new_status not in valid:
            return Response(
                {"detail": f"Statut invalide. Acceptés : {', '.join(valid)}"},
                status=400,
            )
        intervention.statut = new_status
        if new_status == "en_cours" and not intervention.heure_arrivee:
            intervention.heure_arrivee = timezone.now().time()
        if new_status == "terminee":
            intervention.date_realisation = timezone.now()
            if not intervention.heure_depart:
                intervention.heure_depart = timezone.now().time()
            if intervention.heure_arrivee and intervention.heure_depart:
                import datetime as dt
                arrivee = dt.datetime.combine(dt.date.today(), intervention.heure_arrivee)
                depart  = dt.datetime.combine(dt.date.today(), intervention.heure_depart)
                if depart < arrivee:
                    depart += dt.timedelta(days=1)
                duree = depart - arrivee
                intervention.duree_intervention = (dt.datetime.min + duree).time()
            # Sauvegarder la signature du représentant si fournie
            signature_data = request.data.get("signature_data")
            if signature_data:
                intervention.signature_data = signature_data
        intervention.save()

        # ── Notifications changement de statut ────────────────────────────────
        STATUT_LABELS = {
            "planifiee": "Planifiée", "en_cours": "En cours",
            "terminee":  "Terminée",  "annulee":  "Annulée",
        }
        label   = STATUT_LABELS.get(new_status, new_status)
        titre   = intervention.type_intervention or f"#{intervention.id}"
        msg_rt  = f"📌 Intervention {titre} — statut passé à « {label} »."
        msg_tec = f"📌 Votre intervention {titre} est maintenant « {label} »."

        if new_status == "en_cours":
            # Technicien démarre → notifier RT + admins
            notify_rt_and_admins(msg_rt)
        elif new_status == "terminee":
            # Terminée → notifier RT + admins + commercial créateur
            notify_rt_and_admins(msg_rt)
            if intervention.created_by:
                notify_user(intervention.created_by, f"✅ Intervention {titre} terminée.")
        elif new_status == "annulee":
            # Annulée → notifier tous les concernés
            notify_rt_and_admins(msg_rt)
            if intervention.technicien:
                notify_user(intervention.technicien, msg_tec)
            if intervention.created_by:
                notify_user(intervention.created_by, f"❌ Intervention {titre} annulée.")
        elif new_status == "planifiee":
            # Replanifiée → notifier technicien + RT
            if intervention.technicien:
                notify_user(intervention.technicien, msg_tec)
            notify_rt_and_admins(msg_rt)

        return Response(
            InterventionSerializer(intervention, context={"request": request}).data
        )

    # ── Techniciens ────────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="technicians")
    def technicians(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()

        try:
            techs = User.objects.filter(
                role__name__in=["Technicien", "Administrateur", "Administration"]
            ).select_related("role")
        except Exception:
            techs = User.objects.filter(is_active=True)

        return Response([
            {"id": u.id, "nom": _user_nom(u)}
            for u in techs
        ])

    # ── Liste des Responsables Techniques ─────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="responsables")
    def responsables(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        rts = User.objects.filter(
            role__name__in=RT_ROLES
        ).select_related("role")
        return Response([
            {"id": u.id, "nom": _user_nom(u)}
            for u in rts
        ])

    # ── Assigner un technicien (action RT) ────────────────────────────────────
    @action(detail=True, methods=["patch"], url_path="assigner-technicien")
    def assigner_technicien(self, request, pk=None):
        intervention = self.get_object()
        user = request.user
        if not _is_admin(user) and not _is_rt(user):
            return Response({"detail": "Seuls les RT peuvent assigner un technicien."}, status=403)
        if _is_rt(user) and intervention.responsable != user:
            return Response({"detail": "Vous n'êtes pas le responsable de cette intervention."}, status=403)
        technicien_id = request.data.get("technicien")
        if not technicien_id:
            return Response({"detail": "technicien est requis."}, status=400)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            tech = User.objects.get(pk=technicien_id)
        except User.DoesNotExist:
            return Response({"detail": "Technicien introuvable."}, status=404)
        intervention.technicien = tech
        intervention.save()
        # Notifier le technicien assigné
        notify_user(
            tech,
            f"🔧 Vous avez été assigné à une intervention — "
            f"Type : {intervention.type_intervention or '—'}, "
            f"Date prévue : {intervention.date_prevue.strftime('%d/%m/%Y') if intervention.date_prevue else '—'}.",
        )
        # Notifier les admins
        notify_admins(
            f"👤 {_user_nom(tech)} assigné à l'intervention #{intervention.id} "
            f"({intervention.type_intervention or '—'})."
        )
        return Response(
            InterventionSerializer(intervention, context={"request": request}).data
        )

    # ── Export PDF ────────────────────────────────────────────────────────────
    # @action(detail=True, methods=["get"], url_path="pdf")
    # def export_pdf(self, request, pk=None):
    #     intervention = self.get_object()
    #     try:
    #         from fpdf import FPDF
    #         from io import BytesIO

    #         pdf = FPDF()
    #         pdf.add_page()
    #         pdf.set_auto_page_break(auto=True, margin=20)

    #         pdf.set_font("Arial", "B", 12)
    #         pdf.cell(0, 8, "FICHE D'INTERVENTION", ln=True, align="C")
    #         pdf.set_font("Arial", "", 10)
    #         pdf.cell(0, 6, "NETSYSTEME INFORMATIQUE & TELECOM", ln=True, align="C")
    #         pdf.ln(4)

    #         pdf.set_font("Arial", "B", 10)
    #         pdf.cell(0, 6, f"Intervention #{intervention.id}", ln=True)
    #         pdf.set_font("Arial", "", 10)

    #         client_nom = ""
    #         if intervention.client:
    #             client_nom = f"{intervention.client.nom or ''} {intervention.client.prenom or ''}".strip()
    #             if intervention.client.entreprise:
    #                 client_nom += f" ({intervention.client.entreprise})"
    #         elif intervention.client_libre_nom:
    #             client_nom = f"{intervention.client_libre_nom} (non enregistré)"
    #         pdf.cell(0, 6, f"Client     : {client_nom or '—'}", ln=True)
    #         pdf.cell(0, 6, f"Technicien : {_user_nom(intervention.technicien) or '—'}", ln=True)
    #         pdf.cell(0, 6, f"Date prévue: {intervention.date_prevue.strftime('%d/%m/%Y %H:%M') if intervention.date_prevue else '—'}", ln=True)
    #         pdf.cell(0, 6, f"Type       : {intervention.type_intervention or '—'}", ln=True)
    #         pdf.cell(0, 6, f"Statut     : {intervention.get_statut_display()}", ln=True)
    #         pdf.ln(3)

    #         pdf.set_font("Arial", "B", 10)
    #         pdf.cell(0, 6, "Description :", ln=True)
    #         pdf.set_font("Arial", "", 10)
    #         pdf.multi_cell(0, 6, intervention.description or "—")
    #         pdf.ln(3)

    #         pdf.set_font("Arial", "B", 10)
    #         pdf.cell(0, 6, "Observations technicien :", ln=True)
    #         pdf.set_font("Arial", "", 10)
    #         pdf.multi_cell(0, 6, intervention.observations_technicien or "—")
    #         pdf.ln(3)

    #         pdf.cell(0, 6, f"Heure d'arrivée : {intervention.heure_arrivee.strftime('%H:%M') if intervention.heure_arrivee else '—'}", ln=True)
    #         pdf.cell(0, 6, f"Heure de départ : {intervention.heure_depart.strftime('%H:%M') if intervention.heure_depart else '—'}", ln=True)
    #         pdf.cell(0, 6, f"Durée           : {intervention.duree_intervention.strftime('%H:%M') if intervention.duree_intervention else '—'}", ln=True)
    #         pdf.ln(3)

    #         if intervention.id_dvr_nvr:
    #             pdf.cell(0, 6, f"ID DVR/NVR  : {intervention.id_dvr_nvr}", ln=True)
    #         if intervention.mdp_dvr_nvr:
    #             pdf.cell(0, 6, f"MDP DVR/NVR : {intervention.mdp_dvr_nvr}", ln=True)
    #         pdf.ln(5)

    #         if intervention.signature_data:
    #             try:
    #                 sig_data  = intervention.signature_data.split(",")[1]
    #                 sig_bytes = BytesIO(base64.b64decode(sig_data))
    #                 pdf.image(sig_bytes, x=10, y=pdf.get_y(), w=60)
    #                 pdf.ln(25)
    #             except Exception:
    #                 pdf.cell(0, 6, "Signature : non disponible", ln=True)
    #         else:
    #             pdf.cell(0, 6, "Signature : _____________________", ln=True)

    #         pdf.set_y(-25)
    #         pdf.set_font("Arial", "", 8)
    #         pdf.cell(0, 4, "Whatsapp: 77 846 16 55 / Bureau: 33 883 42 42", ln=True, align="C")
    #         pdf.cell(0, 4, "Ouest foire, route aéroport, immeuble Seigneurie", ln=True, align="C")
    #         pdf.cell(0, 4, "www.netsys-info.com", ln=True, align="C")

    #         pdf_bytes = pdf.output(dest="S").encode("latin1")
    #         response  = HttpResponse(pdf_bytes, content_type="application/pdf")
    #         response["Content-Disposition"] = f'inline; filename="fiche_intervention_{intervention.id}.pdf"'
    #         return response

    #     except ImportError:
    #         return Response({"detail": "fpdf2 non installé. Exécutez : pip install fpdf2"}, status=500)
    #     except Exception as e:
    #         return Response({"detail": f"Erreur PDF : {str(e)}"}, status=500)