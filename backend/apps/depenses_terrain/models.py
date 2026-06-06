import os
from django.db import models
from django.conf import settings
from django.utils import timezone


class DepenseTerrain(models.Model):
    TYPE_CHOICES = [
        ("cable",       "Câble / Fil"),
        ("puce",        "Puce / Composant"),
        ("transport",   "Transport"),
        ("outil",       "Outil / Matériel"),
        ("fourniture",  "Fourniture"),
        ("autre",       "Autre"),
    ]
    STATUS_CHOICES = [
        ("en_attente", "En attente"),
        ("approuvee",  "Approuvée"),
        ("refusee",    "Refusée"),
        ("remboursee", "Remboursée"),
    ]

    technicien   = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="depenses_terrain",
    )
    chantier = models.ForeignKey(
        "chantiers.Chantier", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="depenses_terrain",
    )
    type_depense = models.CharField(max_length=20, choices=TYPE_CHOICES)
    description  = models.TextField()
    montant      = models.DecimalField(max_digits=10, decimal_places=2)
    date_depense = models.DateField()
    statut       = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="en_attente", db_index=True,
    )
    notes_admin  = models.TextField(blank=True, null=True)
    created_by   = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="depenses_terrain_creees",
    )
    created_at   = models.DateTimeField(default=timezone.now)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "depense_terrain"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["technicien", "statut"]),
            models.Index(fields=["date_depense"]),
        ]

    def __str__(self):
        return f"{self.get_type_depense_display()} — {self.technicien} ({self.date_depense})"


def _justif_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower()
    return f"justificatifs/{instance.depense.technicien_id}/{instance.depense_id}/{filename}"


class JustificatifDepense(models.Model):
    depense     = models.ForeignKey(
        DepenseTerrain, on_delete=models.CASCADE, related_name="justificatifs",
    )
    fichier     = models.FileField(upload_to=_justif_upload_path)
    nom         = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "justificatif_depense"

    def __str__(self):
        return self.nom
