# apps/clients/serializers.py
from rest_framework import serializers
from .models import Client, Reminder, CallHistory, ClientImportHistory


class ReminderSerializer(serializers.ModelSerializer):
    remind_at_str  = serializers.SerializerMethodField()
    created_at_str = serializers.SerializerMethodField()

    class Meta:
        model  = Reminder
        fields = ["id", "client", "user", "remind_at", "remind_at_str", "notes", "created_at", "created_at_str"]
        read_only_fields = ["id", "user", "created_at"]

    def get_remind_at_str(self, obj):
        return obj.remind_at.strftime("%d/%m/%Y %H:%M") if obj.remind_at else None

    def get_created_at_str(self, obj):
        return obj.created_at.strftime("%d/%m/%Y %H:%M") if obj.created_at else None


class CallHistorySerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    date_appel_str  = serializers.SerializerMethodField()

    class Meta:
        model  = CallHistory
        fields = [
            "id", "client", "created_by", "created_by_name",
            "nom", "prenom", "adresse", "contact_1", "contact_2",
            "resultat_appel", "categorie",
            "motif_principal", "motif_refus", "motif_refus_detail", "moratoire",
            "commentaires",
            "date_appel", "date_appel_str",
            "date_installation", "date_maintenance_1", "date_maintenance_2",
            "created_at",
        ]
        read_only_fields = ["id", "created_by", "created_at"]

    def get_created_by_name(self, obj):
        return obj.created_by.username if obj.created_by else "Inconnu"

    def get_date_appel_str(self, obj):
        return obj.date_appel.strftime("%d/%m/%Y") if obj.date_appel else None


class ClientSerializer(serializers.ModelSerializer):
    display_name      = serializers.ReadOnlyField()
    type_display      = serializers.CharField(source="get_type_client_display", read_only=True)
    assigned_to_name  = serializers.SerializerMethodField()
    next_reminder     = serializers.SerializerMethodField()
    created_at_str    = serializers.SerializerMethodField()
    converted_by_name = serializers.SerializerMethodField()
    last_call_comment = serializers.SerializerMethodField()  # ← AJOUT

    class Meta:
        model  = Client
        fields = [
            "id", "nom", "prenom", "display_name",
            "entreprise", "email", "telephone",
            "adresse", "ville", "code_postal",
            "type_client", "type_display",
            "assigned_to", "assigned_to_name",
            "is_blacklisted", "date_blacklisted",
            "note_conversion", "converted_by", "converted_by_name", "converted_at",
            "import_history",
            "next_reminder",
            "last_call_comment",  # ← AJOUT
            "created_at", "created_at_str",
        ]
        read_only_fields = ["id", "created_at", "converted_by", "converted_at"]

    def get_assigned_to_name(self, obj):
        u = obj.assigned_to
        if not u:
            return None
        prenom = getattr(u, "prenom", "") or u.first_name or ""
        nom    = getattr(u, "nom",    "") or u.last_name  or ""
        return f"{prenom} {nom}".strip() or u.username

    def get_converted_by_name(self, obj):
        u = obj.converted_by
        if not u:
            return None
        prenom = getattr(u, "prenom", "") or u.first_name or ""
        nom    = getattr(u, "nom",    "") or u.last_name  or ""
        return f"{prenom} {nom}".strip() or u.username

    def get_next_reminder(self, obj):
        r = obj.next_reminder
        if not r:
            return None
        return {
            "id":            r.id,
            "notes":         r.notes,
            "remind_at":     r.remind_at.isoformat() if r.remind_at else None,
            "remind_at_str": r.remind_at.strftime("%d/%m/%Y %H:%M") if r.remind_at else None,
            "created_at":    r.created_at.strftime("%d/%m/%Y %H:%M"),
        }

    def get_created_at_str(self, obj):
        return obj.created_at.strftime("%d/%m/%Y") if obj.created_at else None

    # ── AJOUT ─────────────────────────────────────────────────────────────────
    def get_last_call_comment(self, obj):
        last = obj.call_history.order_by("-created_at").first()
        if not last:
            return None
        return {
            "resultat_appel": last.resultat_appel,
            "commentaires":   last.commentaires,
            "motif_principal": last.motif_principal,
            "motif_refus":    last.motif_refus,
            "date_appel_str": last.date_appel.strftime("%d/%m/%Y") if last.date_appel else None,
            "created_by":     last.created_by.username if last.created_by else None,
        }
    # ──────────────────────────────────────────────────────────────────────────