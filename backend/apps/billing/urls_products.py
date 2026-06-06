# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/urls_products.py
# ─────────────────────────────────────────────────────────────────────────────
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views_products import ProductViewSet

router = DefaultRouter()
router.register(r"", ProductViewSet, basename="product")

urlpatterns = [
    path("", include(router.urls)),
]

# ── Endpoints ─────────────────────────────────────────────────────────────────
#  GET    /api/products/                    → liste paginée
#  POST   /api/products/                    → créer (multipart)
#  GET    /api/products/{id}/               → détail
#  PATCH  /api/products/{id}/               → modifier
#  DELETE /api/products/{id}/               → supprimer + image
#  GET    /api/products/select/             → dropdown léger
#  GET    /api/products/stats/              → statistiques
#  GET    /api/products/low-stock/          → alertes stock
#  POST   /api/products/{id}/adjust-stock/  → ajustement manuel