# apps/clients/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, CallHistoryViewSet

router = DefaultRouter()
router.register(r"calls", CallHistoryViewSet, basename="call-history")
router.register(r"",      ClientViewSet,      basename="client")

urlpatterns = [
    # ── Routes manuelles pour les actions custom avec tirets ──────────────────
    # Le DefaultRouter ne génère pas automatiquement les routes avec tirets
    path(
        "delete-last-import/",
        ClientViewSet.as_view({"delete": "delete_last_import"}),
        name="client-delete-last-import",
    ),
    path(
        "import/",
        ClientViewSet.as_view({"post": "import_clients"}),
        name="client-import",
    ),
    path(
        "export-csv/",
        ClientViewSet.as_view({"get": "export_csv"}),
        name="client-export-csv",
    ),
    path(
        "stats/",
        ClientViewSet.as_view({"get": "stats"}),
        name="client-stats",
    ),
    path(
        "calls/export-csv/",
        CallHistoryViewSet.as_view({"get": "export_csv"}),
        name="call-export-csv",
    ),
    # ── Router (CRUD standard + actions detail) ───────────────────────────────
    path("", include(router.urls)),
]