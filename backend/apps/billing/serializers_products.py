# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/serializers_products.py
# ─────────────────────────────────────────────────────────────────────────────
from rest_framework import serializers
from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    is_low_stock       = serializers.ReadOnlyField()
    stock_status       = serializers.SerializerMethodField()
    invoice_items_count= serializers.SerializerMethodField()
    image_url          = serializers.SerializerMethodField()

    class Meta:
        model  = Product
        fields = [
            "id", "name", "description",
            "quantity", "alert_quantity",
            "unit_price", "supplier",
            "image_path", "image_url",
            "is_low_stock", "stock_status",
            "invoice_items_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Le prix ne peut pas être négatif.")
        return value

    def validate_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("La quantité ne peut pas être négative.")
        return value

    def validate_alert_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("Le seuil d'alerte ne peut pas être négatif.")
        return value

    def get_stock_status(self, obj):
        if obj.quantity == 0:
            return "rupture"
        if obj.quantity <= obj.alert_quantity:
            return "faible"
        return "ok"

    def get_invoice_items_count(self, obj):
        return obj.invoice_items.count() + obj.proforma_items.count()

    def get_image_url(self, obj):
        if not obj.image_path:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(f"/media/{obj.image_path}")
        return f"/media/{obj.image_path}"


class ProductStockUpdateSerializer(serializers.Serializer):
    """Pour ajuster le stock manuellement (entrée/sortie)."""
    operation = serializers.ChoiceField(choices=["add", "remove", "set"])
    quantity  = serializers.FloatField(min_value=0)
    note      = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        product = self.context.get("product")
        if attrs["operation"] == "remove":
            if product and product.quantity < attrs["quantity"]:
                raise serializers.ValidationError(
                    {"quantity": f"Stock insuffisant. Disponible : {product.quantity}"}
                )
        return attrs