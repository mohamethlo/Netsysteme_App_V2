# apps/assignments/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TechnicianAssignmentViewSet

router = DefaultRouter()
router.register(r"", TechnicianAssignmentViewSet, basename="assignment")

urlpatterns = [
    path("daily-report/",  TechnicianAssignmentViewSet.as_view({"get": "daily_report"}),    name="assignment-daily-report"),
    path("assign/",        TechnicianAssignmentViewSet.as_view({"post": "assign"}),          name="assignment-assign"),
    path("history/",       TechnicianAssignmentViewSet.as_view({"get": "history"}),          name="assignment-history"),
    path("technicians/",   TechnicianAssignmentViewSet.as_view({"get": "technicians_list"}), name="assignment-technicians"),
    path("", include(router.urls)),
]

# ── Endpoints ──────────────────────────────────────────────────────────────
#  GET  /api/assignments/daily-report/?date=YYYY-MM-DD  → rapport quotidien
#  POST /api/assignments/assign/                         → affecter / libérer
#  GET  /api/assignments/history/?technician_id=X&date=Y → historique
#  GET  /api/assignments/technicians/?date=YYYY-MM-DD   → liste enrichie
#  GET  /api/assignments/                                → CRUD liste