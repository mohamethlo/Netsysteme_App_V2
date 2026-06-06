# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/urls_clients.py
#  URLs dédiées au module BillingClient — à inclure dans config/urls.py
# ─────────────────────────────────────────────────────────────────────────────
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views_clients import BillingClientViewSet

router = DefaultRouter()
router.register(r"", BillingClientViewSet, basename="billing-client")

urlpatterns = [
    path("", include(router.urls)),
]

# ── Endpoints générés ─────────────────────────────────────────────────────────
#
#  GET    /api/billing-clients/          → liste (paginée + filtrée + recherche)
#  POST   /api/billing-clients/          → créer un client
#  GET    /api/billing-clients/{id}/     → détail d'un client
#  PATCH  /api/billing-clients/{id}/     → modifier (partial)
#  DELETE /api/billing-clients/{id}/     → supprimer (protégé)
#  GET    /api/billing-clients/select/   → liste légère pour <select>
#  GET    /api/billing-clients/stats/    → compteurs agrégés