from rest_framework.routers import DefaultRouter
from .views import DepenseTerrainViewSet

router = DefaultRouter()
router.register("", DepenseTerrainViewSet, basename="depense-terrain")

urlpatterns = router.urls
