from rest_framework import serializers
from .models import InventoryCategory, InventoryItem, StockMovement


class InventoryCategorySerializer(serializers.ModelSerializer):
    items_count = serializers.SerializerMethodField()

    class Meta:
        model  = InventoryCategory
        fields = ["id", "name", "description", "created_at", "items_count"]

    def get_items_count(self, obj):
        return obj.items.count()


class InventoryItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    is_low_stock  = serializers.SerializerMethodField()
    image_url     = serializers.SerializerMethodField()
    stock_status  = serializers.SerializerMethodField()

    class Meta:
        model  = InventoryItem
        fields = [
            "id", "name", "description", "reference",
            "category", "category_name",
            "quantity", "unit", "prix_achat", "prix_vente",
            "seuil_alerte", "fournisseur", "emplacement",
            "image_path", "image_url", "is_low_stock", "stock_status",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_is_low_stock(self, obj):
        return obj.is_low_stock

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image_path and request:
            return request.build_absolute_uri(f"/media/{obj.image_path}")
        return None

    def get_stock_status(self, obj):
        if obj.quantity == 0:
            return "rupture"
        if obj.is_low_stock:
            return "faible"
        return "ok"


class StockMovementSerializer(serializers.ModelSerializer):
    item_name      = serializers.CharField(source="item.name", read_only=True)
    created_by_nom = serializers.SerializerMethodField()

    class Meta:
        model  = StockMovement
        fields = [
            "id", "item", "item_name", "type_mouvement",
            "quantite", "quantite_avant", "quantite_apres",
            "raison", "created_by", "created_by_nom", "created_at",
        ]
        read_only_fields = ["created_at", "created_by", "quantite_avant", "quantite_apres"]

    def get_created_by_nom(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None