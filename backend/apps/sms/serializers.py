# apps/sms/serializers.py
from rest_framework import serializers
from .models import SMSHistory, SMSTemplate


class SMSHistorySerializer(serializers.ModelSerializer):
    sent_by_name = serializers.SerializerMethodField()
    sent_at_str  = serializers.SerializerMethodField()

    class Meta:
        model  = SMSHistory
        fields = [
            "id", "recipient_name", "phone",
            "message", "message_template",
            "status", "error_message",
            "sent_at", "sent_at_str", "sent_by", "sent_by_name",
            "billing_client_id", "installation_id",
            "provider", "message_id", "cost",
            "sender_domain", "extra_data",
        ]
        read_only_fields = ["id", "sent_at", "sent_by"]

    def get_sent_by_name(self, obj):
        return obj.sent_by.username if obj.sent_by else "—"

    def get_sent_at_str(self, obj):
        return obj.sent_at.strftime("%d/%m/%Y %H:%M") if obj.sent_at else None


class SMSTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = SMSTemplate
        fields = [
            "id", "name", "description", "content",
            "category", "is_active", "usage_count",
            "created_at", "updated_at", "created_by", "created_by_name",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "usage_count"]

    def get_created_by_name(self, obj):
        return obj.created_by.username if obj.created_by else "—"