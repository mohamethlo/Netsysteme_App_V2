# ─────────────────────────────────────────────────────────────────────────────
#  apps/expenses/views.py
# ─────────────────────────────────────────────────────────────────────────────
import os
import datetime
from django.conf import settings
from django.db.models import Sum, Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from .models import Expense, Approvisionnement, CATEGORIES
from .serializers import ExpenseSerializer, ApprovisionnementSerializer


def _is_admin(user):
    return user.has_business_permission("all") or (
        hasattr(user, "role") and user.role and user.role.name in ("Administrateur", "Dev_administration")
    )

def _is_admin_site(user):
    return hasattr(user, "role") and user.role and user.role.name.lower() == "administration"

def _user_site(user):
    return getattr(user, "site", None)


# ── Approvisionnement ─────────────────────────────────────────────────────────
class ApprovisionnementViewSet(viewsets.ModelViewSet):
    serializer_class   = ApprovisionnementSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, OrderingFilter]
    filterset_fields   = ["site"]
    ordering_fields    = ["date", "montant"]

    def get_queryset(self):
        if _is_admin(self.request.user):
            return Approvisionnement.objects.all()
        site = _user_site(self.request.user)
        return Approvisionnement.objects.filter(site=site) if site else Approvisionnement.objects.none()

    def perform_create(self, serializer):
        if not _is_admin(self.request.user):
            raise PermissionError("Seul l'administrateur peut approvisionner.")
        serializer.save(created_by=self.request.user)

    # GET /api/expenses/appros/history/?site=Dakar
    @action(detail=False, methods=["get"], url_path="history")
    def history(self, request):
        qs = self.get_queryset()
        site = request.query_params.get("site")
        if site:
            qs = qs.filter(site=site)
        return Response(ApprovisionnementSerializer(qs, many=True, context={"request": request}).data)


