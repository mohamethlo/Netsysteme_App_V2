# apps/expenses/models.py
import datetime
from django.db import models
from django.conf import settings
from django.utils import timezone


SITES = [("Dakar", "Dakar"), ("Mbour", "Mbour")]

CATEGORIES = [
    ("Transport",    "Transport"),
    ("Carburant",    "Carburant"),
    ("Repas",        "Repas"),
    ("Hébergement",  "Hébergement"),
    ("Matériel",     "Matériel"),
    ("Formation",    "Formation"),
    ("Salaire",      "Salaire"),
    ("Loyer",        "Loyer"),
    ("Eau",          "Facture eau"),
    ("Sonatel",      "Facture Sonatel"),
    ("MainOeuvre",   "Main d'œuvre mécanicien"),
    ("Autre",        "Autre"),
]

STATUTS = [
    ("en_attente", "En attente"),
    ("approuve",   "Approuvé"),
    ("rejete",     "Rejeté"),
]


class Approvisionnement(models.Model):
    montant    = models.FloatField()
    date       = models.DateTimeField(default=timezone.now)
    site       = models.CharField(max_length=50, choices=SITES)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="approvisionnements",
    )

    class Meta:
        db_table = "approvisionnement"
        ordering = ["-date"]

    def __str__(self):
        return f"{self.site} — {self.montant} F ({self.date:%d/%m/%Y})"


class Expense(models.Model):
    user         = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE, related_name="expenses",
    )
    titre        = models.CharField(max_length=200)
    description  = models.TextField(blank=True, null=True)
    montant      = models.FloatField()
    categorie    = models.CharField(max_length=100, blank=True, null=True, choices=CATEGORIES)
    date_depense = models.DateField(default=datetime.date.today)
    statut       = models.CharField(max_length=20, default="en_attente", choices=STATUTS)
    justificatif = models.CharField(max_length=512, blank=True, null=True)  # chemin fichier
    notes_admin  = models.TextField(blank=True, null=True)
    site         = models.CharField(max_length=50, choices=SITES, blank=True, null=True)
    approved_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="approved_expenses",
    )
    approved_at  = models.DateTimeField(null=True, blank=True)
    deleted_at   = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at   = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "expense"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.titre} — {self.montant} F"

    @property
    def is_deleted(self):
        return self.deleted_at is not None

    @property
    def can_restore(self):
        if not self.deleted_at:
            return False
        return (timezone.now() - self.deleted_at).total_seconds() < 86_400  # 24h