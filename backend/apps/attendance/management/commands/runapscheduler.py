"""
Commande management : démarre le planificateur APScheduler.
Planifie l'envoi du rapport de présence du lundi au samedi à 11h00.

Usage : python manage.py runapscheduler
"""
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from django.conf import settings
from django.core.management.base import BaseCommand
from django_apscheduler.jobstores import DjangoJobStore
from django_apscheduler.models import DjangoJobExecution
from django_apscheduler import util

from apps.attendance.management.commands.send_presence_report import send_daily_presence_report

logger = logging.getLogger(__name__)


@util.close_old_connections
def presence_report_job():
    """Tâche planifiée : envoie le rapport de présence du jour."""
    try:
        send_daily_presence_report()
        logger.info("Rapport de présence envoyé.")
    except Exception as exc:
        logger.error("Erreur lors de l'envoi du rapport : %s", exc)


class Command(BaseCommand):
    help = "Démarre APScheduler pour envoyer le rapport de présence Lun-Sam à 11h00"

    def handle(self, *args, **options):
        scheduler = BackgroundScheduler(timezone=settings.TIME_ZONE)
        scheduler.add_jobstore(DjangoJobStore(), "default")

        scheduler.add_job(
            presence_report_job,
            trigger=CronTrigger(
                day_of_week="mon,tue,wed,thu,fri,sat",
                hour=11,
                minute=0,
                timezone=settings.TIME_ZONE,
            ),
            id="presence_report",
            name="Rapport de présence quotidien (Lun-Sam 11h)",
            jobstore="default",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=900,   # tolérance de 15 min si le serveur était arrêté
        )

        self.stdout.write(self.style.SUCCESS(
            "Planificateur démarré — rapport de présence Lun-Sam à 11h00."
        ))
        self.stdout.write("Appuyez sur Ctrl+C pour arrêter.")

        try:
            scheduler.start()
            # Maintenir le processus actif
            import time
            while True:
                time.sleep(60)
        except KeyboardInterrupt:
            scheduler.shutdown()
            self.stdout.write(self.style.WARNING("Planificateur arrêté."))
