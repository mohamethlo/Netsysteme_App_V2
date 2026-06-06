# apps/attendance/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AttendanceViewSet, WorkLocationViewSet

router = DefaultRouter()
router.register(r"locations", WorkLocationViewSet, basename="work-location")
router.register(r"",          AttendanceViewSet,   basename="attendance")

urlpatterns = [path("", include(router.urls))]

# ── Endpoints ─────────────────────────────────────────────────────────────────
#  GET    /api/attendance/                  → historique
#  GET    /api/attendance/today/            → pointage du jour + work_locations
#  GET    /api/attendance/daily-summary/    → présents/absents/retards (admin)
#  GET    /api/attendance/dashboard/        → stats
#  POST   /api/attendance/check-in/         → pointer l'entrée
#  POST   /api/attendance/check-out/        → pointer la sortie
#  POST   /api/attendance/justify-late/     → justification retard
#  GET    /api/attendance/locations/        → zones de travail
#  POST   /api/attendance/locations/        → créer une zone
#  PATCH  /api/attendance/locations/{id}/   → modifier une zone
#  DELETE /api/attendance/locations/{id}/   → désactiver une zone