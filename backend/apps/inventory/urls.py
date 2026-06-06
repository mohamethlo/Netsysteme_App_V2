from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InventoryCategoryViewSet, InventoryItemViewSet, StockMovementViewSet

router = DefaultRouter()
router.register(r"categories", InventoryCategoryViewSet, basename="inventory-category")
router.register(r"items",      InventoryItemViewSet,     basename="inventory-item")
router.register(r"movements",  StockMovementViewSet,     basename="stock-movement")

urlpatterns = [path("", include(router.urls))]