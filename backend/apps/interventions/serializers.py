from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Intervention, InterventionMaterial

User = get_user_model()


def _user_nom(u) -> str:
    """Compatible avec User NETSYSTEME (prenom/nom)."""
    if u is None:
        return ""
    prenom = getattr(u, "prenom", "") or ""
    nom    = getattr(u, "nom",    "") or ""
    return f"{prenom} {nom}".strip() or getattr(u, "username", str(u.id))


class InterventionMaterialSerializer(serializers.ModelSerializer):
    article_name = serializers.CharField(source="article.name", read_only=True)

    class Meta:
        model  = InterventionMaterial
        fields = ["id", "article", "article_name", "nom_article", "quantite", "quantite_utilisee"]


class InterventionSerializer(serializers.ModelSerializer):
    technicien_nom             = serializers.SerializerMethodField()
    responsable_nom            = serializers.SerializerMethodField()
    client_nom                 = serializers.SerializerMethodField()
    created_by_nom             = serializers.SerializerMethodField()
    autres_intervenants_detail = serializers.SerializerMethodField()
    materiels                  = InterventionMaterialSerializer(many=True, read_only=True)
    statut_display             = serializers.CharField(source="get_statut_display",   read_only=True)
    priorite_display           = serializers.CharField(source="get_priorite_display", read_only=True)

    class Meta:
        model        = Intervention
        fields       = "__all__"
        read_only_fields = ["created_at", "updated_at", "created_by"]

    def get_technicien_nom(self, obj):
        return _user_nom(obj.technicien)

    def get_responsable_nom(self, obj):
        return _user_nom(obj.responsable)

    def get_client_nom(self, obj):
        if obj.client:
            name = f"{obj.client.nom or ''} {obj.client.prenom or ''}".strip()
            if hasattr(obj.client, "entreprise") and obj.client.entreprise:
                name += f" ({obj.client.entreprise})"
            return name or None
        if obj.client_libre_nom:
            return obj.client_libre_nom
        return None

    def get_created_by_nom(self, obj):
        return _user_nom(obj.created_by)

    def get_autres_intervenants_detail(self, obj):
        return [
            {"id": u.id, "nom": _user_nom(u)}
            for u in obj.autres_intervenants.all()
        ]


class InterventionWriteSerializer(serializers.ModelSerializer):
    autres_intervenants = serializers.PrimaryKeyRelatedField(
        many=True, queryset=User.objects.all(), required=False
    )
    materiels_data = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )

    # ── Champs heure — acceptent "" comme null ────────────────────────────────
    heure_arrivee = serializers.TimeField(required=False, allow_null=True)
    heure_depart  = serializers.TimeField(required=False, allow_null=True)

    class Meta:
        model        = Intervention
        fields       = "__all__"
        read_only_fields = ["created_at", "updated_at", "created_by"]

    def to_internal_value(self, data):
        # Convertit les chaînes vides en None pour tous les champs Time et CharField optionnels
        mutable = data.copy() if hasattr(data, "copy") else dict(data)
        for field in ["heure_arrivee", "heure_depart", "taches_realisees",
                      "observations_technicien", "id_dvr_nvr", "mdp_dvr_nvr",
                      "client", "titre"]:
            if mutable.get(field) == "":
                mutable[field] = None
        return super().to_internal_value(mutable)

    def create(self, validated_data):
        materiels_data      = validated_data.pop("materiels_data", [])
        autres_intervenants = validated_data.pop("autres_intervenants", [])
        intervention        = Intervention.objects.create(**validated_data)
        intervention.autres_intervenants.set(autres_intervenants)
        for m in materiels_data:
            InterventionMaterial.objects.create(intervention=intervention, **m)
        return intervention

    def update(self, instance, validated_data):
        materiels_data      = validated_data.pop("materiels_data", None)
        autres_intervenants = validated_data.pop("autres_intervenants", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if autres_intervenants is not None:
            instance.autres_intervenants.set(autres_intervenants)
        if materiels_data is not None:
            instance.materiels.all().delete()
            for m in materiels_data:
                InterventionMaterial.objects.create(intervention=instance, **m)
        return instance