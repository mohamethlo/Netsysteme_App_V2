from django.db import models
from django.conf import settings
from django.utils import timezone


class Devis(models.Model):
    STATUS_CHOICES = [
        ("pending",   "En attente"),
        ("assigned",  "Assigné"),
        ("completed", "Complété"),
    ]

    nom         = models.CharField(max_length=100)
    prenom      = models.CharField(max_length=100)
    telephone   = models.CharField(max_length=20)
    commentaire = models.TextField(blank=True, null=True)
    created_at  = models.DateTimeField(default=timezone.now)
    status      = models.CharField(max_length=20, default="pending", choices=STATUS_CHOICES)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="created_devis",
        db_column="user_id",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="assigned_devis",
        db_column="assigned_to",
    )

    class Meta:
        db_table = "devis"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Devis #{self.id} — {self.prenom} {self.nom}"


class LigneDevis(models.Model):
    devis         = models.ForeignKey(Devis, on_delete=models.CASCADE, related_name="lignes")
    designation   = models.CharField(max_length=255)
    quantite      = models.PositiveIntegerField(default=1)
    prix_unitaire = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = "ligne_devis"
        ordering = ["id"]

    def __str__(self):
        return f"{self.designation} x{self.quantite}"