from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Chantier

User = get_user_model()


class UserMiniSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = ["id", "full_name", "prenom", "nom"]

    def get_full_name(self, obj):
        return f"{obj.prenom} {obj.nom}".strip() or obj.username


class ChantierSerializer(serializers.ModelSerializer):
    responsable_detail  = UserMiniSerializer(source="responsable", read_only=True)
    techniciens_detail  = UserMiniSerializer(source="techniciens", many=True, read_only=True)
    techniciens_ids     = serializers.PrimaryKeyRelatedField(
        source="techniciens", many=True,
        queryset=User.objects.all(), write_only=True, required=False,
    )
    responsable_id      = serializers.PrimaryKeyRelatedField(
        source="responsable", queryset=User.objects.all(),
        write_only=True, required=False, allow_null=True,
    )
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model  = Chantier
        fields = [
            "id", "nom", "description", "adresse",
            "date_debut", "date_fin_prevue", "date_fin_reelle",
            "statut", "statut_display",
            "responsable", "responsable_id", "responsable_detail",
            "techniciens", "techniciens_ids", "techniciens_detail",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "responsable", "techniciens"]
