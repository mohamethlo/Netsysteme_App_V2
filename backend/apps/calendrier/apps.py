from django.apps import AppConfig

class CalendarConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.calendrier"
    label = "calendar_app"   # évite le conflit avec django.contrib.contenttypes
    verbose_name = "Calendrier"