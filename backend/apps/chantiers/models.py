from django.db import models
from django.conf import settings
from django.utils import timezone


class Chantier(models.Model):
    STATUS_CHOICES = [
        ("en_attente", "En attente"),
        ("en_cours",   "En cours"),
        ("termine",    "Terminé"),
        ("suspendu",   "Suspendu"),
    ]

    nom             = models.CharField(max_length=200)
    description     = models.TextField(blank=True, null=True)
    adresse         = models.CharField(max_length=255, blank=True, null=True)
    date_debut      = models.DateField()
    date_fin_prevue = models.DateField(null=True, blank=True)
    date_fin_reelle = models.DateField(null=True, blank=True)
    statut          = models.CharField(max_length=20, choices=STATUS_CHOICES, default="en_attente", db_index=True)

    responsable = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="chantiers_responsable",
    )
    techniciens = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True, related_name="chantiers_technicien",
        db_table="chantier_technicien",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="chantiers_crees",
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "chantier"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["statut", "date_debut"]),
        ]

    def __str__(self):
        return self.nom
