# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/urls.py  — PATCH : ajout des routes PDF
# ─────────────────────────────────────────────────────────────────────────────
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BillingDashboardView,
    BillingClientViewSet,
    ProductViewSet,
    InvoiceViewSet,
    ProformaViewSet,
)
from .views_pdf import (
    InvoicePDFView, ProformaPDFView,
    InvoicePdfTokenView, ProformaPdfTokenView,
)

router = DefaultRouter()
router.register(r"clients",   BillingClientViewSet, basename="billing-client")
router.register(r"products",  ProductViewSet,        basename="billing-product")
router.register(r"invoices",  InvoiceViewSet,        basename="invoice")
router.register(r"proformas", ProformaViewSet,       basename="proforma")

urlpatterns = [
    path("dashboard/", BillingDashboardView.as_view(), name="billing-dashboard"),

    # ── PDF ────────────────────────────────────────────────────────────────────
    # GET  /api/billing/invoices/{id}/pdf/   → PDF facture inline
    # GET  /api/billing/proformas/{id}/pdf/  → PDF proforma inline
    path("invoices/<int:pk>/pdf/",        InvoicePDFView.as_view(),       name="invoice-pdf"),
    path("invoices/<int:pk>/pdf-token/",  InvoicePdfTokenView.as_view(),  name="invoice-pdf-token"),
    path("proformas/<int:pk>/pdf/",       ProformaPDFView.as_view(),      name="proforma-pdf"),
    path("proformas/<int:pk>/pdf-token/", ProformaPdfTokenView.as_view(), name="proforma-pdf-token"),

    path("", include(router.urls)),
]

# ── Tous les endpoints ────────────────────────────────────────────────────────
#
# DASHBOARD
#   GET  /api/billing/dashboard/
#
# PDF
#   GET  /api/billing/invoices/{id}/pdf/      → PDF facture (3 pages)
#   GET  /api/billing/proformas/{id}/pdf/     → PDF proforma (2 pages)
#
# CLIENTS
#   GET    /api/billing/clients/
#   POST   /api/billing/clients/
#   GET    /api/billing/clients/{id}/
#   PATCH  /api/billing/clients/{id}/
#   DELETE /api/billing/clients/{id}/
#   GET    /api/billing/clients/select/
#   GET    /api/billing/clients/stats/
#
# PRODUITS
#   GET    /api/billing/products/
#   POST   /api/billing/products/
#   GET    /api/billing/products/{id}/
#   PATCH  /api/billing/products/{id}/
#   DELETE /api/billing/products/{id}/
#   GET    /api/billing/products/select/
#   GET    /api/billing/products/stats/
#   GET    /api/billing/products/low-stock/
#   POST   /api/billing/products/{id}/adjust-stock/
#
# FACTURES
#   GET    /api/billing/invoices/
#   POST   /api/billing/invoices/
#   GET    /api/billing/invoices/{id}/
#   PATCH  /api/billing/invoices/{id}/
#   DELETE /api/billing/invoices/{id}/
#   GET    /api/billing/invoices/dashboard/
#   GET    /api/billing/invoices/next-number/
#   POST   /api/billing/invoices/{id}/confirm/
#   PATCH  /api/billing/invoices/{id}/change-status/
#   POST   /api/billing/invoices/{id}/convert-to-proforma/
#
# PROFORMAS
#   GET    /api/billing/proformas/
#   POST   /api/billing/proformas/
#   GET    /api/billing/proformas/{id}/
#   PATCH  /api/billing/proformas/{id}/
#   DELETE /api/billing/proformas/{id}/
#   GET    /api/billing/proformas/dashboard/
#   GET    /api/billing/proformas/next-number/
#   POST   /api/billing/proformas/{id}/convert/
#   PATCH  /api/billing/proformas/{id}/change-status/
#   POST   /api/billing/proformas/{id}/duplicate/