# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/views_clients.py
#  ViewSet dédié aux BillingClients — séparé du reste de la facturation
# ─────────────────────────────────────────────────────────────────────────────
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from .models import BillingClient
from .serializers import BillingClientSerializer


class BillingClientViewSet(viewsets.ModelViewSet):
    """
    Endpoints :
      GET    /api/billing-clients/              → liste paginée
      POST   /api/billing-clients/              → créer
      GET    /api/billing-clients/{id}/         → détail
      PATCH  /api/billing-clients/{id}/         → modifier
      DELETE /api/billing-clients/{id}/         → supprimer (si aucune facture/proforma)
      GET    /api/billing-clients/select/       → liste simplifiée pour <select>
      GET    /api/billing-clients/stats/        → statistiques globales
    """
    queryset           = BillingClient.objects.all().order_by("company_name")
    serializer_class   = BillingClientSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields      = ["company_name", "contact_name", "email", "phone", "tax_id"]
    ordering_fields    = ["company_name", "contact_name", "created_at"]

    # ── Suppression protégée ──────────────────────────────────────────────────
    def destroy(self, request, *args, **kwargs):
        client = self.get_object()
        if not client.can_delete():
            return Response(
                {"detail": "Impossible de supprimer ce client : il a des factures ou proformas associés."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        client.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Liste simplifiée pour les <select> ────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="select")
    def select(self, request):
        """
        GET /api/billing-clients/select/
        Retourne une liste légère pour alimenter les dropdowns
        des formulaires de factures/proformas.
        """
        qs = BillingClient.objects.all().order_by("-created_at")
        return Response([{
            "id":    c.id,
            "text":  c.display_name,
            "phone": c.phone,
        } for c in qs])

    # ── Stats ─────────────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """
        GET /api/billing-clients/stats/
        Retourne des compteurs agrégés.
        """
        qs = BillingClient.objects.all()
        return Response({
            "total":        qs.count(),
            "with_company": qs.exclude(company_name__isnull=True).exclude(company_name__exact="").count(),
            "with_email":   qs.exclude(email__isnull=True).exclude(email__exact="").count(),
            "with_tax_id":  qs.exclude(tax_id__isnull=True).exclude(tax_id__exact="").count(),
        })