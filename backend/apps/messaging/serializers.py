# apps/messaging/serializers.py
from datetime import timedelta
from django.utils import timezone
from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    time_ago = serializers.SerializerMethodField()

    class Meta:
        model  = Notification
        fields = ["id", "message", "is_read", "created_at", "time_ago"]
        read_only_fields = ["id", "created_at", "time_ago"]

    def get_time_ago(self, obj) -> str:
        delta = timezone.now() - obj.created_at
        if delta < timedelta(minutes=1):
            return "à l'instant"
        if delta < timedelta(hours=1):
            m = int(delta.seconds / 60)
            return f"il y a {m} min"
        if delta < timedelta(days=1):
            h = int(delta.seconds / 3600)
            return f"il y a {h}h"
        if delta.days < 7:
            return f"il y a {delta.days} jour{'s' if delta.days > 1 else ''}"
        return obj.created_at.strftime("%d/%m/%Y")
