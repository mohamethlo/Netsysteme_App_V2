# apps/sms/models.py
from django.db import models
from django.conf import settings
from django.utils import timezone


class SMSHistory(models.Model):
    STATUS_CHOICES = [
        ("pending", "En attente"),
        ("success", "Réussi"),
        ("failed",  "Échoué"),
    ]

    recipient_name    = models.CharField(max_length=120, blank=True, null=True)
    phone             = models.CharField(max_length=20)
    message           = models.TextField()
    message_template  = models.TextField(blank=True, null=True)
    status            = models.CharField(max_length=20, default="pending", choices=STATUS_CHOICES)
    error_message     = models.TextField(blank=True, null=True)
    sent_at           = models.DateTimeField(default=timezone.now)
    sent_by           = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="sent_sms",
    )
    billing_client_id = models.IntegerField(null=True, blank=True)   # FK souple
    installation_id   = models.IntegerField(null=True, blank=True)   # FK souple
    provider          = models.CharField(max_length=50, default="Orange")
    message_id        = models.CharField(max_length=100, blank=True, null=True)
    cost              = models.FloatField(default=0.0)
    sender_domain     = models.CharField(max_length=50, default="NETSYSTEME")
    extra_data        = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = "sms_history"
        ordering = ["-sent_at"]

    def __str__(self):
        return f"{self.phone} — {self.status} — {self.sender_domain}"


class SMSTemplate(models.Model):
    name        = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    content     = models.TextField()
    category    = models.CharField(max_length=50, blank=True, null=True)
    is_active   = models.BooleanField(default=True)
    usage_count = models.IntegerField(default=0)
    created_at  = models.DateTimeField(default=timezone.now)
    updated_at  = models.DateTimeField(auto_now=True)
    created_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="sms_templates",
    )

    class Meta:
        db_table = "sms_template"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name