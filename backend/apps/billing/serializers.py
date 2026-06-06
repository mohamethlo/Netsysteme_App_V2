# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/serializers.py  (patch installation)
# ─────────────────────────────────────────────────────────────────────────────
from rest_framework import serializers
from .models import (
    BillingClient, Product,
    Invoice, InvoiceItem,
    Proforma, ProformaItem,
)


# ═══════════════════════════════════════════════════════════════════════════════
#  BillingClient
# ═══════════════════════════════════════════════════════════════════════════════
class BillingClientSerializer(serializers.ModelSerializer):
    display_name    = serializers.ReadOnlyField()
    can_delete      = serializers.SerializerMethodField()
    invoices_count  = serializers.SerializerMethodField()
    proformas_count = serializers.SerializerMethodField()

    class Meta:
        model  = BillingClient
        fields = [
            "id", "company_name", "contact_name", "email", "phone",
            "address", "tax_id", "display_name", "can_delete",
            "invoices_count", "proformas_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_phone(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Le numéro de téléphone est obligatoire.")
        return value.strip()

    def validate(self, attrs):
        company = (attrs.get("company_name") or "").strip()
        contact = (attrs.get("contact_name") or "").strip()
        if not self.instance and not company and not contact:
            raise serializers.ValidationError(
                {"company_name": "Le nom de l'entreprise ou du contact est obligatoire."}
            )
        return attrs

    def get_can_delete(self, obj):      return obj.can_delete()
    def get_invoices_count(self, obj):  return obj.invoices.count()
    def get_proformas_count(self, obj): return obj.proformas.count()


