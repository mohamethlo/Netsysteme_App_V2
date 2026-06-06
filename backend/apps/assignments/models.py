# apps/assignments/models.py
import datetime as dt
from django.db import models
from django.conf import settings
from django.utils import timezone


class TechnicianAssignment(models.Model):
    """Historique des affectations de techniciens aux zones de travail."""

    technician    = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="assignments", verbose_name="Technicien",
    )
    work_location = models.ForeignKey(
        "attendance.WorkLocation", on_delete=models.CASCADE,
        related_name="assignments", verbose_name="Zone de travail",
    )
    date          = models.DateField(default=dt.date.today, verbose_name="Date", db_index=True)
    assigned_at   = models.DateTimeField(default=timezone.now)
    unassigned_at = models.DateTimeField(null=True, blank=True)
    assigned_by   = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name="made_assignments",
    )
    is_active     = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = "technician_assignment"
        ordering = ["-assigned_at"]
        indexes = [
            models.Index(fields=["technician", "date", "is_active"]),
            models.Index(fields=["date", "is_active"]),
        ]

    def __str__(self):
        return f"{self.technician} → {self.work_location} ({self.date})"

    @property
    def duration_minutes(self) -> int:
        end   = self.unassigned_at or timezone.now()
        delta = end - self.assigned_at
        return max(0, int(delta.total_seconds() / 60))

    @property
    def duration_hours(self) -> float:
        return round(self.duration_minutes / 60, 1)