from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChantierViewSet

router = DefaultRouter()
router.register(r"", ChantierViewSet, basename="chantier")

urlpatterns = [path("", include(router.urls))]
