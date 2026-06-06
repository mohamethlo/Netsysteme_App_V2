from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Outil, ReservationOutil

User = get_user_model()


class ChantierLazyField(serializers.PrimaryKeyRelatedField):
    """PrimaryKeyRelatedField dont le queryset est résolu à la requête (évite l'import circulaire)."""
    def get_queryset(self):
        from apps.chantiers.models import Chantier
        return Chantier.objects.all()


class OutilSerializer(serializers.ModelSerializer):
    categorie_display    = serializers.CharField(source="get_categorie_display", read_only=True)
    quantite_disponible  = serializers.IntegerField(read_only=True)

    class Meta:
        model  = Outil
        fields = [
            "id", "nom", "categorie", "categorie_display",
            "description", "quantite_totale", "quantite_disponible",
            "numero_serie", "is_active", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class UserMiniSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = ["id", "full_name", "prenom", "nom"]

    def get_full_name(self, obj):
        return f"{obj.prenom} {obj.nom}".strip() or obj.username


class ReservationOutilSerializer(serializers.ModelSerializer):
    outil_detail      = OutilSerializer(source="outil", read_only=True)
    technicien_detail = UserMiniSerializer(source="technicien", read_only=True)
    chantier_nom      = serializers.SerializerMethodField()
    statut_display    = serializers.CharField(source="get_statut_display", read_only=True)

    outil_id      = serializers.PrimaryKeyRelatedField(
        source="outil", queryset=Outil.objects.filter(is_active=True), write_only=True,
    )
    technicien_id = serializers.PrimaryKeyRelatedField(
        source="technicien", queryset=User.objects.filter(is_active=True), write_only=True,
    )
    chantier_id   = ChantierLazyField(
        source="chantier", write_only=True, required=False, allow_null=True,
    )

    class Meta:
        model  = ReservationOutil
        fields = [
            "id", "outil", "outil_id", "outil_detail",
            "technicien", "technicien_id", "technicien_detail",
            "chantier", "chantier_id", "chantier_nom",
            "date_debut", "heure_debut", "date_fin", "heure_fin", "quantite",
            "statut", "statut_display", "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "outil", "technicien", "chantier", "created_at", "updated_at"]

    def get_chantier_nom(self, obj):
        return obj.chantier.nom if obj.chantier else None

    def validate(self, data):
        if data.get("date_debut") and data.get("date_fin"):
            if data["date_fin"] < data["date_debut"]:
                raise serializers.ValidationError("La date de fin doit être après la date de début.")
        return data