# ── Expense ───────────────────────────────────────────────────────────────────
class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class   = ExpenseSerializer
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["statut", "site", "categorie"]
    search_fields      = ["titre", "description", "user__prenom", "user__nom"]
    ordering_fields    = ["date_depense", "montant", "created_at"]

    def get_queryset(self):
        user = self.request.user
        qs   = Expense.objects.select_related("user", "approved_by").filter(deleted_at__isnull=True)

        # Filtre mois
        month = self.request.query_params.get("month")
        if month:
            try:
                qs = qs.filter(date_depense__month=int(month))
            except ValueError:
                pass

        # Filtre année
        year = self.request.query_params.get("year")
        if year:
            try:
                qs = qs.filter(date_depense__year=int(year))
            except ValueError:
                pass

        if _is_admin(user):
            return qs
        if _is_admin_site(user):
            site = _user_site(user)
            return qs.filter(site=site) if site else qs.none()
        return qs.filter(user=user)

    def perform_create(self, serializer):
        user = self.request.user
        site = self.request.data.get("site") or _user_site(user)

        # Gestion fichier justificatif
        justificatif = None
        fichier = self.request.FILES.get("facture") or self.request.FILES.get("justificatif")
        if fichier:
            upload_dir = os.path.join(settings.MEDIA_ROOT, "uploads", "factures")
            os.makedirs(upload_dir, exist_ok=True)
            filepath = os.path.join(upload_dir, fichier.name)
            with open(filepath, "wb") as f:
                for chunk in fichier.chunks():
                    f.write(chunk)
            justificatif = f"uploads/factures/{fichier.name}"

        # Statut auto-approuvé pour admin
        statut = "approuve" if _is_admin(user) or _is_admin_site(user) else "en_attente"

        serializer.save(
            user=user, site=site,
            justificatif=justificatif,
            statut=statut,
        )

    # ── Approuver ─────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        if not _is_admin(request.user):
            return Response({"detail": "Accès refusé."}, status=status.HTTP_403_FORBIDDEN)
        expense = self.get_object()
        expense.statut      = "approuve"
        expense.approved_by = request.user
        expense.approved_at = timezone.now()
        expense.save(update_fields=["statut", "approved_by", "approved_at"])
        return Response(ExpenseSerializer(expense, context={"request": request}).data)

    # ── Rejeter ───────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        if not _is_admin(request.user):
            return Response({"detail": "Accès refusé."}, status=status.HTTP_403_FORBIDDEN)
        expense = self.get_object()
        notes   = request.data.get("notes_admin", "")
        expense.statut      = "rejete"
        expense.notes_admin = notes
        expense.approved_by = request.user
        expense.approved_at = timezone.now()
        expense.save(update_fields=["statut", "notes_admin", "approved_by", "approved_at"])
        return Response(ExpenseSerializer(expense, context={"request": request}).data)

    # ── Soft delete (corbeille) ───────────────────────────────────────────────
    def destroy(self, request, *args, **kwargs):
        expense = self.get_object()
        expense.deleted_at = timezone.now()
        expense.save(update_fields=["deleted_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Corbeille ─────────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="trash")
    def trash(self, request):
        user = request.user
        qs   = Expense.objects.select_related("user").filter(deleted_at__isnull=False).order_by("-deleted_at")
        if _is_admin(user):
            pass
        elif _is_admin_site(user):
            qs = qs.filter(site=_user_site(user))
        else:
            qs = qs.filter(user=user)
        return Response(ExpenseSerializer(qs, many=True, context={"request": request}).data)

    # ── Restaurer ─────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, pk=None):
        expense = Expense.objects.filter(deleted_at__isnull=False, pk=pk).first()
        if not expense:
            return Response({"detail": "Dépense introuvable dans la corbeille."}, status=404)
        if not _is_admin(request.user) and expense.user != request.user:
            return Response({"detail": "Accès refusé."}, status=403)
        expense.deleted_at = None
        expense.save(update_fields=["deleted_at"])
        return Response({"success": True, "message": "Dépense restaurée."})

    # ── Suppression définitive ────────────────────────────────────────────────
    @action(detail=True, methods=["delete"], url_path="force-delete")
    def force_delete(self, request, pk=None):
        expense = Expense.objects.filter(pk=pk).first()
        if not expense:
            return Response({"detail": "Introuvable."}, status=404)
        if not _is_admin(request.user) and expense.user != request.user:
            return Response({"detail": "Accès refusé."}, status=403)
        expense.delete()
        return Response({"success": True, "message": "Dépense supprimée définitivement."})

    # ── Dashboard par site ────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        """
        Retourne KPIs + données graphiques pour un site donné.
        ?site=Dakar&month=3
        """
        site  = request.query_params.get("site")
        month = request.query_params.get("month")
        year  = request.query_params.get("year")

        if not site:
            # Admin : stats des deux sites
            if _is_admin(request.user):
                result = []
                for s in ["Dakar", "Mbour"]:
                    result.append(self._site_stats(s, month, year))
                return Response(result)
            site = _user_site(request.user)

        if not site:
            return Response({"detail": "Site requis."}, status=400)

        return Response(self._site_stats(site, month, year))

    def _site_stats(self, site: str, month=None, year=None):
        from datetime import date as _date
        current_year = _date.today().year

        # Filtre de base
        exp_qs = Expense.objects.filter(site=site, deleted_at__isnull=True, statut="approuve")
        app_qs = Approvisionnement.objects.filter(site=site)

        # Filtre année
        y = None
        if year:
            try:
                y = int(year)
                exp_qs = exp_qs.filter(date_depense__year=y)
                app_qs = app_qs.filter(date__year=y)
            except ValueError:
                pass

        if month:
            try:
                m = int(month)
                exp_qs = exp_qs.filter(date_depense__month=m)
                app_qs = app_qs.filter(date__month=m)
            except ValueError:
                pass

        total_appro    = app_qs.aggregate(t=Sum("montant"))["t"] or 0
        total_depenses = exp_qs.aggregate(t=Sum("montant"))["t"] or 0
        restant        = total_appro - total_depenses
        benefice       = restant if restant > 0 else 0
        pertes         = abs(restant) if restant < 0 else 0

        # Données mensuelles (12 mois) — filtrées par année si précisée
        chart_year     = y or current_year
        appro_mensuel    = []
        depenses_mensuel = []
        for m in range(1, 13):
            a = Approvisionnement.objects.filter(site=site, date__year=chart_year, date__month=m).aggregate(t=Sum("montant"))["t"] or 0
            d = Expense.objects.filter(site=site, deleted_at__isnull=True, statut="approuve", date_depense__year=chart_year, date_depense__month=m).aggregate(t=Sum("montant"))["t"] or 0
            appro_mensuel.append(float(a))
            depenses_mensuel.append(float(d))

        # Catégories disponibles
        categories = list(
            Expense.objects.filter(site=site, deleted_at__isnull=True)
            .values_list("categorie", flat=True).distinct()
        )

        return {
            "site":             site,
            "total_appro":      round(total_appro,    2),
            "total_depenses":   round(total_depenses, 2),
            "montant_restant":  round(restant,         2),
            "benefice":         round(benefice,        2),
            "pertes":           round(pertes,          2),
            "appro_mensuel":    appro_mensuel,
            "depenses_mensuel": depenses_mensuel,
            "categories":       [c for c in categories if c],
        }

    # ── Catégories disponibles ────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="categories")
    def categories(self, request):
        return Response([{"value": k, "label": v} for k, v in CATEGORIES])