from django.db import models
from django.conf import settings
from django.utils import timezone
import datetime


class SalaryAdvance(models.Model):
    STATUT_CHOICES = [
        ("en_attente", "En attente"),
        ("approuve",   "Approuvée"),
        ("refuse",     "Refusée"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="salary_advances", db_column="user_id",
    )
    montant      = models.FloatField()
    motif        = models.TextField(blank=True, null=True)
    date_demande = models.DateField(default=datetime.date.today)
    statut       = models.CharField(max_length=20, default="en_attente", choices=STATUT_CHOICES)
    notes_admin  = models.TextField(blank=True, null=True)
    created_at   = models.DateTimeField(default=timezone.now)
    approved_at  = models.DateTimeField(null=True, blank=True)
    approved_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="approved_advances",
        db_column="approved_by_id",
    )

    class Meta:
        db_table = "salary_advance"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Avance {self.user} — {self.montant} F"