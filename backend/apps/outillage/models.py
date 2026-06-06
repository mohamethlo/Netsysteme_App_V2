from django.db import models
from django.conf import settings
from django.utils import timezone


class Outil(models.Model):
    CATEGORIE_CHOICES = [
        ("perceuse",    "Perceuse"),
        ("viseuse",     "Viseuse"),
        ("tournevis",   "Tournevis"),
        ("marteau",     "Marteau"),
        ("niveau",      "Niveau"),
        ("echelle",     "Échelle"),
        ("cable",       "Câble / Rallonge"),
        ("testeur",     "Testeur / Multimètre"),
        ("autre",       "Autre"),
    ]

    nom              = models.CharField(max_length=100)
    categorie        = models.CharField(max_length=50, choices=CATEGORIE_CHOICES, default="autre")
    description      = models.TextField(blank=True, null=True)
    quantite_totale  = models.IntegerField(default=1)
    numero_serie     = models.CharField(max_length=100, blank=True, null=True)
    is_active        = models.BooleanField(default=True, db_index=True)
    created_at       = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "outil"
        ordering = ["categorie", "nom"]

    def __str__(self):
        return f"{self.nom} ({self.get_categorie_display()})"

    @property
    def quantite_disponible(self):
        reservee = self.reservations.filter(
            statut__in=["approuvee", "en_cours"]
        ).aggregate(total=models.Sum("quantite"))["total"] or 0
        return max(0, self.quantite_totale - reservee)


class ReservationOutil(models.Model):
    STATUS_CHOICES = [
        ("en_attente",    "En attente"),
        ("approuvee",     "Approuvée"),
        ("refusee",       "Refusée"),
        ("remis",         "Remis au technicien"),
        ("en_cours",      "En cours"),
        ("retour_declare","Retour déclaré"),
        ("retournee",     "Retournée"),
    ]

    outil      = models.ForeignKey(
        Outil, on_delete=models.CASCADE, related_name="reservations",
    )
    technicien = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="reservations_outils",
    )
    chantier   = models.ForeignKey(
        "chantiers.Chantier", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="reservations_outils",
    )
    date_debut   = models.DateField()
    heure_debut  = models.TimeField(null=True, blank=True)
    date_fin     = models.DateField()
    heure_fin    = models.TimeField(null=True, blank=True)
    quantite     = models.IntegerField(default=1)
    statut      = models.CharField(max_length=20, choices=STATUS_CHOICES, default="en_attente", db_index=True)
    notes       = models.TextField(blank=True, null=True)
    created_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="reservations_creees",
    )
    created_at  = models.DateTimeField(default=timezone.now)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "reservation_outil"
        ordering = ["-created_at"]
        indexes  = [
            models.Index(fields=["statut", "date_debut"]),
            models.Index(fields=["technicien", "statut"]),
        ]

    def __str__(self):
        return f"{self.outil} — {self.technicien} ({self.date_debut}→{self.date_fin})"
