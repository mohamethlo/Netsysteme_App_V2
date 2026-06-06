# ─────────────────────────────────────────────────────────────────────────────
#  apps/installations/models.py
# ─────────────────────────────────────────────────────────────────────────────
import datetime
from django.db import models
from django.conf import settings
from django.utils import timezone


class Installation(models.Model):
    STATUT_CHOICES = [
        ("en_attente", "En attente"),
        ("en_cours",   "En cours"),
        ("termine",    "Terminé"),
        ("annule",     "Annulé"),
    ]
    METHODE_CHOICES = [
        ("cash",          "Espèce (Comptant)"),
        ("one_tranche",   "1 tranche"),
        ("two_tranche",   "2 tranches"),
        ("three_tranche", "3 tranches"),
        ("four_tranche",  "4 tranches"),
        ("five_tranche",  "5 tranches"),
        ("six_tranche",   "6 tranches"),
    ]

    # Informations client
    prenom      = models.CharField(max_length=100, blank=True, null=True)
    nom         = models.CharField(max_length=100, blank=True, null=True)
    telephone   = models.CharField(max_length=50)
    adresse     = models.CharField(max_length=255, blank=True, null=True)
    rccm        = models.CharField(max_length=100, blank=True, null=True)
    immatricule = models.CharField(max_length=100, blank=True, null=True)
    ninea       = models.CharField(max_length=100, blank=True, null=True)

    # Montants
    montant_total   = models.FloatField()
    montant_avance  = models.FloatField(default=0)
    montant_restant = models.FloatField(default=0, db_index=True)

    # Dates & paiement
    date_installation = models.DateField(blank=True, null=True, db_index=True)
    methode_paiement  = models.CharField(max_length=30, blank=True, null=True, choices=METHODE_CHOICES)
    date_echeance     = models.DateField(blank=True, null=True)
    contrat_path      = models.CharField(max_length=255, blank=True, null=True)
    statut            = models.CharField(max_length=30, default="en_attente", choices=STATUT_CHOICES, db_index=True)

    # Relations personnel
    agent_commercial = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="installations_commercial",
    )
    techniciens = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="installations_technicien",
        db_table="installation_techniciens",
    )

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "installation"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["statut", "montant_restant"]),
            models.Index(fields=["agent_commercial", "statut"]),
        ]

    def __str__(self):
        return f"{self.prenom} {self.nom} — {self.date_installation}"

    @property
    def client_name(self):
        parts = [p for p in [self.prenom, self.nom] if p]
        return " ".join(parts) or f"Installation #{self.id}"

    @property
    def is_paid(self):
        return self.montant_restant <= 0

    def get_payment_schedule(self):
        """Calendrier de paiement — logique identique au Flask original."""
        try:
            from dateutil.relativedelta import relativedelta
        except ImportError:
            relativedelta = None

        schedule = []
        montant_total   = self.montant_total or 0
        montant_avance  = self.montant_avance or 0
        methode         = self.methode_paiement or ""

        if montant_avance > 0:
            avance_date = self.created_at or self.date_installation
            if avance_date and hasattr(avance_date, "date"):
                avance_date = avance_date.date()
            elif not avance_date:
                avance_date = datetime.date.today()
            schedule.append({
                "description": "Avance versée (50%)",
                "date":        avance_date.strftime("%d/%m/%Y"),
                "montant":     montant_avance,
            })

        tranches_map = {
            "cash": 0, "one_tranche": 1, "two_tranche": 2,
            "three_tranche": 3, "four_tranche": 4,
            "five_tranche": 5, "six_tranche": 6,
        }
        montant_restant = montant_total - montant_avance

        if methode == "cash":
            if montant_restant > 0:
                date_p = self.date_echeance or self.date_installation or datetime.date.today()
                schedule.append({"description": "Solde (Espèce) — 50%", "date": date_p.strftime("%d/%m/%Y"), "montant": montant_restant})
        elif methode in tranches_map and tranches_map[methode] > 0:
            nb        = tranches_map[methode]
            mpt       = montant_restant / nb
            date_base = self.date_echeance or self.date_installation or datetime.date.today()
            ordinals  = ["1ère", "2ème", "3ème", "4ème", "5ème", "6ème"]
            for i in range(1, nb + 1):
                if relativedelta:
                    d = date_base if i == 1 else date_base + relativedelta(months=i - 1)
                else:
                    d = date_base
                label   = f"{ordinals[i-1]} Tranche" if i <= len(ordinals) else f"{i}ème Tranche"
                montant = montant_restant - (mpt * (nb - 1)) if i == nb else mpt
                schedule.append({"description": label, "date": d.strftime("%d/%m/%Y"), "montant": montant})
        elif montant_restant > 0:
            date_p = self.date_echeance or self.date_installation or datetime.date.today()
            schedule.append({"description": f"Solde ({methode})" if methode else "Solde", "date": date_p.strftime("%d/%m/%Y"), "montant": montant_restant})

        return schedule


class Versement(models.Model):
    MODE_CHOICES = [
        ("espece",   "Espèce"),
        ("virement", "Virement"),
        ("cheque",   "Chèque"),
        ("mobile",   "Mobile Money"),
        ("autre",    "Autre"),
    ]

    installation     = models.ForeignKey(
        Installation, on_delete=models.CASCADE,
        related_name="versements",
    )
    montant          = models.FloatField()
    date_versement   = models.DateTimeField(default=timezone.now)
    mode_paiement    = models.CharField(max_length=50, blank=True, null=True, choices=MODE_CHOICES)
    numero_reference = models.CharField(max_length=100, blank=True, null=True)
    notes            = models.TextField(blank=True, null=True)
    recu_path        = models.CharField(max_length=255, blank=True, null=True)
    created_by       = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="versements_crees",
        db_column="created_by_id",
    )
    created_at       = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "versement"
        ordering = ["-date_versement"]

    def __str__(self):
        return f"Versement #{self.id} — {self.montant} FCFA"

    @property
    def numero_recu(self):
        return f"RECU-{self.id:06d}"


class InstallationProduct(models.Model):
    installation = models.ForeignKey(Installation, on_delete=models.CASCADE, related_name="products")
    product      = models.ForeignKey("billing.Product", on_delete=models.SET_NULL, null=True, blank=True, related_name="installation_products")
    quantity     = models.IntegerField(default=1)
    unit_price   = models.FloatField()
    total_price  = models.FloatField()
    created_at   = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "installation_product"

    def __repr__(self):
        return f"<InstallationProduct {self.product_id} x {self.quantity}>"