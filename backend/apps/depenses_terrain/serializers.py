from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import DepenseTerrain, JustificatifDepense

User = get_user_model()


class ChantierLazyField(serializers.PrimaryKeyRelatedField):
    def get_queryset(self):
        from apps.chantiers.models import Chantier
        return Chantier.objects.all()


class UserMiniSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "full_name", "prenom", "nom"]

    def get_full_name(self, obj):
        return f"{obj.prenom} {obj.nom}".strip() or obj.username


class JustificatifSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = JustificatifDepense
        fields = ["id", "nom", "fichier", "url", "uploaded_at"]
        read_only_fields = ["id", "uploaded_at"]

    def get_url(self, obj):
        request = self.context.get("request")
        if request and obj.fichier:
            return request.build_absolute_uri(obj.fichier.url)
        return obj.fichier.url if obj.fichier else None


class DepenseTerrainSerializer(serializers.ModelSerializer):
    technicien_detail = UserMiniSerializer(source="technicien", read_only=True)
    type_display      = serializers.CharField(source="get_type_depense_display", read_only=True)
    statut_display    = serializers.CharField(source="get_statut_display", read_only=True)
    chantier_nom      = serializers.SerializerMethodField()
    justificatifs     = JustificatifSerializer(many=True, read_only=True)

    technicien_id = serializers.PrimaryKeyRelatedField(
        source="technicien",
        queryset=User.objects.filter(is_active=True),
        write_only=True,
    )
    chantier_id = ChantierLazyField(
        source="chantier", write_only=True, required=False, allow_null=True,
    )

    class Meta:
        model = DepenseTerrain
        fields = [
            "id",
            "technicien", "technicien_id", "technicien_detail",
            "chantier", "chantier_id", "chantier_nom",
            "type_depense", "type_display",
            "description", "montant", "date_depense",
            "statut", "statut_display", "notes_admin",
            "justificatifs",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "technicien", "chantier", "statut", "created_at", "updated_at"]

    def get_chantier_nom(self, obj):
        return obj.chantier.nom if obj.chantier else None


class JustificatifUploadSerializer(serializers.Serializer):
    fichier = serializers.FileField()
    nom     = serializers.CharField(max_length=255, required=False)

    def validate_fichier(self, value):
        allowed = [".jpg", ".jpeg", ".png", ".pdf", ".webp"]
        import os
        ext = os.path.splitext(value.name)[1].lower()
        if ext not in allowed:
            raise serializers.ValidationError(
                f"Format non autorisé. Formats acceptés : {', '.join(allowed)}"
            )
        if value.size > 10 * 1024 * 1024:  # 10 MB
            raise serializers.ValidationError("Le fichier ne doit pas dépasser 10 Mo.")
        return value
