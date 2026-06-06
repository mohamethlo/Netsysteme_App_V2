# apps/expenses/serializers.py
from rest_framework import serializers
from .models import Expense, Approvisionnement


class ApprovisionnementSerializer(serializers.ModelSerializer):
    date_str = serializers.SerializerMethodField()

    class Meta:
        model  = Approvisionnement
        fields = ["id", "montant", "date", "date_str", "site", "created_by"]
        read_only_fields = ["id", "created_by"]

    def get_date_str(self, obj):
        return obj.date.strftime("%d/%m/%Y") if obj.date else None


class ExpenseSerializer(serializers.ModelSerializer):
    user_detail       = serializers.SerializerMethodField()
    approved_by_detail= serializers.SerializerMethodField()
    statut_display    = serializers.CharField(source="get_statut_display", read_only=True)
    categorie_display = serializers.CharField(source="get_categorie_display", read_only=True)
    date_str          = serializers.SerializerMethodField()
    deleted_at_str    = serializers.SerializerMethodField()
    is_deleted        = serializers.ReadOnlyField()
    can_restore       = serializers.ReadOnlyField()
    justificatif_url  = serializers.SerializerMethodField()

    class Meta:
        model  = Expense
        fields = [
            "id", "user", "user_detail",
            "titre", "description", "montant",
            "categorie", "categorie_display",
            "date_depense", "date_str",
            "statut", "statut_display",
            "justificatif", "justificatif_url",
            "notes_admin", "site",
            "approved_by", "approved_by_detail", "approved_at",
            "deleted_at", "deleted_at_str",
            "is_deleted", "can_restore",
            "created_at",
        ]
        read_only_fields = ["id", "user", "approved_by", "approved_at", "created_at", "deleted_at"]

    def get_user_detail(self, obj):
        u = obj.user
        if not u:
            return None
        prenom = getattr(u, "prenom", "") or u.first_name or ""
        nom    = getattr(u, "nom",    "") or u.last_name  or ""
        return {"id": u.id, "prenom": prenom, "nom": nom,
                "full_name": f"{prenom} {nom}".strip() or u.username}

    def get_approved_by_detail(self, obj):
        u = obj.approved_by
        if not u:
            return None
        prenom = getattr(u, "prenom", "") or u.first_name or ""
        nom    = getattr(u, "nom",    "") or u.last_name  or ""
        return {"id": u.id, "full_name": f"{prenom} {nom}".strip() or u.username}

    def get_date_str(self, obj):
        return obj.date_depense.strftime("%d/%m/%Y") if obj.date_depense else None

    def get_deleted_at_str(self, obj):
        return obj.deleted_at.strftime("%d/%m/%Y %H:%M") if obj.deleted_at else None

    def get_justificatif_url(self, obj):
        request = self.context.get("request")
        if obj.justificatif and request:
            return request.build_absolute_uri(f"/media/{obj.justificatif}")
        return None