from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OutilViewSet, ReservationOutilViewSet

router = DefaultRouter()
router.register(r"outils",       OutilViewSet,            basename="outil")
router.register(r"reservations", ReservationOutilViewSet, basename="reservation-outil")

urlpatterns = [path("", include(router.urls))]
