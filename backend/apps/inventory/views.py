import os
from django.conf import settings
from django.db.models import Q, Sum, F
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend

from .models import InventoryCategory, InventoryItem, StockMovement
from .serializers import (
    InventoryCategorySerializer,
    InventoryItemSerializer,
    StockMovementSerializer,
)


# ── Catégories ────────────────────────────────────────────────────────────────
class InventoryCategoryViewSet(viewsets.ModelViewSet):
    queryset           = InventoryCategory.objects.all().order_by("name")
    serializer_class   = InventoryCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [SearchFilter]
    search_fields      = ["name", "description"]
    pagination_class   = None


# ── Articles ──────────────────────────────────────────────────────────────────
class InventoryItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["category", "unit"]
    search_fields      = ["name", "description", "reference", "fournisseur", "emplacement"]
    ordering_fields    = ["name", "quantity", "prix_achat", "prix_vente", "created_at"]

    def get_queryset(self):
        qs = InventoryItem.objects.select_related("category").order_by("name")

        # Filtre stock faible
        low_stock = self.request.query_params.get("low_stock")
        if low_stock == "true":
            # Filtre Python car is_low_stock est une property
            qs = [item for item in qs if item.is_low_stock]

        return qs

    def get_serializer_class(self):
        return InventoryItemSerializer

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "request": self.request}

    def _save_image(self, image_file):
        upload_dir = os.path.join(settings.MEDIA_ROOT, "uploads", "inventory")
        os.makedirs(upload_dir, exist_ok=True)
        filename  = image_file.name
        file_path = os.path.join(upload_dir, filename)
        with open(file_path, "wb") as f:
            for chunk in image_file.chunks():
                f.write(chunk)
        return f"uploads/inventory/{filename}"

    def create(self, request, *args, **kwargs):
        data       = request.data.copy()
        image_path = None

        image_file = request.FILES.get("image")
        if image_file:
            try:
                image_path = self._save_image(image_file)
            except Exception as e:
                return Response({"detail": f"Erreur image : {e}"}, status=400)

        try:
            item = InventoryItem.objects.create(
                name         = data.get("name", "").strip(),
                description  = data.get("description", "").strip() or None,
                reference    = data.get("reference", "").strip() or None,
                category_id  = int(data["category"]) if data.get("category") else None,
                quantity     = int(data.get("quantity", 0)),
                unit         = data.get("unit", "pièce"),
                prix_achat   = float(data["prix_achat"])   if data.get("prix_achat")   else None,
                prix_vente   = float(data["prix_vente"])   if data.get("prix_vente")   else None,
                seuil_alerte = int(data.get("seuil_alerte", 10)),
                fournisseur  = data.get("fournisseur", "").strip() or None,
                emplacement  = data.get("emplacement", "").strip() or None,
                image_path   = image_path,
            )
            # Mouvement initial si quantité > 0
            if item.quantity > 0:
                StockMovement.objects.create(
                    item=item, type_mouvement="entree",
                    quantite=item.quantity, quantite_avant=0,
                    quantite_apres=item.quantity,
                    raison="Stock initial",
                    created_by=request.user,
                )
        except Exception as e:
            return Response({"detail": str(e)}, status=400)

        return Response(
            InventoryItemSerializer(item, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        item       = self.get_object()
        data       = request.data.copy()
        image_file = request.FILES.get("image")

        if image_file:
            item.delete_image()
            try:
                item.image_path = self._save_image(image_file)
            except Exception as e:
                return Response({"detail": f"Erreur image : {e}"}, status=400)

        # Suppression image explicite
        if data.get("remove_image") in ("true", "1", True):
            item.delete_image()
            item.image_path = None

        item.name         = data.get("name",         item.name).strip()
        item.description  = data.get("description",  item.description or "").strip() or None
        item.reference    = data.get("reference",    item.reference or "").strip() or None
        item.category_id  = int(data["category"]) if data.get("category") else None
        item.unit         = data.get("unit",         item.unit)
        item.seuil_alerte = int(data.get("seuil_alerte", item.seuil_alerte))
        item.fournisseur  = data.get("fournisseur",  item.fournisseur or "").strip() or None
        item.emplacement  = data.get("emplacement",  item.emplacement or "").strip() or None

        try:
            if data.get("prix_achat") != "" and data.get("prix_achat") is not None:
                item.prix_achat = float(data["prix_achat"])
            if data.get("prix_vente") != "" and data.get("prix_vente") is not None:
                item.prix_vente = float(data["prix_vente"])
        except (ValueError, TypeError):
            pass

        item.save()
        return Response(InventoryItemSerializer(item, context={"request": request}).data)

    def destroy(self, request, *args, **kwargs):
        item = self.get_object()
        item.delete_image()
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Stats dashboard ────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        qs          = InventoryItem.objects.select_related("category").all()
        items_list  = list(qs)
        total       = len(items_list)
        low_stock   = sum(1 for i in items_list if i.is_low_stock and i.quantity > 0)
        rupture     = sum(1 for i in items_list if i.quantity == 0)
        valeur      = sum((i.prix_achat or 0) * i.quantity for i in items_list)
        categories  = InventoryCategory.objects.count()

        alertes = InventoryItemSerializer(
            [i for i in items_list if i.is_low_stock],
            many=True, context={"request": request},
        ).data

        return Response({
            "total":        total,
            "low_stock":    low_stock,
            "rupture":      rupture,
            "ok":           total - low_stock - rupture,
            "valeur_stock": round(valeur, 2),
            "categories":   categories,
            "alertes":      alertes,
        })

    # ── Liste pour select (interventions, etc.) ────────────────────────────────
    @action(detail=False, methods=["get"], url_path="select")
    def select(self, request):
        qs = InventoryItem.objects.filter(quantity__gt=0).order_by("name")
        return Response([{
            "id":           i.id,
            "name":         i.name,
            "description":  i.description,
            "quantity":     i.quantity,
            "unit":         i.unit,
            "prix_vente":   i.prix_vente,
            "is_low_stock": i.is_low_stock,
        } for i in qs])

    # ── Ajuster le stock ───────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="adjust-stock")
    def adjust_stock(self, request, pk=None):
        item      = self.get_object()
        operation = request.data.get("operation")   # add | remove | set
        quantite  = request.data.get("quantity", 0)
        raison    = request.data.get("raison", "")

        try:
            quantite = int(quantite)
        except (ValueError, TypeError):
            return Response({"detail": "Quantité invalide."}, status=400)

        if operation not in ("add", "remove", "set"):
            return Response({"detail": "operation doit être add, remove ou set."}, status=400)

        avant = item.quantity

        if operation == "add":
            if quantite <= 0:
                return Response({"detail": "La quantité à ajouter doit être positive."}, status=400)
            item.quantity += quantite
            type_mouv = "entree"
        elif operation == "remove":
            if quantite <= 0:
                return Response({"detail": "La quantité à retirer doit être positive."}, status=400)
            if item.quantity < quantite:
                return Response({"detail": f"Stock insuffisant (disponible : {item.quantity})."}, status=400)
            item.quantity -= quantite
            type_mouv = "sortie"
        else:  # set
            if quantite < 0:
                return Response({"detail": "La quantité ne peut pas être négative."}, status=400)
            item.quantity = quantite
            type_mouv = "ajust"

        item.save(update_fields=["quantity", "updated_at"])

        StockMovement.objects.create(
            item=item, type_mouvement=type_mouv,
            quantite=abs(item.quantity - avant) if operation != "set" else quantite,
            quantite_avant=avant, quantite_apres=item.quantity,
            raison=raison or None,
            created_by=request.user,
        )

        return Response({
            "detail":       "Stock mis à jour.",
            "new_quantity": item.quantity,
            "is_low_stock": item.is_low_stock,
            "item":         InventoryItemSerializer(item, context={"request": request}).data,
        })

    # ── Sortie de stock (compatibilité Flask) ──────────────────────────────────
    @action(detail=True, methods=["post"], url_path="outbound")
    def outbound(self, request, pk=None):
        item     = self.get_object()
        quantite = int(request.data.get("quantity", 0))
        raison   = request.data.get("reason", "Sortie")

        if quantite <= 0:
            return Response({"detail": "Quantité invalide."}, status=400)
        if item.quantity < quantite:
            return Response({"detail": f"Stock insuffisant (disponible : {item.quantity})."}, status=400)

        avant          = item.quantity
        item.quantity -= quantite
        item.save(update_fields=["quantity", "updated_at"])

        StockMovement.objects.create(
            item=item, type_mouvement="sortie",
            quantite=quantite, quantite_avant=avant,
            quantite_apres=item.quantity,
            raison=raison, created_by=request.user,
        )

        return Response({
            "success":      True,
            "new_quantity": item.quantity,
            "is_low_stock": item.is_low_stock,
        })

    # ── Historique des mouvements d'un article ─────────────────────────────────
    @action(detail=True, methods=["get"], url_path="movements")
    def movements(self, request, pk=None):
        item = self.get_object()
        qs   = item.mouvements.select_related("created_by").order_by("-created_at")[:50]
        return Response(StockMovementSerializer(qs, many=True).data)


# ── Mouvements de stock (lecture seule) ───────────────────────────────────────
class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class   = StockMovementSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["item", "type_mouvement"]
    search_fields      = ["item__name", "raison"]
    ordering_fields    = ["created_at"]

    def get_queryset(self):
        return StockMovement.objects.select_related("item", "created_by").order_by("-created_at")