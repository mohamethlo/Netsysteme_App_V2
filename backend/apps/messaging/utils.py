# apps/messaging/utils.py
"""Fonctions utilitaires pour créer des notifications."""
import logging
from django.contrib.auth import get_user_model
from django.db import models as dj_models

logger = logging.getLogger(__name__)


def _get_admin_users():
    """
    Retourne tous les utilisateurs administrateurs actifs :
      - permissions personnelles == 'all'
      - role.permissions == 'all'
      - role.name dans Administration / Administrateur
      - is_superuser
    """
    User = get_user_model()
    return User.objects.filter(
        is_active=True,
    ).filter(
        dj_models.Q(is_superuser=True) |
        dj_models.Q(permissions="all") |
        dj_models.Q(role__permissions="all") |
        dj_models.Q(role__name__in=["Administration", "Administrateur"])
    ).distinct()


def notify_admins(message: str) -> int:
    """
    Crée une Notification pour chaque admin actif.
    Retourne le nombre de notifications créées.
    """
    from .models import Notification

    admins = _get_admin_users()
    if not admins.exists():
        logger.warning("notify_admins: aucun administrateur trouvé.")
        return 0

    records = [Notification(user=admin, message=message) for admin in admins]
    Notification.objects.bulk_create(records)
    logger.info(f"notify_admins: {len(records)} notification(s) créée(s) — « {message[:60]} »")
    return len(records)


def notify_user(user, message: str) -> None:
    """Crée une Notification pour un utilisateur spécifique."""
    from .models import Notification
    Notification.objects.create(user=user, message=message)


def notify_users(users, message: str) -> int:
    """Crée une Notification pour une liste/queryset d'utilisateurs."""
    from .models import Notification
    records = [Notification(user=u, message=message) for u in users]
    Notification.objects.bulk_create(records)
    return len(records)


def _get_rt_users():
    """Retourne tous les Responsables Techniques actifs."""
    User = get_user_model()
    return User.objects.filter(
        is_active=True,
        role__name__in=["Responsable Technique", "responsable_technique"],
    ).distinct()


def notify_rt_and_admins(message: str) -> int:
    """Notifie tous les RT et admins actifs."""
    from .models import Notification
    User = get_user_model()
    targets = User.objects.filter(is_active=True).filter(
        dj_models.Q(is_superuser=True) |
        dj_models.Q(permissions="all") |
        dj_models.Q(role__permissions="all") |
        dj_models.Q(role__name__in=["Administration", "Administrateur",
                                     "Responsable Technique", "responsable_technique"])
    ).distinct()
    records = [Notification(user=u, message=message) for u in targets]
    Notification.objects.bulk_create(records)
    return len(records)
