from rest_framework import serializers
from .models import SalaryAdvance


def _nom(u):
    if u is None:
        return None
    prenom = getattr(u, "prenom", "") or ""
    nom    = getattr(u, "nom",    "") or ""
    return f"{prenom} {nom}".strip() or getattr(u, "username", str(u.id))


class SalaryAdvanceSerializer(serializers.ModelSerializer):
    user_nom        = serializers.SerializerMethodField()
    approved_by_nom = serializers.SerializerMethodField()
    statut_display  = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model  = SalaryAdvance
        fields = [
            "id", "user", "user_nom",
            "montant", "motif", "date_demande",
            "statut", "statut_display", "notes_admin",
            "created_at", "approved_at",
            "approved_by", "approved_by_nom",
        ]
        read_only_fields = [
            "user", "statut", "approved_at",
            "approved_by", "created_at",
        ]

    def get_user_nom(self, obj):
        return _nom(obj.user)

    def get_approved_by_nom(self, obj):
        return _nom(obj.approved_by)