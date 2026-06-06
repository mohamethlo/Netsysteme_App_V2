# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/urls_invoices.py
# ─────────────────────────────────────────────────────────────────────────────
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views_invoices import InvoiceViewSet

router = DefaultRouter()
router.register(r"", InvoiceViewSet, basename="invoice")

urlpatterns = [
    path("", include(router.urls)),
]

# ── Endpoints ─────────────────────────────────────────────────────────────────
#  GET    /api/invoices/                        → liste paginée + filtres
#  POST   /api/invoices/                        → créer une facture
#  GET    /api/invoices/{id}/                   → détail
#  PATCH  /api/invoices/{id}/                   → modifier
#  DELETE /api/invoices/{id}/                   → supprimer
#  GET    /api/invoices/dashboard/              → stats + factures récentes
#  GET    /api/invoices/next-number/            → prochain numéro auto
#  POST   /api/invoices/{id}/confirm/           → confirmer + déduire stock
#  PATCH  /api/invoices/{id}/change-status/     → changer le statut
#  POST   /api/invoices/{id}/convert-to-proforma/ → convertir en proforma