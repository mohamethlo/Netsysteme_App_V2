# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/views_products.py
# ─────────────────────────────────────────────────────────────────────────────
import os
from django.conf import settings
from django.db import models as django_models
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from .models import Product
from .serializers_products import ProductSerializer, ProductStockUpdateSerializer


class ProductViewSet(viewsets.ModelViewSet):
    """
    GET    /api/products/               → liste paginée + recherche
    POST   /api/products/               → créer (multipart pour image)
    GET    /api/products/{id}/          → détail
    PATCH  /api/products/{id}/          → modifier
    DELETE /api/products/{id}/          → supprimer + supprime l'image
    GET    /api/products/select/        → liste légère pour <select>
    GET    /api/products/stats/         → statistiques stock
    GET    /api/products/low-stock/     → produits en alerte
    POST   /api/products/{id}/adjust-stock/ → ajuster le stock manuellement
    """
    queryset           = Product.objects.all().order_by("name", "description")
    serializer_class   = ProductSerializer
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields      = ["name", "description", "supplier"]
    ordering_fields    = ["name", "description", "unit_price", "quantity", "created_at"]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    # ── CREATE ─────────────────────────────────────────────────────────────────
    def create(self, request, *args, **kwargs):
        data       = request.data
        image_path = self._handle_image_upload(request.FILES.get("img"))

        try:
            product = Product.objects.create(
                name           = data.get("name", "").strip() or None,
                description    = data.get("description", "").strip() or None,
                quantity       = float(data.get("qty", 0)),
                unit_price     = float(data.get("prix", 0)),
                supplier       = data.get("fournisseur", "").strip() or None,
                alert_quantity = float(data.get("alert_quantity", 5)),
                image_path     = image_path,
            )
        except (ValueError, TypeError) as e:
            return Response({"detail": f"Données numériques invalides : {e}"},
                            status=status.HTTP_400_BAD_REQUEST)

        return Response(
            ProductSerializer(product, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    # ── UPDATE ─────────────────────────────────────────────────────────────────
    def update(self, request, *args, **kwargs):
        product = self.get_object()
        data    = request.data

        product.name           = data.get("name",           product.name          or "").strip() or None
        product.description    = data.get("description",    product.description   or "").strip() or None
        product.supplier       = data.get("fournisseur",    product.supplier      or "").strip() or None

        try:
            product.quantity       = float(data.get("qty",            product.quantity))
            product.unit_price     = float(data.get("prix",           product.unit_price))
            product.alert_quantity = float(data.get("alert_quantity", product.alert_quantity))
        except (ValueError, TypeError) as e:
            return Response({"detail": f"Données numériques invalides : {e}"},
                            status=status.HTTP_400_BAD_REQUEST)

        # Nouvelle image
        img_file = request.FILES.get("img")
        if img_file:
            self._delete_image(product.image_path)
            product.image_path = self._handle_image_upload(img_file)

        product.save()
        return Response(ProductSerializer(product, context={"request": request}).data)

    # ── DELETE ─────────────────────────────────────────────────────────────────
    def destroy(self, request, *args, **kwargs):
        product = self.get_object()
        self._delete_image(product.image_path)
        product.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── ACTIONS ────────────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="select")
    def select(self, request):
        """Liste légère pour alimenter les dropdowns des lignes de facture."""
        qs = Product.objects.all().order_by("name", "description")
        return Response([{
            "id":          p.id,
            "name":        p.name or p.description,
            "description": p.description,
            "price":       p.unit_price,
            "quantity":    p.quantity,
            "is_low_stock": p.is_low_stock,
        } for p in qs])

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """Statistiques globales du stock."""
        qs       = Product.objects.all()
        total    = qs.count()
        rupture  = qs.filter(quantity=0).count()
        low      = [p for p in qs if 0 < p.quantity <= p.alert_quantity]
        ok       = [p for p in qs if p.quantity > p.alert_quantity]
        val_total = sum(p.quantity * p.unit_price for p in qs)

        return Response({
            "total":           total,
            "en_rupture":      rupture,
            "stock_faible":    len(low),
            "stock_ok":        len(ok),
            "valeur_stock":    round(val_total, 2),
        })

    @action(detail=False, methods=["get"], url_path="low-stock")
    def low_stock(self, request):
        """Produits en alerte (quantity <= alert_quantity)."""
        qs = [p for p in Product.objects.all() if p.is_low_stock]
        return Response(
            ProductSerializer(qs, many=True, context={"request": request}).data
        )

    @action(detail=True, methods=["post"], url_path="adjust-stock")
    def adjust_stock(self, request, pk=None):
        """
        Ajuster manuellement le stock.
        Body : { operation: 'add'|'remove'|'set', quantity: float, note?: string }
        """
        product    = self.get_object()
        serializer = ProductStockUpdateSerializer(
            data=request.data, context={"product": product}
        )
        serializer.is_valid(raise_exception=True)

        op  = serializer.validated_data["operation"]
        qty = serializer.validated_data["quantity"]

        if op == "add":
            product.quantity += qty
        elif op == "remove":
            product.quantity -= qty
        elif op == "set":
            product.quantity = qty

        product.save(update_fields=["quantity"])
        return Response({
            "detail":       f"Stock mis à jour ({op} {qty}).",
            "new_quantity": product.quantity,
            "product":      ProductSerializer(product, context={"request": request}).data,
        })

    # ── Helpers ────────────────────────────────────────────────────────────────
    def _handle_image_upload(self, img_file) -> str | None:
        if not img_file:
            return None
        upload_dir = os.path.join(settings.MEDIA_ROOT, "uploads", "products")
        os.makedirs(upload_dir, exist_ok=True)
        filename  = img_file.name
        file_path = os.path.join(upload_dir, filename)
        with open(file_path, "wb") as f:
            for chunk in img_file.chunks():
                f.write(chunk)
        return f"uploads/products/{filename}"

    def _delete_image(self, image_path: str | None):
        if not image_path:
            return
        full = os.path.join(settings.MEDIA_ROOT, image_path)
        if os.path.exists(full):
            try:
                os.remove(full)
            except OSError:
                pass