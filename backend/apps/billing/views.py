# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/views.py  — PATCH : suppression de select_related("installation")
#  Le champ installation est désormais un IntegerField simple (installation_id)
# ─────────────────────────────────────────────────────────────────────────────
import os
import datetime
from django.conf import settings
from django.db import transaction
from django.db.models import (
    Count, Sum, Case, When, F, FloatField, ExpressionWrapper, Q
)
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from .models import (
    BillingClient, Product,
    Invoice, InvoiceItem,
    Proforma, ProformaItem,
)
from .serializers import (
    BillingClientSerializer,
    ProductSerializer,
    InvoiceSerializer, InvoiceWriteSerializer,
    ProformaSerializer, ProformaWriteSerializer,
)


# ─────────────────────────────────────────────────────────────────────────────
#  Dashboard global
# ─────────────────────────────────────────────────────────────────────────────
class BillingDashboardView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        recent_inv  = Invoice.objects.select_related("billing_client").prefetch_related("items__product").order_by("-date")[:5]
        recent_prof = Proforma.objects.select_related("billing_client").prefetch_related("items__product").order_by("-date")[:5]

        # Agrégations DB — une seule requête par table
        inv_agg  = Invoice.objects.aggregate(total=Count("id"))
        prof_agg = Proforma.objects.aggregate(total=Count("id"))
        prod_agg = Product.objects.aggregate(
            total=Count("id"),
            low_stock=Count(Case(When(quantity__lte=F("alert_quantity"), then=1))),
        )
        # Montant total factures calculé via somme des lignes * taxes (prefetch déjà chargé)
        invoices = Invoice.objects.prefetch_related("items").all()
        montant_total = round(sum(i.total_with_tax_and_discount() for i in invoices), 2)

        return Response({
            "total_clients":          BillingClient.objects.count(),
            "total_invoices":         inv_agg["total"] or 0,
            "total_proformas":        prof_agg["total"] or 0,
            "total_products":         prod_agg["total"] or 0,
            "low_stock":              prod_agg["low_stock"] or 0,
            "montant_total_factures": montant_total,
            "recent_invoices":        InvoiceSerializer(recent_inv,  many=True, context={"request": request}).data,
            "recent_proformas":       ProformaSerializer(recent_prof, many=True, context={"request": request}).data,
        })


