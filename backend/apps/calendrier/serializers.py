# apps/calendar/serializers.py
from rest_framework import serializers
from .models import CalendarEvent


class CalendarEventSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = CalendarEvent
        fields = [
            "id", "title", "start", "all_day",
            "google_event_id", "google_synced", "synced_at", "last_sync_error",
            "created_at", "created_by", "created_by_name",
        ]
        read_only_fields = ["id", "created_at", "created_by",
                            "google_event_id", "google_synced", "synced_at", "last_sync_error"]

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        u  = obj.created_by
        fn = getattr(u, "prenom", "") or u.first_name or ""
        ln = getattr(u, "nom",    "") or u.last_name  or ""
        return f"{fn} {ln}".strip() or u.username