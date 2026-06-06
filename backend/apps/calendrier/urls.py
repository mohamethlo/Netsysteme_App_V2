# apps/calendar/urls.py
# Ajoutez dans config/urls.py :
#   path("api/calendar/", include("apps.calendar.urls")),
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CalendarEventViewSet

router = DefaultRouter()
router.register(r"events", CalendarEventViewSet, basename="calendar-event")

urlpatterns = [path("", include(router.urls))]

# Endpoints générés :
#  GET/POST   /api/calendar/events/
#  GET/PUT/PATCH/DELETE  /api/calendar/events/<id>/
#  GET    /api/calendar/events/month/?year=&month=
#  GET    /api/calendar/events/stats/
#  POST   /api/calendar/events/<id>/sync-google/
#  POST   /api/calendar/events/sync-all/