# ═══════════════════════════════════════════════════════════════════════════════
#  Product
# ═══════════════════════════════════════════════════════════════════════════════
class ProductSerializer(serializers.ModelSerializer):
    is_low_stock        = serializers.ReadOnlyField()
    stock_status        = serializers.ReadOnlyField()
    invoice_items_count = serializers.SerializerMethodField()
    image_url           = serializers.SerializerMethodField()

    class Meta:
        model  = Product
        fields = [
            "id", "name", "description",
            "quantity", "alert_quantity", "unit_price",
            "supplier", "image_path", "image_url",
            "is_low_stock", "stock_status",
            "invoice_items_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_unit_price(self, v):
        if v < 0:
            raise serializers.ValidationError("Le prix ne peut pas être négatif.")
        return v

    def validate_quantity(self, v):
        if v < 0:
            raise serializers.ValidationError("La quantité ne peut pas être négative.")
        return v

    def get_invoice_items_count(self, obj):
        return obj.invoice_items.count() + obj.proforma_items.count()

    def get_image_url(self, obj):
        if not obj.image_path:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(f"/media/{obj.image_path}")
        return f"/media/{obj.image_path}"


# ═══════════════════════════════════════════════════════════════════════════════
#  InvoiceItem
# ═══════════════════════════════════════════════════════════════════════════════
class InvoiceItemSerializer(serializers.ModelSerializer):
    subtotal                = serializers.SerializerMethodField()
    subtotal_after_discount = serializers.SerializerMethodField()
    product_name            = serializers.SerializerMethodField()
    product_image_url       = serializers.SerializerMethodField()

    class Meta:
        model  = InvoiceItem
        fields = [
            "id", "description", "quantity", "unit_price",
            "discount_percent", "product",
            "product_name", "product_image_url",
            "subtotal", "subtotal_after_discount",
        ]

    def get_subtotal(self, obj):                return round(obj.subtotal(), 2)
    def get_subtotal_after_discount(self, obj): return round(obj.subtotal_after_discount(), 2)
    def get_product_name(self, obj):            return obj.product.name if obj.product else None

    def get_product_image_url(self, obj):
        if not obj.product or not obj.product.image_path:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(f"/media/{obj.product.image_path}")
        return f"/media/{obj.product.image_path}"


class InvoiceItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = InvoiceItem
        fields = ["description", "quantity", "unit_price", "discount_percent", "product"]

    def validate_quantity(self, v):
        if v <= 0:
            raise serializers.ValidationError("La quantité doit être supérieure à 0.")
        return v

    def validate_unit_price(self, v):
        if v < 0:
            raise serializers.ValidationError("Le prix unitaire ne peut pas être négatif.")
        return v


# ═══════════════════════════════════════════════════════════════════════════════
#  Invoice
# ═══════════════════════════════════════════════════════════════════════════════
class InvoiceSerializer(serializers.ModelSerializer):
    items                     = InvoiceItemSerializer(many=True, read_only=True)
    billing_client_detail     = BillingClientSerializer(source="billing_client", read_only=True)
    status_display            = serializers.CharField(source="get_status_display",  read_only=True)
    domaine_display           = serializers.CharField(source="get_domaine_display", read_only=True)
    # installation est un IntegerField simple pour l'instant
    installation              = serializers.IntegerField(
        source="installation_id", allow_null=True, required=False
    )
    # Calculs
    total_ht                  = serializers.SerializerMethodField()
    tva_amount                = serializers.SerializerMethodField()
    total_ttc_before_discount = serializers.SerializerMethodField()
    discount_value            = serializers.SerializerMethodField()
    total_ttc                 = serializers.SerializerMethodField()
    remaining_balance         = serializers.SerializerMethodField()
    has_advance               = serializers.SerializerMethodField()

    class Meta:
        model  = Invoice
        fields = [
            "id", "invoice_number",
            "billing_client", "billing_client_detail",
            "installation",
            "date", "due_date", "tax_rate",
            "status", "status_display",
            "notes", "domaine", "domaine_display",
            "discount_percent", "discount_amount", "advance_amount",
            "items",
            "total_ht", "tva_amount",
            "total_ttc_before_discount", "discount_value",
            "total_ttc", "remaining_balance", "has_advance",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_total_ht(self, obj):                  return round(obj.total_amount(), 2)
    def get_tva_amount(self, obj):                return round(obj.tax_amount(), 2)
    def get_total_ttc_before_discount(self, obj): return round(obj.total_before_discount(), 2)
    def get_discount_value(self, obj):            return round(obj.discount_value(), 2)
    def get_total_ttc(self, obj):                 return round(obj.total_with_tax_and_discount(), 2)
    def get_remaining_balance(self, obj):         return round(obj.remaining_balance(), 2)
    def get_has_advance(self, obj):               return obj.has_advance()


class InvoiceWriteSerializer(serializers.ModelSerializer):
    items        = InvoiceItemWriteSerializer(many=True)
    installation = serializers.IntegerField(
        source="installation_id", allow_null=True, required=False
    )

    class Meta:
        model  = Invoice
        fields = [
            "id", "invoice_number", "billing_client", "installation",
            "date", "due_date", "tax_rate",
            "status", "notes", "domaine",
            "discount_percent", "discount_amount", "advance_amount",
            "items",
        ]
        read_only_fields = ["id"]

    def validate_invoice_number(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Le numéro de facture est obligatoire.")
        return value.strip()

    def validate_items(self, items):
        if not [it for it in items if (it.get("description") or "").strip()]:
            raise serializers.ValidationError("Ajoutez au moins un article.")
        return items

    def validate(self, attrs):
        if not attrs.get("billing_client"):
            raise serializers.ValidationError({"billing_client": "Un client doit être sélectionné."})
        if not attrs.get("domaine"):
            raise serializers.ValidationError({"domaine": "Veuillez sélectionner un domaine."})
        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        invoice    = Invoice.objects.create(**validated_data)
        for item in items_data:
            if (item.get("description") or "").strip():
                InvoiceItem.objects.create(invoice=invoice, **item)
        return invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                if (item.get("description") or "").strip():
                    InvoiceItem.objects.create(invoice=instance, **item)
        return instance


# ═══════════════════════════════════════════════════════════════════════════════
#  ProformaItem
# ═══════════════════════════════════════════════════════════════════════════════
class ProformaItemSerializer(serializers.ModelSerializer):
    subtotal          = serializers.SerializerMethodField()
    subtotal_discount = serializers.SerializerMethodField()
    product_name      = serializers.SerializerMethodField()
    product_image_url = serializers.SerializerMethodField()

    class Meta:
        model  = ProformaItem
        fields = [
            "id", "description", "quantity", "unit_price",
            "discount_percent", "product",
            "product_name", "product_image_url",
            "subtotal", "subtotal_discount",
        ]

    def get_subtotal(self, obj):          return round(obj.subtotal(), 2)
    def get_subtotal_discount(self, obj): return round(obj.subtotal_after_discount(), 2)
    def get_product_name(self, obj):      return obj.product.name if obj.product else None

    def get_product_image_url(self, obj):
        if not obj.product or not obj.product.image_path:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(f"/media/{obj.product.image_path}")
        return f"/media/{obj.product.image_path}"


class ProformaItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ProformaItem
        fields = ["description", "quantity", "unit_price", "discount_percent", "product"]

    def validate_quantity(self, v):
        if v <= 0:
            raise serializers.ValidationError("La quantité doit être supérieure à 0.")
        return v


# ═══════════════════════════════════════════════════════════════════════════════
#  Proforma
# ═══════════════════════════════════════════════════════════════════════════════
class ProformaSerializer(serializers.ModelSerializer):
    items                     = ProformaItemSerializer(many=True, read_only=True)
    billing_client_detail     = BillingClientSerializer(source="billing_client", read_only=True)
    status_display            = serializers.CharField(source="get_status_display", read_only=True)
    total_ht                  = serializers.SerializerMethodField()
    tva_amount                = serializers.SerializerMethodField()
    total_ttc_before_discount = serializers.SerializerMethodField()
    discount_value            = serializers.SerializerMethodField()
    total_ttc                 = serializers.SerializerMethodField()

    class Meta:
        model  = Proforma
        fields = [
            "id", "proforma_number",
            "billing_client", "billing_client_detail",
            "date", "valid_until", "tax_rate",
            "status", "status_display",
            "notes", "domaine",
            "converted_to_invoice", "invoice",
            "discount_percent", "discount_amount",
            "items",
            "total_ht", "tva_amount",
            "total_ttc_before_discount", "discount_value", "total_ttc",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_total_ht(self, obj):                  return round(obj.total_amount(), 2)
    def get_tva_amount(self, obj):                return round(obj.total_amount() * obj.tax_rate, 2)
    def get_total_ttc_before_discount(self, obj): return round(obj.total_before_discount(), 2)
    def get_discount_value(self, obj):            return round(obj.discount_value(), 2)
    def get_total_ttc(self, obj):                 return round(obj.total_with_tax_and_discount(), 2)


class ProformaWriteSerializer(serializers.ModelSerializer):
    items = ProformaItemWriteSerializer(many=True)

    class Meta:
        model  = Proforma
        fields = [
            "id", "proforma_number", "billing_client",
            "date", "valid_until", "tax_rate",
            "status", "notes", "domaine",
            "discount_percent", "discount_amount",
            "items",
        ]
        read_only_fields = ["id"]

    def validate_proforma_number(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Le numéro de proforma est obligatoire.")
        return value.strip()

    def validate_items(self, items):
        if not [it for it in items if (it.get("description") or "").strip()]:
            raise serializers.ValidationError("Ajoutez au moins un article.")
        return items

    def validate(self, attrs):
        if not attrs.get("billing_client"):
            raise serializers.ValidationError({"billing_client": "Un client doit être sélectionné."})
        if not attrs.get("domaine"):
            raise serializers.ValidationError({"domaine": "Veuillez sélectionner un domaine."})
        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        proforma   = Proforma.objects.create(**validated_data)
        for item in items_data:
            if (item.get("description") or "").strip():
                ProformaItem.objects.create(proforma=proforma, **item)
        return proforma

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                if (item.get("description") or "").strip():
                    ProformaItem.objects.create(proforma=instance, **item)
        return instance