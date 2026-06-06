from rest_framework import serializers
from .models import Devis, LigneDevis


def _nom(u):
    if u is None:
        return None
    prenom = getattr(u, "prenom", "") or ""
    nom    = getattr(u, "nom",    "") or ""
    return f"{prenom} {nom}".strip() or getattr(u, "username", str(u.id))


class LigneDevisSerializer(serializers.ModelSerializer):
    class Meta:
        model  = LigneDevis
        fields = ["id", "designation", "quantite", "prix_unitaire"]


class DevisSerializer(serializers.ModelSerializer):
    user_nom        = serializers.SerializerMethodField()
    technicien_nom  = serializers.SerializerMethodField()
    status_display  = serializers.CharField(source="get_status_display", read_only=True)
    lignes          = LigneDevisSerializer(many=True, read_only=True)

    class Meta:
        model  = Devis
        fields = [
            "id", "nom", "prenom", "telephone", "commentaire",
            "status", "status_display", "created_at",
            "user", "user_nom",
            "assigned_to", "technicien_nom",
            "lignes",
        ]
        read_only_fields = ["created_at", "user", "status"]

    def get_user_nom(self, obj):
        return _nom(obj.user)

    def get_technicien_nom(self, obj):
        return _nom(obj.assigned_to)
