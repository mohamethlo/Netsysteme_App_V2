import os
from django.db import models
from django.conf import settings


class InventoryCategory(models.Model):
    name        = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inventory_category"
        ordering = ["name"]

    def __str__(self):
        return self.name


class InventoryItem(models.Model):
    name          = models.CharField(max_length=200)
    description   = models.TextField(blank=True, null=True)
    reference     = models.CharField(max_length=100, unique=True, blank=True, null=True)
    category      = models.ForeignKey(
        InventoryCategory, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="items",
        db_column="category_id",
    )
    quantity      = models.IntegerField(default=0)
    unit          = models.CharField(max_length=20, default="pièce")
    prix_achat    = models.FloatField(null=True, blank=True)
    prix_vente    = models.FloatField(null=True, blank=True)
    seuil_alerte  = models.IntegerField(default=10)
    fournisseur   = models.CharField(max_length=100, blank=True, null=True)
    emplacement   = models.CharField(max_length=100, blank=True, null=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)
    image_path    = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        db_table = "inventory_item"
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def is_low_stock(self):
        return self.quantity <= self.seuil_alerte

    @property
    def image_url(self):
        if self.image_path:
            return f"{settings.MEDIA_URL}{self.image_path}"
        return None

    def delete_image(self):
        if self.image_path:
            full = os.path.join(settings.MEDIA_ROOT, self.image_path)
            if os.path.exists(full):
                try:
                    os.remove(full)
                except OSError:
                    pass


class StockMovement(models.Model):
    MOUVEMENT_CHOICES = [
        ("entree",  "Entrée"),
        ("sortie",  "Sortie"),
        ("ajust",   "Ajustement"),
    ]
    item          = models.ForeignKey(
        InventoryItem, on_delete=models.CASCADE,
        related_name="mouvements", db_column="item_id",
    )
    type_mouvement = models.CharField(max_length=20, choices=MOUVEMENT_CHOICES)
    quantite      = models.IntegerField()
    quantite_avant = models.IntegerField()
    quantite_apres = models.IntegerField()
    raison        = models.CharField(max_length=200, blank=True, null=True)
    created_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, db_column="created_by_id",
    )
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "stock_movement"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.type_mouvement} {self.quantite} x {self.item.name}"