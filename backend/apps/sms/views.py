# apps/sms/views.py
import csv
import datetime
import io
import os
import logging

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from .models import SMSHistory, SMSTemplate
from .serializers import SMSHistorySerializer, SMSTemplateSerializer
from .orange_service import OrangeSMSService, personalize_message

logger = logging.getLogger(__name__)


def _safe_str(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _period_filter(qs, period, field="sent_at"):
    now = timezone.now()
    if period == "today":
        qs = qs.filter(**{f"{field}__date": now.date()})
    elif period == "week":
        qs = qs.filter(**{f"{field}__gte": now - datetime.timedelta(days=7)})
    elif period == "month":
        qs = qs.filter(**{f"{field}__year": now.year, f"{field}__month": now.month})
    return qs


class SMSHistoryViewSet(viewsets.ModelViewSet):
    serializer_class   = SMSHistorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["status", "sender_domain"]
    search_fields      = ["recipient_name", "phone", "message"]
    ordering_fields    = ["sent_at"]

    def get_queryset(self):
        qs = SMSHistory.objects.select_related("sent_by").order_by("-sent_at")
        period = self.request.query_params.get("period")
        if period:
            qs = _period_filter(qs, period)
        return qs

    def perform_create(self, serializer):
        serializer.save(sent_by=self.request.user)

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        qs    = SMSHistory.objects.filter(sent_by=request.user)
        total = qs.count()
        succ  = qs.filter(status="success").count()
        fail  = qs.filter(status="failed").count()
        today = qs.filter(sent_at__date=timezone.now().date()).count()
        month = qs.filter(
            sent_at__year=timezone.now().year,
            sent_at__month=timezone.now().month,
        ).count()
        return Response({
            "total": total, "success": succ, "failed": fail,
            "today": today, "month": month,
            "success_rate": round(succ / total * 100, 1) if total else 0,
        })

    @action(detail=False, methods=["get"], url_path="domains")
    def domains(self, request):
        domains = []
        if os.environ.get("ORANGE_CLIENT_ID") and os.environ.get("ORANGE_CLIENT_SECRET"):
            domains.append({"value": "NETSYSTEME", "label": "NETSYSTEME",
                            "sender_name": os.environ.get("ORANGE_SENDER_NAME", "NETSYSTEME")})
        if os.environ.get("ORANGE_CLIENT_ID_SSE") and os.environ.get("ORANGE_CLIENT_SECRET_SSE"):
            domains.append({"value": "SSE", "label": "SSE",
                            "sender_name": os.environ.get("ORANGE_SENDER_NAME_SSE", "SSE")})
        if not domains:
            domains = [
                {"value": "NETSYSTEME", "label": "NETSYSTEME", "sender_name": "NETSYSTEME"},
                {"value": "SSE",        "label": "SSE",        "sender_name": "SSE"},
            ]
        return Response({"success": True, "domains": domains})

    @action(detail=False, methods=["post"], url_path="send-quick")
    def send_quick(self, request):
        # ── Log complet pour diagnostiquer ce qui arrive ──────────────────────
        logger.warning("=== send_quick DEBUG ===")
        logger.warning("Content-Type : %s", request.content_type)
        logger.warning("request.data : %s", dict(request.data))
        logger.warning("========================")

        phone          = _safe_str(request.data.get("phone"))
        message        = _safe_str(request.data.get("message"))
        recipient_name = _safe_str(request.data.get("recipient_name")) or "Destinataire"
        sender_domain  = _safe_str(request.data.get("sender_domain") or "NETSYSTEME").upper()

        logger.warning("phone=%r  message_len=%d  domain=%r", phone, len(message), sender_domain)

        if not phone:
            return Response(
                {"success": False, "message": f"Numéro requis. Reçu: phone={request.data.get('phone')!r}"},
                status=400,
            )
        if not message:
            return Response({"success": False, "message": "Message requis."}, status=400)
        if sender_domain not in ("NETSYSTEME", "SSE"):
            return Response({"success": False, "message": "Domaine invalide."}, status=400)

        record = SMSHistory.objects.create(
            recipient_name=recipient_name,
            phone=phone, message=message,
            status="pending", sent_by=request.user,
            sender_domain=sender_domain,
        )

        svc    = OrangeSMSService(sender_domain)
        result = svc.send_sms(phone, message)

        if result.get("success"):
            record.status = "success"
            try:
                record.message_id = str(
                    result.get("data", {})
                    .get("outboundSMSMessageRequest", {})
                    .get("resourceReference", {})
                    .get("resourceURL", "")
                )
            except Exception:
                pass
        else:
            record.status        = "failed"
            record.error_message = result.get("message", "Erreur inconnue")

        record.save(update_fields=["status", "message_id", "error_message"])
        return Response(result)

    @action(detail=False, methods=["post"], url_path="send-bulk")
    def send_bulk(self, request):
        sender_domain = _safe_str(request.data.get("sender_domain") or "NETSYSTEME").upper()
        template      = _safe_str(request.data.get("message_template"))
        recipients    = request.data.get("recipients") or []
        client_ids    = request.data.get("billing_client_ids") or []

        if sender_domain not in ("NETSYSTEME", "SSE"):
            return Response({"success": False, "message": "Domaine invalide."}, status=400)

        if client_ids and not recipients:
            try:
                from apps.billing.models import BillingClient
                for c in BillingClient.objects.filter(id__in=client_ids, phone__isnull=False):
                    data = {
                        "entreprise": c.company_name or "",
                        "contact":    c.contact_name or "",
                        "prenom":     (c.contact_name or "").split()[0] if c.contact_name else "",
                        "email":      c.email or "",
                        "telephone":  c.phone or "",
                        "ville":      "",
                    }
                    recipients.append({
                        "phone":     c.phone,
                        "name":      c.contact_name or c.company_name,
                        "message":   personalize_message(template, data),
                        "client_id": c.id,
                    })
            except ImportError:
                pass

        if not recipients:
            return Response({"success": False, "message": "Aucun destinataire valide."}, status=400)

        records = {}
        for r in recipients:
            phone = _safe_str(r.get("phone"))
            rec = SMSHistory.objects.create(
                recipient_name=_safe_str(r.get("name")),
                phone=phone,
                message=_safe_str(r.get("message") or template),
                message_template=template,
                status="pending", sent_by=request.user,
                sender_domain=sender_domain,
                billing_client_id=r.get("client_id"),
            )
            records[phone] = rec

        svc     = OrangeSMSService(sender_domain)
        results = svc.send_bulk_sms(recipients)

        success_phones = {s["phone"] for s in results["success"]}
        for phone, rec in records.items():
            if phone in success_phones:
                rec.status = "success"
            else:
                failed = next((f for f in results["failed"] if f["phone"] == phone), None)
                rec.status        = "failed"
                rec.error_message = failed["error"] if failed else "Erreur inconnue"
            rec.save(update_fields=["status", "error_message"])

        return Response({
            "success": True,
            "message": f"{len(results['success'])} SMS envoyé(s) avec succès.",
            "results": results,
        })

    @action(detail=False, methods=["get"], url_path="export-csv")
    def export_csv(self, request):
        qs = self.get_queryset()
        if request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"])
        if request.query_params.get("sender_domain"):
            qs = qs.filter(sender_domain=request.query_params["sender_domain"])

        output = io.StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerow(["ID", "Date & Heure", "Destinataire", "Numéro", "Domaine", "Message", "Statut", "Erreur"])
        for s in qs:
            writer.writerow([
                s.id,
                s.sent_at.strftime("%d/%m/%Y %H:%M:%S") if s.sent_at else "",
                s.recipient_name or "", s.phone or "",
                s.sender_domain or "", s.message or "",
                s.status or "", s.error_message or "",
            ])
        resp = HttpResponse("\ufeff" + output.getvalue(), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = (
            f'attachment; filename="historique_sms_'
            f'{datetime.datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"'
        )
        return resp


class SMSTemplateViewSet(viewsets.ModelViewSet):
    serializer_class   = SMSTemplateSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, SearchFilter]
    filterset_fields   = ["category", "is_active"]
    search_fields      = ["name", "content", "description"]

    def get_queryset(self):
        return SMSTemplate.objects.select_related("created_by").order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="use")
    def mark_used(self, request, pk=None):
        tpl = self.get_object()
        tpl.usage_count += 1
        tpl.save(update_fields=["usage_count"])
        return Response({"success": True, "usage_count": tpl.usage_count})