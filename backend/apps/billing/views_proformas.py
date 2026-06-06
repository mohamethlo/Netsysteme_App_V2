# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/views_proformas.py
# ─────────────────────────────────────────────────────────────────────────────
import datetime
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from .models import Proforma, ProformaItem, Invoice, InvoiceItem
from .serializers_proformas import ProformaSerializer, ProformaWriteSerializer


class ProformaViewSet(viewsets.ModelViewSet):
    """
    GET    /api/proformas/                       → liste paginée
    POST   /api/proformas/                       → créer (new_proforma)
    GET    /api/proformas/{id}/                  → détail (view_proforma)
    PATCH  /api/proformas/{id}/                  → modifier
    DELETE /api/proformas/{id}/                  → supprimer
    GET    /api/proformas/dashboard/             → stats + récents
    GET    /api/proformas/next-number/           → prochain numéro auto
    POST   /api/proformas/{id}/convert/          → convertir en facture
    PATCH  /api/proformas/{id}/change-status/    → changer le statut
    POST   /api/proformas/{id}/duplicate/        → dupliquer un proforma
    """
    queryset = Proforma.objects.select_related(
        "billing_client", "invoice"
    ).prefetch_related("items__product").order_by("-date", "-created_at")

    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["status", "domaine", "billing_client", "converted_to_invoice"]
    search_fields      = [
        "proforma_number",
        "billing_client__company_name",
        "billing_client__contact_name",
        "billing_client__phone",
    ]
    ordering_fields    = ["date", "valid_until", "created_at", "proforma_number"]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return ProformaWriteSerializer
        return ProformaSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    # ── Dashboard ──────────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        qs     = Proforma.objects.prefetch_related("items").all()
        recent = Proforma.objects.select_related("billing_client").prefetch_related(
            "items__product"
        ).order_by("-date")[:8]

        montant_total   = sum(p.total_with_tax_and_discount() for p in qs)
        en_attente      = sum(
            p.total_with_tax_and_discount()
            for p in qs if p.status in ("draft", "sent") and not p.converted_to_invoice
        )
        # Proformas expirés (valid_until dépassé, non convertis)
        today = datetime.date.today()
        expires_soon = qs.filter(
            valid_until__isnull=False,
            valid_until__gte=today,
            valid_until__lte=today + datetime.timedelta(days=7),
            converted_to_invoice=False,
            status__in=["draft", "sent"],
        ).count()

        return Response({
            "total_proformas":    qs.count(),
            "brouillons":         qs.filter(status="draft").count(),
            "envoyes":            qs.filter(status="sent").count(),
            "convertis":          qs.filter(converted_to_invoice=True).count(),
            "annules":            qs.filter(status="cancelled").count(),
            "montant_total":      round(montant_total, 2),
            "montant_en_attente": round(en_attente, 2),
            "expire_bientot":     expires_soon,
            "recent":             ProformaSerializer(
                recent, many=True, context={"request": request}
            ).data,
        })

    # ── Numéro automatique ─────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="next-number")
    def next_number(self, request):
        today = datetime.date.today()
        count = Proforma.objects.count() + 1
        return Response({"number": f"PRO-{today.strftime('%Y%m%d')}-{count}"})

    # ── Convertir proforma → facture ───────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="convert")
    def convert(self, request, pk=None):
        proforma = self.get_object()

        if proforma.converted_to_invoice:
            return Response(
                {"detail": "Ce proforma a déjà été converti en facture."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if proforma.status == "cancelled":
            return Response(
                {"detail": "Un proforma annulé ne peut pas être converti."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = datetime.date.today()

        with transaction.atomic():
            invoice_number = (
                f"FACT-{today.strftime('%Y%m%d')}-{Invoice.objects.count() + 1}"
            )
            invoice = Invoice.objects.create(
                invoice_number   = invoice_number,
                billing_client   = proforma.billing_client,
                date             = today,
                due_date         = proforma.valid_until,
                tax_rate         = proforma.tax_rate,
                discount_percent = proforma.discount_percent,
                discount_amount  = proforma.discount_amount,
                domaine          = proforma.domaine,
                notes            = f"Converti depuis le proforma {proforma.proforma_number}",
                status           = "draft",
            )
            for item in proforma.items.all():
                InvoiceItem.objects.create(
                    invoice          = invoice,
                    product          = item.product,
                    description      = item.description,
                    quantity         = item.quantity,
                    unit_price       = item.unit_price,
                    discount_percent = item.discount_percent,
                )
            proforma.converted_to_invoice = True
            proforma.invoice              = invoice
            proforma.status               = "converted"
            proforma.save(update_fields=["converted_to_invoice", "invoice", "status"])

        from .serializers_invoices import InvoiceSerializer
        return Response(
            InvoiceSerializer(invoice, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    # ── Changer le statut ──────────────────────────────────────────────────────
    @action(detail=True, methods=["patch"], url_path="change-status")
    def change_status(self, request, pk=None):
        proforma   = self.get_object()
        new_status = request.data.get("status")
        valid      = ["draft", "sent", "cancelled"]

        if new_status not in valid:
            return Response(
                {"detail": f"Statut invalide. Valeurs acceptées : {', '.join(valid)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if proforma.converted_to_invoice:
            return Response(
                {"detail": "Impossible de modifier le statut d'un proforma déjà converti."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        proforma.status = new_status
        proforma.save(update_fields=["status"])
        return Response(
            ProformaSerializer(proforma, context={"request": request}).data
        )

    # ── Dupliquer un proforma ──────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        original = self.get_object()
        today    = datetime.date.today()

        with transaction.atomic():
            new_number = f"PRO-{today.strftime('%Y%m%d')}-{Proforma.objects.count() + 1}"
            copy = Proforma.objects.create(
                proforma_number  = new_number,
                billing_client   = original.billing_client,
                date             = today,
                valid_until      = today + datetime.timedelta(days=30),
                tax_rate         = original.tax_rate,
                discount_percent = original.discount_percent,
                discount_amount  = original.discount_amount,
                domaine          = original.domaine,
                notes            = f"Copie de {original.proforma_number}",
                status           = "draft",
            )
            for item in original.items.all():
                ProformaItem.objects.create(
                    proforma         = copy,
                    product          = item.product,
                    description      = item.description,
                    quantity         = item.quantity,
                    unit_price       = item.unit_price,
                    discount_percent = item.discount_percent,
                )

        return Response(
            ProformaSerializer(copy, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )