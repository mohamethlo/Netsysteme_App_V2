# ─────────────────────────────────────────────────────────────────────────────
#  apps/installations/serializers.py
# ─────────────────────────────────────────────────────────────────────────────
from rest_framework import serializers
from .models import Installation, InstallationProduct


class InstallationProductSerializer(serializers.ModelSerializer):
    product_name      = serializers.SerializerMethodField()
    product_image_url = serializers.SerializerMethodField()

    class Meta:
        model  = InstallationProduct
        fields = [
            "id", "product", "product_name", "product_image_url",
            "quantity", "unit_price", "total_price", "created_at",
        ]

    def get_product_name(self, obj):
        return obj.product.name if obj.product else None

    def get_product_image_url(self, obj):
        if not obj.product or not obj.product.image_path:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(f"/media/{obj.product.image_path}")
        return f"/media/{obj.product.image_path}"


class InstallationProductWriteSerializer(serializers.Serializer):
    product_id  = serializers.IntegerField()
    quantity    = serializers.IntegerField(min_value=1)
    unit_price  = serializers.FloatField(min_value=0)
    total_price = serializers.FloatField(min_value=0)


# ── User inline (pour agent & techniciens) ─────────────────────────────────────
class UserInlineSerializer(serializers.Serializer):
    id     = serializers.IntegerField()
    prenom = serializers.CharField()
    nom    = serializers.CharField()
    full_name = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        prenom = getattr(obj, "prenom", None) or ""
        nom    = getattr(obj, "nom",    None) or ""
        return f"{prenom} {nom}".strip() or obj.username


class InstallationSerializer(serializers.ModelSerializer):
    products             = InstallationProductSerializer(many=True, read_only=True)
    agent_commercial_detail = serializers.SerializerMethodField()
    techniciens_detail   = serializers.SerializerMethodField()
    statut_display       = serializers.CharField(source="get_statut_display",  read_only=True)
    methode_display      = serializers.CharField(source="get_methode_paiement_display", read_only=True)
    client_name          = serializers.ReadOnlyField()
    is_paid              = serializers.ReadOnlyField()
    payment_schedule     = serializers.SerializerMethodField()
    contrat_url          = serializers.SerializerMethodField()

    class Meta:
        model  = Installation
        fields = [
            "id",
            "prenom", "nom", "telephone",
            "adresse", "rccm", "immatricule", "ninea",
            "montant_total", "montant_avance", "montant_restant",
            "date_installation", "methode_paiement", "methode_display",
            "date_echeance", "contrat_path", "contrat_url",
            "statut", "statut_display",
            "agent_commercial", "agent_commercial_detail",
            "techniciens", "techniciens_detail",
            "products",
            "client_name", "is_paid", "payment_schedule",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_agent_commercial_detail(self, obj):
        if not obj.agent_commercial:
            return None
        u = obj.agent_commercial
        prenom = getattr(u, "prenom", None) or ""
        nom    = getattr(u, "nom",    None) or ""
        return {"id": u.id, "prenom": prenom, "nom": nom, "full_name": f"{prenom} {nom}".strip() or u.username}

    def get_techniciens_detail(self, obj):
        result = []
        for u in obj.techniciens.all():
            prenom = getattr(u, "prenom", None) or ""
            nom    = getattr(u, "nom",    None) or ""
            result.append({"id": u.id, "prenom": prenom, "nom": nom, "full_name": f"{prenom} {nom}".strip() or u.username})
        return result

    def get_payment_schedule(self, obj):
        try:
            return obj.get_payment_schedule()
        except Exception:
            return []

    def get_contrat_url(self, obj):
        if not obj.contrat_path:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(f"/media/{obj.contrat_path}")
        return f"/media/{obj.contrat_path}"


class InstallationWriteSerializer(serializers.ModelSerializer):
    products_data   = InstallationProductWriteSerializer(many=True, write_only=True, required=False)
    techniciens_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False, default=list
    )
    invoice_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model  = Installation
        fields = [
            "prenom", "nom", "telephone",
            "adresse", "rccm", "immatricule", "ninea",
            "montant_total", "montant_avance", "montant_restant",
            "date_installation", "methode_paiement", "date_echeance",
            "statut", "agent_commercial",
            "techniciens_ids", "products_data", "invoice_id",
        ]

    def validate_telephone(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Le téléphone est obligatoire.")
        return value.strip()

    def validate(self, attrs):
        if not attrs.get("prenom") and not attrs.get("nom"):
            raise serializers.ValidationError({"prenom": "Le prénom ou le nom est obligatoire."})
        total  = attrs.get("montant_total", 0)
        avance = attrs.get("montant_avance", 0)
        attrs["montant_restant"] = max(0, total - avance)
        return attrs

    def _handle_relations(self, installation, techniciens_ids, products_data, invoice_id):
        from django.contrib.auth import get_user_model
        from apps.billing.models import Product, Invoice as InvoiceModel

        User = get_user_model()

        # Techniciens
        if techniciens_ids is not None:
            techs = User.objects.filter(id__in=techniciens_ids)
            installation.techniciens.set(techs)

        # Produits — supprime + recrée
        if products_data is not None:
            installation.products.all().delete()
            for pd in products_data:
                try:
                    product = Product.objects.get(id=pd["product_id"])
                except Product.DoesNotExist:
                    product = None
                InstallationProduct.objects.create(
                    installation=installation,
                    product=product,
                    quantity=pd["quantity"],
                    unit_price=pd["unit_price"],
                    total_price=pd["total_price"],
                )

        # Liaison facture
        if invoice_id is not None:
            try:
                invoice = InvoiceModel.objects.get(id=invoice_id)
                invoice.installation_id = installation.id
                invoice.save(update_fields=["installation_id"])
            except InvoiceModel.DoesNotExist:
                pass

    def create(self, validated_data):
        from django.db import transaction
        techniciens_ids = validated_data.pop("techniciens_ids", [])
        products_data   = validated_data.pop("products_data",   [])
        invoice_id      = validated_data.pop("invoice_id",      None)

        with transaction.atomic():
            installation = Installation.objects.create(**validated_data)
            self._handle_relations(installation, techniciens_ids, products_data, invoice_id)
        return installation

    def update(self, instance, validated_data):
        from django.db import transaction
        techniciens_ids = validated_data.pop("techniciens_ids", None)
        products_data   = validated_data.pop("products_data",   None)
        invoice_id      = validated_data.pop("invoice_id",      None)

        with transaction.atomic():
            # Détacher l'ancienne facture liée
            from apps.billing.models import Invoice as InvoiceModel
            InvoiceModel.objects.filter(installation_id=instance.id).update(installation_id=None)

            for attr, val in validated_data.items():
                setattr(instance, attr, val)
            instance.save()
            self._handle_relations(instance, techniciens_ids, products_data, invoice_id)
        return instance