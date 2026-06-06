# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/serializers_clients.py
# ─────────────────────────────────────────────────────────────────────────────
from rest_framework import serializers
from .models import BillingClient


class BillingClientSerializer(serializers.ModelSerializer):
    display_name   = serializers.ReadOnlyField()
    can_delete     = serializers.SerializerMethodField()
    invoices_count = serializers.SerializerMethodField()
    proformas_count= serializers.SerializerMethodField()

    class Meta:
        model  = BillingClient
        fields = [
            "id",
            "company_name",
            "contact_name",
            "email",
            "phone",
            "address",
            "tax_id",
            "display_name",
            "can_delete",
            "invoices_count",
            "proformas_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    # ── Validation ─────────────────────────────────────────────────────────────
    def validate_phone(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Le numéro de téléphone est obligatoire.")
        return value.strip()

    def validate(self, attrs):
        company = attrs.get("company_name", "").strip() if attrs.get("company_name") else ""
        contact = attrs.get("contact_name", "").strip() if attrs.get("contact_name") else ""
        # Pour la création : au moins un des deux est requis
        if not self.instance and not company and not contact:
            raise serializers.ValidationError(
                {"company_name": "Le nom de l'entreprise ou du contact est obligatoire."}
            )
        return attrs

    # ── Champs calculés ────────────────────────────────────────────────────────
    def get_can_delete(self, obj):
        return obj.can_delete()

    def get_invoices_count(self, obj):
        return obj.invoices.count()

    def get_proformas_count(self, obj):
        return obj.proformas.count()