from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InterventionViewSet
from .views_pdf import InterventionPDFView

router = DefaultRouter()
router.register(r"", InterventionViewSet, basename="intervention")

urlpatterns = [
    path("", include(router.urls)),
    # Route PDF en dehors du router DRF — hérite de View Django
    path("<int:pk>/pdf/", InterventionPDFView.as_view(), name="intervention-pdf"),
]