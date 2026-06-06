from django.db import models
from django.conf import settings


class Intervention(models.Model):
    STATUT_CHOICES = [
        ("planifiee",  "Planifiée"),
        ("en_cours",   "En cours"),
        ("terminee",   "Terminée"),
        ("annulee",    "Annulée"),
    ]
    PRIORITE_CHOICES = [
        ("basse",   "Basse"),
        ("normale", "Normale"),
        ("haute",   "Haute"),
        ("urgente", "Urgente"),
    ]
    TYPE_CHOICES = [
        ("Installation",                        "Installation"),
        ("Maintenance",                         "Maintenance"),
        ("Installation Vidéo surveillance filaire",  "Vidéo surveillance filaire"),
        ("Installation Vidéo surveillance sans-fil", "Vidéo surveillance sans-fil"),
        ("Installation Téléphonique",           "Installation Téléphonique"),
        ("Installation Sécurité Incendie",      "Installation Sécurité Incendie"),
        ("Réseau informatique",                 "Réseau informatique"),
        ("Entretien parc",                      "Entretien parc"),
        ("Installation logiciel",               "Installation logiciel"),
        ("MAJ version logiciel",                "MAJ version logiciel"),
        ("Dépannage",                           "Dépannage"),
        ("Centrale téléphonique",               "Centrale téléphonique"),
        ("Formation initiale",                  "Formation initiale"),
        ("Autres",                              "Autres"),
    ]

    # ── Champs de base (identiques Flask) ────────────────────────────────────
    titre                  = models.CharField(max_length=200, blank=True, null=True)
    description            = models.TextField(blank=True, null=True)

    # Client enregistré OU client libre
    client                 = models.ForeignKey(
        "clients.Client", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="interventions",
        db_column="client_id",
    )
    client_libre_nom       = models.CharField(max_length=200, blank=True, null=True)
    client_libre_telephone = models.CharField(max_length=20,  blank=True, null=True)

    technicien             = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="interventions_technicien",
        db_column="technicien_id",
    )
    autres_intervenants    = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True, related_name="interventions_autres",
        db_table="autres_intervenants_assoc",
    )
    # Responsable Technique assigné par le commercial
    responsable            = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="interventions_responsable",
        db_column="responsable_id",
    )

    date_prevue            = models.DateTimeField(db_index=True)
    date_realisation       = models.DateTimeField(null=True, blank=True)
    duree_estimee          = models.IntegerField(null=True, blank=True)   # minutes
    duree_reelle           = models.IntegerField(null=True, blank=True)   # minutes

    statut                 = models.CharField(max_length=20,  choices=STATUT_CHOICES,  default="planifiee", db_index=True)
    priorite               = models.CharField(max_length=20,  choices=PRIORITE_CHOICES, default="normale", db_index=True)

    adresse                = models.TextField(blank=True, null=True)
    notes                  = models.TextField(blank=True, null=True)

    created_by             = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="interventions_creees",
        db_column="created_by_id",
    )
    created_at             = models.DateTimeField(auto_now_add=True)
    updated_at             = models.DateTimeField(auto_now=True)

    # ── Champs étendus ────────────────────────────────────────────────────────
    type_intervention      = models.CharField(max_length=100, blank=True, null=True)
    societe                = models.CharField(max_length=100, blank=True, null=True)
    representant           = models.CharField(max_length=100, blank=True, null=True)
    telephone              = models.CharField(max_length=30,  blank=True, null=True)

    taches_realisees       = models.TextField(blank=True, null=True)
    heure_arrivee          = models.TimeField(null=True, blank=True)
    heure_depart           = models.TimeField(null=True, blank=True)
    duree_intervention     = models.TimeField(null=True, blank=True)
    observations_technicien = models.TextField(blank=True, null=True)
    id_dvr_nvr             = models.CharField(max_length=100, blank=True, null=True)
    mdp_dvr_nvr            = models.CharField(max_length=100, blank=True, null=True)
    qr_code_path           = models.CharField(max_length=255, blank=True, null=True)
    signature_data         = models.TextField(blank=True, null=True)

    class Meta:
        db_table  = "intervention"
        ordering  = ["-date_prevue"]
        indexes = [
            models.Index(fields=["statut", "priorite"]),
            models.Index(fields=["technicien", "statut"]),
            models.Index(fields=["date_prevue", "statut"]),
        ]

    def __str__(self):
        return self.titre or f"Intervention #{self.id}"


class InterventionMaterial(models.Model):
    intervention = models.ForeignKey(
        Intervention, on_delete=models.CASCADE,
        related_name="materiels", db_column="intervention_id",
    )
    article      = models.ForeignKey(
        "inventory.InventoryItem", on_delete=models.SET_NULL,
        null=True, blank=True, db_column="article_id",
    )
    quantite     = models.IntegerField(default=1)

    class Meta:
        db_table = "intervention_material"

    def __str__(self):
        name = self.article.name if self.article else f"Article #{self.article_id}"
        return f"{name} x{self.quantite}"