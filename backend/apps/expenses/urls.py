# apps/expenses/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ExpenseViewSet, ApprovisionnementViewSet

router = DefaultRouter()
router.register(r"appros",   ApprovisionnementViewSet, basename="approvisionnement")
router.register(r"",         ExpenseViewSet,           basename="expense")

urlpatterns = [path("", include(router.urls))]

# ── Endpoints ──────────────────────────────────────────────────────────────
#  GET    /api/expenses/                     → liste (filtré par rôle/site)
#  POST   /api/expenses/                     → créer une dépense
#  GET    /api/expenses/{id}/                → détail
#  PATCH  /api/expenses/{id}/                → modifier
#  DELETE /api/expenses/{id}/                → corbeille (soft delete)
#  POST   /api/expenses/{id}/approve/        → approuver
#  POST   /api/expenses/{id}/reject/         → rejeter
#  GET    /api/expenses/trash/               → corbeille
#  POST   /api/expenses/{id}/restore/        → restaurer
#  DELETE /api/expenses/{id}/force-delete/   → supprimer définitivement
#  GET    /api/expenses/dashboard/?site=X    → KPIs + graphiques
#  GET    /api/expenses/categories/          → liste des catégories
#
#  GET    /api/expenses/appros/              → liste approvisionnements
#  POST   /api/expenses/appros/              → créer (admin only)
#  GET    /api/expenses/appros/history/?site=X → historique par site