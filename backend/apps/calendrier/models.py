# apps/calendar/models.py
from django.db import models
from django.utils import timezone


class CalendarEvent(models.Model):
    title           = models.CharField(max_length=255)
    start           = models.CharField(max_length=50)   # ISO string "2026-04-05" ou "2026-04-05T09:00:00"
    all_day         = models.BooleanField(default=False, db_column="allDay")
    # Google Calendar sync
    google_event_id = models.CharField(max_length=255, null=True, blank=True)
    google_synced   = models.BooleanField(default=False)
    synced_at       = models.DateTimeField(null=True, blank=True)
    last_sync_error = models.TextField(null=True, blank=True)
    created_at      = models.DateTimeField(default=timezone.now)
    created_by      = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="calendar_events",
    )

    class Meta:
        db_table = "calendar_event"
        ordering = ["start"]

    def __str__(self):
        return f"{self.title} ({self.start})"