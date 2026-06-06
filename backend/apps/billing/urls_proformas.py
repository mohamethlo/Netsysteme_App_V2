# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/urls_proformas.py
# ─────────────────────────────────────────────────────────────────────────────
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views_proformas import ProformaViewSet

router = DefaultRouter()
router.register(r"", ProformaViewSet, basename="proforma")

urlpatterns = [
    path("", include(router.urls)),
]

# ── Endpoints ─────────────────────────────────────────────────────────────────
#  GET    /api/proformas/                      → liste paginée + filtres
#  POST   /api/proformas/                      → créer un proforma
#  GET    /api/proformas/{id}/                 → détail
#  PATCH  /api/proformas/{id}/                 → modifier
#  DELETE /api/proformas/{id}/                 → supprimer
#  GET    /api/proformas/dashboard/            → stats + proformas récents
#  GET    /api/proformas/next-number/          → prochain numéro auto
#  POST   /api/proformas/{id}/convert/         → convertir en facture
#  PATCH  /api/proformas/{id}/change-status/   → changer le statut
#  POST   /api/proformas/{id}/duplicate/       → dupliquer