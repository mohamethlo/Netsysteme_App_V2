# ─────────────────────────────────────────────────────────────────────────────
#  apps/attendance/models.py
# ─────────────────────────────────────────────────────────────────────────────
import datetime
from django.db import models
from django.conf import settings
from django.utils import timezone


class WorkLocation(models.Model):
    TYPE_CHOICES = [
        ("bureau",  "Bureau"),
        ("chantier", "Chantier / Terrain"),
    ]
    name       = models.CharField(max_length=120, unique=True)
    latitude   = models.FloatField()
    longitude  = models.FloatField()
    radius     = models.IntegerField(default=100)   # mètres
    address    = models.CharField(max_length=255, blank=True, null=True)
    type       = models.CharField(max_length=20, default="bureau", choices=TYPE_CHOICES)
    is_active  = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "work_location"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Attendance(models.Model):
    STATUS_CHOICES = [
        ("present",    "Présent"),
        ("absent",     "Absent"),
        ("late",       "En retard"),
        ("half_day",   "Demi-journée"),
        ("on_leave",   "Congé"),
    ]

    user              = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="attendances",
    )
    date              = models.DateField(default=datetime.date.today, db_index=True)
    check_in          = models.DateTimeField(null=True, blank=True)
    check_out         = models.DateTimeField(null=True, blank=True)
    check_in_location = models.CharField(max_length=120, blank=True, null=True)
    check_out_location= models.CharField(max_length=120, blank=True, null=True)
    check_in_lat      = models.FloatField(null=True, blank=True)
    check_in_lng      = models.FloatField(null=True, blank=True)
    check_out_lat     = models.FloatField(null=True, blank=True)
    check_out_lng     = models.FloatField(null=True, blank=True)
    work_location     = models.ForeignKey(
        WorkLocation,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="attendances",
    )
    status            = models.CharField(max_length=20, default="present", choices=STATUS_CHOICES, db_index=True)
    notes             = models.TextField(blank=True, null=True)  # justification retard
    created_at        = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "attendance"
        ordering = ["-date", "-check_in"]
        unique_together = [("user", "date")]
        indexes = [
            models.Index(fields=["user", "date"]),
            models.Index(fields=["date", "status"]),
        ]

    def __str__(self):
        return f"{self.user} — {self.date}"

    @property
    def total_hours(self) -> float:
        if self.check_in and self.check_out:
            delta = self.check_out - self.check_in
            return round(delta.total_seconds() / 3600, 2)
        return 0.0

    @property
    def is_late(self) -> bool:
        if not self.check_in:
            return False
        heure_limite = datetime.time(9, 15)
        return self.check_in.time() > heure_limite

    @property
    def needs_justification(self) -> bool:
        return self.is_late and not (self.notes and self.notes.strip())