from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NotificationViewSet

router = DefaultRouter()
router.register(r"notifications", NotificationViewSet, basename="notification")

urlpatterns = [path("", include(router.urls))]

# ── Endpoints ─────────────────────────────────────────────────────────────────
#  GET    /api/messaging/notifications/               → liste (non-lues en premier)
#  GET    /api/messaging/notifications/unread-count/  → nombre de non-lues
#  POST   /api/messaging/notifications/{id}/read/     → marquer une notif lue
#  POST   /api/messaging/notifications/mark-all-read/ → marquer toutes lues
#  DELETE /api/messaging/notifications/{id}/          → supprimer une notif
