# apps/sms/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SMSHistoryViewSet, SMSTemplateViewSet

router = DefaultRouter()
router.register(r"templates", SMSTemplateViewSet, basename="sms-template")
router.register(r"",          SMSHistoryViewSet,  basename="sms-history")

urlpatterns = [
    # Routes manuelles (actions avec tirets)
    path("stats/",       SMSHistoryViewSet.as_view({"get":  "stats"}),      name="sms-stats"),
    path("send-quick/",  SMSHistoryViewSet.as_view({"post": "send_quick"}), name="sms-send-quick"),
    path("send-bulk/",   SMSHistoryViewSet.as_view({"post": "send_bulk"}),  name="sms-send-bulk"),
    path("domains/",     SMSHistoryViewSet.as_view({"get":  "domains"}),    name="sms-domains"),
    path("export-csv/",  SMSHistoryViewSet.as_view({"get":  "export_csv"}), name="sms-export-csv"),
    path("", include(router.urls)),
]

# ── Endpoints ─────────────────────────────────────────────────────────────────
#  GET    /api/sms/                    → historique (filtrable)
#  POST   /api/sms/send-quick/         → envoi rapide 1 numéro
#  POST   /api/sms/send-bulk/          → envoi groupé billing clients
#  GET    /api/sms/stats/              → statistiques globales
#  GET    /api/sms/domains/            → domaines disponibles
#  GET    /api/sms/export-csv/         → export CSV
#  GET    /api/sms/templates/          → liste templates
#  POST   /api/sms/templates/          → créer template
#  PATCH  /api/sms/templates/{id}/     → modifier
#  DELETE /api/sms/templates/{id}/     → supprimer
#  POST   /api/sms/templates/{id}/use/ → utiliser (incrémente usage_count)