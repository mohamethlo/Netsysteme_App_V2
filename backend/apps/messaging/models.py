from django.db import models
from django.conf import settings
from django.utils import timezone


class Notification(models.Model):
    user       = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="notifications",
    )
    message    = models.CharField(max_length=255)
    is_read    = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "notification"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Notif #{self.id} → {self.user}"
