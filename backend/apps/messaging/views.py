# apps/messaging/views.py
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ModelViewSet):
    """
    GET    /api/messaging/notifications/               → liste (non-lues d'abord)
    GET    /api/messaging/notifications/unread-count/  → nombre non-lues
    POST   /api/messaging/notifications/{id}/read/     → marquer une notif lue
    POST   /api/messaging/notifications/mark-all-read/ → tout marquer lu
    DELETE /api/messaging/notifications/{id}/          → supprimer
    """
    serializer_class   = NotificationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names  = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by("is_read", "-created_at")

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"count": count})

    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        if not notif.is_read:
            notif.is_read = True
            notif.save(update_fields=["is_read"])
        return Response(NotificationSerializer(notif).data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        updated = Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"updated": updated})
