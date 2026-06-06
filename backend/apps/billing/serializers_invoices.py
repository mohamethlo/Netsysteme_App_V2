# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/serializers_invoices.py
# ─────────────────────────────────────────────────────────────────────────────
from rest_framework import serializers
from .models import Invoice, InvoiceItem
from .serializers_clients import BillingClientSerializer


class InvoiceItemSerializer(serializers.ModelSerializer):
    """Lecture d'une ligne de facture."""
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

    def get_subtotal(self, obj):
        return round(obj.subtotal(), 2)

    def get_subtotal_after_discount(self, obj):
        return round(obj.subtotal_after_discount(), 2)

    def get_product_name(self, obj):
        return obj.product.name if obj.product else None

    def get_product_image_url(self, obj):
        if not obj.product or not obj.product.image_path:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(f"/media/{obj.product.image_path}")
        return f"/media/{obj.product.image_path}"


class InvoiceItemWriteSerializer(serializers.ModelSerializer):
    """Écriture d'une ligne de facture."""
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


class InvoiceSerializer(serializers.ModelSerializer):
    """Lecture complète d'une facture avec tous les calculs."""
    items                   = InvoiceItemSerializer(many=True, read_only=True)
    billing_client_detail   = BillingClientSerializer(source="billing_client", read_only=True)
    status_display          = serializers.CharField(source="get_status_display",  read_only=True)
    domaine_display         = serializers.CharField(source="get_domaine_display", read_only=True)

    # Champs calculés identiques à Flask
    total_ht                = serializers.SerializerMethodField()
    tva_amount              = serializers.SerializerMethodField()
    total_ttc_before_discount = serializers.SerializerMethodField()
    discount_value          = serializers.SerializerMethodField()
    total_ttc               = serializers.SerializerMethodField()
    remaining_balance       = serializers.SerializerMethodField()
    has_advance             = serializers.SerializerMethodField()

    class Meta:
        model  = Invoice
        fields = [
            "id", "invoice_number",
            "billing_client", "billing_client_detail",
            "installation",
            "date", "due_date",
            "tax_rate", "status", "status_display",
            "notes", "domaine", "domaine_display",
            "discount_percent", "discount_amount", "advance_amount",
            "items",
            "total_ht", "tva_amount",
            "total_ttc_before_discount", "discount_value",
            "total_ttc", "remaining_balance", "has_advance",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_total_ht(self, obj):
        return round(obj.total_amount(), 2)

    def get_tva_amount(self, obj):
        return round(obj.tax_amount(), 2)

    def get_total_ttc_before_discount(self, obj):
        return round(obj.total_before_discount(), 2)

    def get_discount_value(self, obj):
        return round(obj.discount_value(), 2)

    def get_total_ttc(self, obj):
        return round(obj.total_with_tax_and_discount(), 2)

    def get_remaining_balance(self, obj):
        return round(obj.remaining_balance(), 2)

    def get_has_advance(self, obj):
        return obj.has_advance()


class InvoiceWriteSerializer(serializers.ModelSerializer):
    """Création / modification d'une facture avec ses lignes."""
    items = InvoiceItemWriteSerializer(many=True)

    class Meta:
        model  = Invoice
        fields = [
            "invoice_number", "billing_client", "installation",
            "date", "due_date", "tax_rate",
            "status", "notes", "domaine",
            "discount_percent", "discount_amount", "advance_amount",
            "items",
        ]

    def validate_invoice_number(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Le numéro de facture est obligatoire.")
        return value.strip()

    def validate_items(self, items):
        valid = [it for it in items if it.get("description", "").strip()]
        if not valid:
            raise serializers.ValidationError("La facture doit contenir au moins un article.")
        return items

    def validate(self, attrs):
        if not attrs.get("billing_client"):
            raise serializers.ValidationError({"billing_client": "Un client doit être sélectionné."})
        if not attrs.get("domaine"):
            raise serializers.ValidationError({"domaine": "Veuillez sélectionner un domaine (NETSYSTEME ou SSE)."})
        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        invoice    = Invoice.objects.create(**validated_data)
        for item in items_data:
            if item.get("description", "").strip():
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
                if item.get("description", "").strip():
                    InvoiceItem.objects.create(invoice=instance, **item)
        return instance


class InvoiceDashboardSerializer(serializers.Serializer):
    """Stats pour le mini-dashboard facturation."""
    total_factures        = serializers.IntegerField()
    brouillons            = serializers.IntegerField()
    confirmees            = serializers.IntegerField()
    payees                = serializers.IntegerField()
    montant_total         = serializers.FloatField()
    montant_en_attente    = serializers.FloatField()
    recent                = InvoiceSerializer(many=True)