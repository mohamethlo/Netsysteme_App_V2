# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/views_invoices.py
#  PATCH FINAL : "installation" retiré de tous les select_related
# ─────────────────────────────────────────────────────────────────────────────
import datetime
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from .models import Invoice, InvoiceItem, Proforma, ProformaItem
from .serializers_invoices import InvoiceSerializer, InvoiceWriteSerializer


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = (
        Invoice.objects
        .select_related("billing_client")      # ← "installation" supprimé
        .prefetch_related("items__product")
        .order_by("-date", "-created_at")
    )

    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["status", "domaine", "billing_client"]
    search_fields      = [
        "invoice_number",
        "billing_client__company_name",
        "billing_client__contact_name",
        "billing_client__phone",
    ]
    ordering_fields    = ["date", "due_date", "created_at", "invoice_number"]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return InvoiceWriteSerializer
        return InvoiceSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        qs = Invoice.objects.prefetch_related("items").all()
        recent = (
            Invoice.objects
            .select_related("billing_client")  # ← "installation" supprimé
            .prefetch_related("items__product")
            .order_by("-date")[:8]
        )
        return Response({
            "total_factures":     qs.count(),
            "brouillons":         qs.filter(status="draft").count(),
            "confirmees":         qs.filter(status="confirmed").count(),
            "payees":             qs.filter(status="paid").count(),
            "montant_total":      round(
                sum(i.total_with_tax_and_discount() for i in qs), 2
            ),
            "montant_en_attente": round(
                sum(
                    i.total_with_tax_and_discount()
                    for i in qs
                    if i.status in ("draft", "sent", "confirmed")
                ), 2
            ),
            "recent": InvoiceSerializer(
                recent, many=True, context={"request": request}
            ).data,
        })

    @action(detail=False, methods=["get"], url_path="next-number")
    def next_number(self, request):
        today = datetime.date.today()
        return Response({
            "number": f"FACT-{today.strftime('%Y%m%d')}-{Invoice.objects.count() + 1}"
        })

    @action(detail=True, methods=["post"], url_path="confirm")
    def confirm(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status != "draft":
            return Response(
                {"detail": "Seules les factures brouillon peuvent être confirmées."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for item in invoice.items.select_related("product").all():
            if item.product and item.product.quantity < item.quantity:
                return Response({
                    "detail": (
                        f"Stock insuffisant pour « {item.product.name} » "
                        f"(disponible : {item.product.quantity}, "
                        f"demandé : {item.quantity})."
                    )
                }, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            for item in invoice.items.select_related("product").all():
                if item.product:
                    item.product.quantity -= item.quantity
                    item.product.save(update_fields=["quantity"])
            invoice.status = "confirmed"
            invoice.save(update_fields=["status"])
        return Response(InvoiceSerializer(invoice, context={"request": request}).data)

    @action(detail=True, methods=["patch"], url_path="change-status")
    def change_status(self, request, pk=None):
        invoice    = self.get_object()
        new_status = request.data.get("status")
        valid      = ["draft", "confirmed", "sent", "paid", "overdue", "cancelled"]
        if new_status not in valid:
            return Response(
                {"detail": f"Statut invalide. Acceptés : {', '.join(valid)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invoice.status = new_status
        invoice.save(update_fields=["status"])
        return Response(InvoiceSerializer(invoice, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="convert-to-proforma")
    def convert_to_proforma(self, request, pk=None):
        invoice = self.get_object()
        today   = datetime.date.today()
        with transaction.atomic():
            proforma = Proforma.objects.create(
                proforma_number  = f"PROF-{today.strftime('%Y%m%d')}-{Proforma.objects.count() + 1}",
                billing_client   = invoice.billing_client,
                date             = today,
                valid_until      = invoice.due_date,
                tax_rate         = invoice.tax_rate,
                domaine          = invoice.domaine,
                discount_percent = invoice.discount_percent,
                discount_amount  = invoice.discount_amount,
                notes            = f"Converti depuis la facture {invoice.invoice_number}",
                status           = "draft",
            )
            for item in invoice.items.all():
                ProformaItem.objects.create(
                    proforma         = proforma,
                    product          = item.product,
                    description      = item.description,
                    quantity         = item.quantity,
                    unit_price       = item.unit_price,
                    discount_percent = item.discount_percent,
                )
            invoice.delete()
        from .serializers_proformas import ProformaSerializer
        return Response(
            ProformaSerializer(proforma, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )