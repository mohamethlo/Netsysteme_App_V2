# apps/clients/models.py
import datetime
from django.db import models
from django.conf import settings
from django.utils import timezone


class ClientImportHistory(models.Model):
    filename    = models.CharField(max_length=255)
    imported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="import_histories",
    )
    imported_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "client_import_history"
        ordering = ["-imported_at"]

    def __str__(self):
        return f"{self.filename} — {self.imported_at:%d/%m/%Y}"


class Client(models.Model):
    TYPE_CHOICES = [("prospect", "Prospect"), ("client", "Client")]

    nom              = models.CharField(max_length=100)
    prenom           = models.CharField(max_length=100, blank=True, null=True)
    entreprise       = models.CharField(max_length=100, blank=True, null=True)
    email            = models.CharField(max_length=120, blank=True, null=True)
    telephone        = models.CharField(max_length=20, unique=True, blank=True, null=True)
    adresse          = models.TextField(blank=True, null=True)
    ville            = models.CharField(max_length=100, blank=True, null=True)
    code_postal      = models.CharField(max_length=10, blank=True, null=True)
    type_client      = models.CharField(max_length=20, default="prospect", choices=TYPE_CHOICES, db_index=True)
    assigned_to      = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="assigned_clients",
    )
    is_blacklisted   = models.BooleanField(default=False, db_index=True)
    date_blacklisted = models.DateTimeField(null=True, blank=True)
    note_conversion  = models.TextField(blank=True, null=True)
    converted_by     = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="converted_clients",
    )
    converted_at     = models.DateTimeField(null=True, blank=True)
    import_history   = models.ForeignKey(
        ClientImportHistory, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="clients",
    )
    created_at       = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "client"
        ordering = ["-created_at", "nom"]
        indexes = [
            models.Index(fields=["is_blacklisted", "type_client"]),
            models.Index(fields=["assigned_to", "is_blacklisted"]),
        ]

    def __str__(self):
        return f"{self.nom} {self.prenom or ''}".strip()

    @property
    def display_name(self):
        parts = [self.nom]
        if self.prenom:
            parts.append(self.prenom)
        return " ".join(parts)

    @property
    def next_reminder(self):
        return self.reminders.order_by("-created_at").first()


class Reminder(models.Model):
    client     = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="reminders")
    user       = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reminders",
    )
    remind_at  = models.DateTimeField(null=True, blank=True)
    notes      = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "reminder"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Rappel {self.client} — {self.created_at:%d/%m/%Y}"


class CallHistory(models.Model):
    RESULT_CHOICES = [
        ("client_joint",     "Client joint"),
        ("client_non_joint", "Client non joint"),
    ]

    client             = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="call_history")
    created_by         = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="call_histories",
    )
    nom                = models.CharField(max_length=100)
    prenom             = models.CharField(max_length=100, blank=True, null=True)
    adresse            = models.CharField(max_length=255, blank=True, null=True)
    contact_1          = models.CharField(max_length=20)
    contact_2          = models.CharField(max_length=20, blank=True, null=True)
    resultat_appel     = models.CharField(max_length=30, choices=RESULT_CHOICES, default="client_non_joint", db_index=True)
    categorie          = models.CharField(max_length=50, blank=True, null=True)
    motif_principal    = models.CharField(max_length=100, blank=True, null=True)
    motif_refus        = models.CharField(max_length=100, blank=True, null=True)
    motif_refus_detail = models.CharField(max_length=100, blank=True, null=True)
    moratoire          = models.CharField(max_length=50, blank=True, null=True)
    commentaires       = models.TextField(blank=True, null=True)
    date_appel         = models.DateField(default=datetime.date.today, db_index=True)
    date_installation  = models.DateField(null=True, blank=True)
    date_maintenance_1 = models.DateField(null=True, blank=True)
    date_maintenance_2 = models.DateField(null=True, blank=True)
    created_at         = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "call_history"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["client", "created_at"]),
            models.Index(fields=["created_by", "created_at"]),
        ]