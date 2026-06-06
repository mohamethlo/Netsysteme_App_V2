# apps/assignments/serializers.py
from rest_framework import serializers
from .models import TechnicianAssignment


class TechnicianAssignmentSerializer(serializers.ModelSerializer):
    technician_name   = serializers.SerializerMethodField()
    technician_phone  = serializers.SerializerMethodField()
    location_name     = serializers.SerializerMethodField()
    assigned_by_name  = serializers.SerializerMethodField()
    assigned_at_str   = serializers.SerializerMethodField()
    unassigned_at_str = serializers.SerializerMethodField()
    duration_minutes  = serializers.ReadOnlyField()
    duration_hours    = serializers.ReadOnlyField()

    class Meta:
        model  = TechnicianAssignment
        fields = [
            "id", "technician", "technician_name", "technician_phone",
            "work_location", "location_name",
            "date", "assigned_at", "assigned_at_str",
            "unassigned_at", "unassigned_at_str",
            "assigned_by", "assigned_by_name",
            "is_active", "duration_minutes", "duration_hours",
        ]
        read_only_fields = ["id", "assigned_at", "assigned_by"]

    def _full_name(self, user):
        if not user:
            return "—"
        fn = getattr(user, "prenom", "") or user.first_name or ""
        ln = getattr(user, "nom", "")   or user.last_name  or ""
        return f"{fn} {ln}".strip() or user.username

    def get_technician_name(self, obj):
        return self._full_name(obj.technician)

    def get_technician_phone(self, obj):
        return getattr(obj.technician, "telephone", None) or getattr(obj.technician, "phone", None) or ""

    def get_location_name(self, obj):
        return obj.work_location.name if obj.work_location else "—"

    def get_assigned_by_name(self, obj):
        return self._full_name(obj.assigned_by)

    def get_assigned_at_str(self, obj):
        return obj.assigned_at.strftime("%H:%M") if obj.assigned_at else None

    def get_unassigned_at_str(self, obj):
        return obj.unassigned_at.strftime("%H:%M") if obj.unassigned_at else "En cours"