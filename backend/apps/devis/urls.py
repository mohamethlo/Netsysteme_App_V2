from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DevisViewSet

router = DefaultRouter()
router.register(r"", DevisViewSet, basename="devis")

urlpatterns = [path("", include(router.urls))]