# ─────────────────────────────────────────────────────────────────────────────
#  BillingClient
# ─────────────────────────────────────────────────────────────────────────────
class BillingClientViewSet(viewsets.ModelViewSet):
    queryset           = BillingClient.objects.all().order_by("company_name")
    serializer_class   = BillingClientSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [SearchFilter, OrderingFilter]
    search_fields      = ["company_name", "contact_name", "email", "phone", "tax_id"]

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "request": self.request}

    def destroy(self, request, *args, **kwargs):
        client = self.get_object()
        if not client.can_delete():
            return Response(
                {"detail": "Impossible : ce client a des factures ou proformas associés."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        client.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="select")
    def select(self, request):
        qs = BillingClient.objects.all().order_by("-created_at")
        return Response([{"id": c.id, "text": c.display_name, "phone": c.phone} for c in qs])

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        qs = BillingClient.objects.all()
        return Response({
            "total":        qs.count(),
            "with_company": qs.exclude(company_name__isnull=True).exclude(company_name="").count(),
            "with_email":   qs.exclude(email__isnull=True).exclude(email="").count(),
            "with_tax_id":  qs.exclude(tax_id__isnull=True).exclude(tax_id="").count(),
        })


# ─────────────────────────────────────────────────────────────────────────────
#  Product
# ─────────────────────────────────────────────────────────────────────────────
class ProductViewSet(viewsets.ModelViewSet):
    queryset           = Product.objects.all().order_by("name", "description")
    serializer_class   = ProductSerializer
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    filter_backends    = [SearchFilter, OrderingFilter]
    search_fields      = ["name", "description", "supplier"]

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "request": self.request}

    def create(self, request, *args, **kwargs):
        data       = request.data
        image_path = self._save_image(request.FILES.get("img"))
        try:
            product = Product.objects.create(
                name           = (data.get("name") or "").strip() or None,
                description    = (data.get("description") or "").strip() or None,
                quantity       = float(data.get("qty", 0)),
                unit_price     = float(data.get("prix", 0)),
                supplier       = (data.get("fournisseur") or "").strip() or None,
                alert_quantity = float(data.get("alert_quantity", 5)),
                image_path     = image_path,
            )
        except (ValueError, TypeError) as e:
            return Response({"detail": f"Valeur numérique invalide : {e}"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductSerializer(product, context={"request": request}).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        product = self.get_object()
        data    = request.data
        product.name           = (data.get("name") or product.name or "").strip() or None
        product.description    = (data.get("description") or product.description or "").strip() or None
        product.supplier       = (data.get("fournisseur") or product.supplier or "").strip() or None
        try:
            product.quantity       = float(data.get("qty",            product.quantity))
            product.unit_price     = float(data.get("prix",           product.unit_price))
            product.alert_quantity = float(data.get("alert_quantity", product.alert_quantity))
        except (ValueError, TypeError) as e:
            return Response({"detail": f"Valeur numérique invalide : {e}"}, status=status.HTTP_400_BAD_REQUEST)
        img_file = request.FILES.get("img")
        if img_file:
            self._delete_image(product.image_path)
            product.image_path = self._save_image(img_file)
        product.save()
        return Response(ProductSerializer(product, context={"request": request}).data)

    def destroy(self, request, *args, **kwargs):
        product = self.get_object()
        self._delete_image(product.image_path)
        product.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="select")
    def select(self, request):
        return Response([{
            "id": p.id, "name": p.name or p.description,
            "description": p.description, "price": p.unit_price,
            "quantity": p.quantity, "is_low_stock": p.is_low_stock,
        } for p in Product.objects.all().order_by("name")])

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        agg = Product.objects.aggregate(
            total=Count("id"),
            en_rupture=Count(Case(When(quantity=0, then=1))),
            stock_faible=Count(Case(When(
                quantity__gt=0, quantity__lte=F("alert_quantity"), then=1
            ))),
            valeur_stock=Sum(ExpressionWrapper(
                F("quantity") * F("unit_price"), output_field=FloatField()
            )),
        )
        total       = agg["total"] or 0
        en_rupture  = agg["en_rupture"] or 0
        stock_faible= agg["stock_faible"] or 0
        return Response({
            "total":        total,
            "stock_ok":     total - en_rupture - stock_faible,
            "stock_faible": stock_faible,
            "en_rupture":   en_rupture,
            "valeur_stock": round(agg["valeur_stock"] or 0, 2),
        })

    @action(detail=False, methods=["get"], url_path="low-stock")
    def low_stock(self, request):
        qs = Product.objects.filter(quantity__lte=F("alert_quantity")).order_by("quantity")
        return Response(ProductSerializer(qs, many=True, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="adjust-stock")
    def adjust_stock(self, request, pk=None):
        product = self.get_object()
        op      = request.data.get("operation")
        qty     = float(request.data.get("quantity", 0))
        if op not in ("add", "remove", "set"):
            return Response({"detail": "operation doit être add, remove ou set."}, status=status.HTTP_400_BAD_REQUEST)
        if op == "remove" and product.quantity < qty:
            return Response({"detail": f"Stock insuffisant (disponible : {product.quantity})."}, status=status.HTTP_400_BAD_REQUEST)
        if op == "add":      product.quantity += qty
        elif op == "remove": product.quantity -= qty
        elif op == "set":    product.quantity  = qty
        product.save(update_fields=["quantity"])
        return Response({
            "detail": "Stock mis à jour.", "new_quantity": product.quantity,
            "product": ProductSerializer(product, context={"request": request}).data,
        })
    

    @action(detail=False, methods=["get"], url_path="stock-alerts")
    def stock_alerts(self, request):
        """Produits en rupture ou stock faible — pour la cloche de facturation."""
        products = Product.objects.filter(
            quantity__lte=F("alert_quantity")
        ).order_by("quantity")
        alertes  = []
        ruptures = 0
        faibles  = 0
        for p in products:
            status_val = "rupture" if p.quantity == 0 else "faible"
            if status_val == "rupture":
                ruptures += 1
            else:
                faibles += 1
            alertes.append({
                "id":            p.id,
                "name":          p.name or p.description or f"Produit #{p.id}",
                "description":   p.description,
                "quantity":      p.quantity,
                "alert_quantity":p.alert_quantity,
                "unit_price":    p.unit_price,
                "supplier":      p.supplier,
                "image_path":    p.image_path,
                "stock_status":  status_val,
                "is_low_stock":  True,
            })
        return Response({
            "total":    len(alertes),
            "ruptures": ruptures,
            "faibles":  faibles,
            "alertes":  alertes,
        })


    def _save_image(self, img_file):
        if not img_file:
            return None
        upload_dir = os.path.join(settings.MEDIA_ROOT, "uploads", "products")
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, img_file.name)
        with open(file_path, "wb") as f:
            for chunk in img_file.chunks():
                f.write(chunk)
        return f"uploads/products/{img_file.name}"

    def _delete_image(self, image_path):
        if not image_path:
            return
        full = os.path.join(settings.MEDIA_ROOT, image_path)
        if os.path.exists(full):
            try:
                os.remove(full)
            except OSError:
                pass


# ─────────────────────────────────────────────────────────────────────────────
#  Invoice
# ─────────────────────────────────────────────────────────────────────────────
class InvoiceViewSet(viewsets.ModelViewSet):
    # ── PATCH : "installation" retiré de select_related ──────────────────────
    queryset = Invoice.objects.select_related(
        "billing_client"                          # ← plus de "installation"
    ).prefetch_related("items__product").order_by("-date", "-created_at")

    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["status", "domaine", "billing_client"]
    search_fields      = ["invoice_number", "billing_client__company_name", "billing_client__phone"]
    ordering_fields    = ["date", "due_date", "created_at"]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return InvoiceWriteSerializer
        return InvoiceSerializer

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "request": self.request}

    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        agg = Invoice.objects.aggregate(
            total_factures=Count("id"),
            brouillons=Count(Case(When(status="draft",      then=1))),
            confirmees=Count(Case(When(status="confirmed",  then=1))),
            payees    =Count(Case(When(status="paid",       then=1))),
        )
        recent = Invoice.objects.select_related("billing_client").prefetch_related(
            "items__product"
        ).order_by("-date")[:8]
        # Montant total (nécessite calcul par lignes)
        qs = Invoice.objects.prefetch_related("items").all()
        montant_total      = round(sum(i.total_with_tax_and_discount() for i in qs), 2)
        montant_en_attente = round(sum(
            i.total_with_tax_and_discount()
            for i in qs if i.status in ("draft", "sent", "confirmed")
        ), 2)
        return Response({
            "total_factures":     agg["total_factures"] or 0,
            "brouillons":         agg["brouillons"]     or 0,
            "confirmees":         agg["confirmees"]     or 0,
            "payees":             agg["payees"]         or 0,
            "montant_total":      montant_total,
            "montant_en_attente": montant_en_attente,
            "recent": InvoiceSerializer(recent, many=True, context={"request": request}).data,
        })

    @action(detail=False, methods=["get"], url_path="next-number")
    def next_number(self, request):
        today = datetime.date.today()
        return Response({"number": f"FACT-{today.strftime('%Y%m%d')}-{Invoice.objects.count() + 1}"})

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
                    "detail": f"Stock insuffisant pour « {item.product.name} » "
                              f"(disponible : {item.product.quantity}, demandé : {item.quantity})."
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
            return Response({"detail": f"Statut invalide. Acceptés : {', '.join(valid)}"}, status=status.HTTP_400_BAD_REQUEST)
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
        return Response(
            ProformaSerializer(proforma, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────────────────────────────────────
#  Proforma
# ─────────────────────────────────────────────────────────────────────────────
class ProformaViewSet(viewsets.ModelViewSet):
    queryset = Proforma.objects.select_related(
        "billing_client", "invoice"
    ).prefetch_related("items__product").order_by("-date", "-created_at")

    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["status", "domaine", "billing_client", "converted_to_invoice"]
    search_fields      = ["proforma_number", "billing_client__company_name", "billing_client__phone"]
    ordering_fields    = ["date", "valid_until", "created_at"]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return ProformaWriteSerializer
        return ProformaSerializer

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "request": self.request}

    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        today = datetime.date.today()
        agg   = Proforma.objects.aggregate(
            total_proformas=Count("id"),
            brouillons =Count(Case(When(status="draft",      then=1))),
            envoyes    =Count(Case(When(status="sent",       then=1))),
            convertis  =Count(Case(When(converted_to_invoice=True, then=1))),
            annules    =Count(Case(When(status="cancelled",  then=1))),
            expire_bientot=Count(Case(When(
                valid_until__isnull=False,
                valid_until__gte=today,
                valid_until__lte=today + datetime.timedelta(days=7),
                converted_to_invoice=False,
                status__in=["draft", "sent"],
                then=1,
            ))),
        )
        recent = Proforma.objects.select_related("billing_client").prefetch_related(
            "items__product"
        ).order_by("-date")[:8]
        # Montant total (nécessite calcul par lignes)
        qs = Proforma.objects.prefetch_related("items").all()
        montant_total      = round(sum(p.total_with_tax_and_discount() for p in qs), 2)
        montant_en_attente = round(sum(
            p.total_with_tax_and_discount()
            for p in qs if p.status in ("draft", "sent") and not p.converted_to_invoice
        ), 2)
        return Response({
            "total_proformas":    agg["total_proformas"] or 0,
            "brouillons":         agg["brouillons"]      or 0,
            "envoyes":            agg["envoyes"]         or 0,
            "convertis":          agg["convertis"]       or 0,
            "annules":            agg["annules"]         or 0,
            "montant_total":      montant_total,
            "montant_en_attente": montant_en_attente,
            "expire_bientot":     agg["expire_bientot"]  or 0,
            "recent":             ProformaSerializer(recent, many=True, context={"request": request}).data,
        })

    @action(detail=False, methods=["get"], url_path="next-number")
    def next_number(self, request):
        today = datetime.date.today()
        return Response({"number": f"PRO-{today.strftime('%Y%m%d')}-{Proforma.objects.count() + 1}"})

    @action(detail=True, methods=["post"], url_path="convert")
    def convert(self, request, pk=None):
        proforma = self.get_object()
        if proforma.converted_to_invoice:
            return Response({"detail": "Ce proforma a déjà été converti."}, status=status.HTTP_400_BAD_REQUEST)
        if proforma.status == "cancelled":
            return Response({"detail": "Un proforma annulé ne peut pas être converti."}, status=status.HTTP_400_BAD_REQUEST)
        today = datetime.date.today()
        with transaction.atomic():
            invoice = Invoice.objects.create(
                invoice_number   = f"FACT-{today.strftime('%Y%m%d')}-{Invoice.objects.count() + 1}",
                billing_client   = proforma.billing_client,
                date             = today,
                due_date         = proforma.valid_until,
                tax_rate         = proforma.tax_rate,
                domaine          = proforma.domaine,
                discount_percent = proforma.discount_percent,
                discount_amount  = proforma.discount_amount,
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
        return Response(
            InvoiceSerializer(invoice, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["patch"], url_path="change-status")
    def change_status(self, request, pk=None):
        proforma   = self.get_object()
        new_status = request.data.get("status")
        if new_status not in ["draft", "sent", "cancelled"]:
            return Response({"detail": "Statut invalide. Acceptés : draft, sent, cancelled."}, status=status.HTTP_400_BAD_REQUEST)
        if proforma.converted_to_invoice:
            return Response({"detail": "Impossible de modifier un proforma déjà converti."}, status=status.HTTP_400_BAD_REQUEST)
        proforma.status = new_status
        proforma.save(update_fields=["status"])
        return Response(ProformaSerializer(proforma, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        original = self.get_object()
        today    = datetime.date.today()
        with transaction.atomic():
            copy = Proforma.objects.create(
                proforma_number  = f"PRO-{today.strftime('%Y%m%d')}-{Proforma.objects.count() + 1}",
                billing_client   = original.billing_client,
                date             = today,
                valid_until      = today + datetime.timedelta(days=30),
                tax_rate         = original.tax_rate,
                domaine          = original.domaine,
                discount_percent = original.discount_percent,
                discount_amount  = original.discount_amount,
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