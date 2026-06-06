# apps/attendance/serializers.py
import math
from rest_framework import serializers
from .models import Attendance, WorkLocation


class WorkLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = WorkLocation
        fields = ["id", "name", "latitude", "longitude", "radius", "address", "type", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class AttendanceUserSerializer(serializers.Serializer):
    """Utilisateur inline pour l'historique."""
    id        = serializers.IntegerField()
    full_name = serializers.SerializerMethodField()
    prenom    = serializers.CharField()
    nom       = serializers.CharField()

    def get_full_name(self, obj):
        prenom = getattr(obj, "prenom", "") or ""
        nom    = getattr(obj, "nom",    "") or ""
        return f"{prenom} {nom}".strip() or obj.username


class AttendanceSerializer(serializers.ModelSerializer):
    user_detail        = serializers.SerializerMethodField()
    total_hours        = serializers.ReadOnlyField()
    is_late            = serializers.ReadOnlyField()
    needs_justification= serializers.ReadOnlyField()
    status_display     = serializers.CharField(source="get_status_display", read_only=True)
    work_location_name = serializers.SerializerMethodField()
    work_location_type = serializers.SerializerMethodField()
    check_in_str       = serializers.SerializerMethodField()
    check_out_str      = serializers.SerializerMethodField()

    class Meta:
        model  = Attendance
        fields = [
            "id", "user", "user_detail", "date",
            "check_in", "check_out", "check_in_str", "check_out_str",
            "check_in_location", "check_out_location",
            "check_in_lat", "check_in_lng",
            "check_out_lat", "check_out_lng",
            "work_location", "work_location_name", "work_location_type",
            "status", "status_display", "notes",
            "total_hours", "is_late", "needs_justification",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_user_detail(self, obj):
        u = obj.user
        if not u:
            return None
        prenom = getattr(u, "prenom", "") or u.first_name or ""
        nom    = getattr(u, "nom",    "") or u.last_name  or ""
        return {"id": u.id, "prenom": prenom, "nom": nom,
                "full_name": f"{prenom} {nom}".strip() or u.username}

    def get_work_location_name(self, obj):
        return obj.work_location.name if obj.work_location else None

    def get_work_location_type(self, obj):
        return obj.work_location.type if obj.work_location else None

    def get_check_in_str(self, obj):
        return obj.check_in.strftime("%H:%M") if obj.check_in else None

    def get_check_out_str(self, obj):
        return obj.check_out.strftime("%H:%M") if obj.check_out else None


class DailySummarySerializer(serializers.Serializer):
    """Résumé présents / absents / retards du jour."""
    presents = AttendanceUserSerializer(many=True)
    absents  = AttendanceUserSerializer(many=True)
    retards  = AttendanceUserSerializer(many=True)
    date     = serializers.DateField()