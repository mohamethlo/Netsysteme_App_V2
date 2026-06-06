# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/models.py
#  PATCH : installation FK remplacé par IntegerField nullable
#  → à reconvertir en ForeignKey quand apps.installations sera créée
# ─────────────────────────────────────────────────────────────────────────────
from django.db import models
from django.utils import timezone


class BillingClient(models.Model):
    company_name = models.CharField(max_length=120, blank=True, null=True)
    contact_name = models.CharField(max_length=80,  blank=True, null=True)
    email        = models.CharField(max_length=120, blank=True, null=True)
    phone        = models.CharField(max_length=20)
    address      = models.TextField(blank=True, null=True)
    tax_id       = models.CharField(max_length=50, blank=True, null=True)
    created_at   = models.DateTimeField(default=timezone.now)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "billing_client"
        ordering = ["company_name"]

    def __str__(self):
        return self.display_name

    @property
    def display_name(self):
        parts = [p for p in [self.company_name, self.contact_name] if p]
        return " — ".join(parts) if parts else f"Client #{self.id}"

    def can_delete(self):
        return not self.invoices.exists() and not self.proformas.exists()


class Product(models.Model):
    name           = models.CharField(max_length=120, blank=True, null=True)
    description    = models.TextField(blank=True, null=True)
    quantity       = models.FloatField(default=0, db_index=True)
    alert_quantity = models.FloatField(default=5)
    unit_price     = models.FloatField()
    supplier       = models.CharField(max_length=120, blank=True, null=True)
    image_path     = models.CharField(max_length=255, blank=True, null=True)
    created_at     = models.DateTimeField(default=timezone.now)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "product"
        ordering = ["name", "description"]

    def __str__(self):
        return self.name or self.description or f"Produit #{self.id}"

    @property
    def is_low_stock(self):
        return self.quantity <= self.alert_quantity

    @property
    def stock_status(self):
        if self.quantity == 0:
            return "rupture"
        if self.quantity <= self.alert_quantity:
            return "faible"
        return "ok"


class Invoice(models.Model):
    STATUS_CHOICES = [
        ("draft",     "Brouillon"),
        ("confirmed", "Confirmée"),
        ("sent",      "Envoyée"),
        ("paid",      "Payée"),
        ("overdue",   "En retard"),
        ("cancelled", "Annulée"),
    ]
    DOMAINE_CHOICES = [
        ("NETSYSTEME", "NETSYSTEME"),
        ("SSE",        "SSE"),
    ]

    invoice_number   = models.CharField(max_length=50, unique=True, blank=True, null=True)
    billing_client   = models.ForeignKey(
        BillingClient, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="invoices"
    )
    # ── FK installation commenté jusqu'à la création de apps.installations ──
    installation = models.ForeignKey(
        "installations.Installation", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="factures"
    )
    # installation_id  = models.IntegerField(null=True, blank=True)   # ← temporaire
    date             = models.DateField(default=timezone.now)
    due_date         = models.DateField(blank=True, null=True)
    tax_rate         = models.FloatField(default=0.18)
    status           = models.CharField(max_length=20, default="draft", choices=STATUS_CHOICES, db_index=True)
    notes            = models.TextField(blank=True, null=True)
    domaine          = models.CharField(max_length=50, blank=True, null=True, choices=DOMAINE_CHOICES)
    discount_percent = models.FloatField(default=0.0)
    discount_amount  = models.FloatField(default=0.0)
    advance_amount   = models.FloatField(default=0.0)
    created_at       = models.DateTimeField(default=timezone.now)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "invoice"
        ordering = ["-date", "-created_at"]
        indexes = [
            models.Index(fields=["status", "date"]),
            models.Index(fields=["billing_client", "status"]),
        ]

    def __str__(self):
        return self.invoice_number or f"Facture #{self.id}"

    def total_amount(self):
        return sum(item.subtotal() for item in self.items.all())

    def tax_amount(self):
        return self.total_amount() * self.tax_rate

    def total_before_discount(self):
        return self.total_amount() * (1 + self.tax_rate)

    def discount_value(self):
        if self.discount_percent > 0:
            return self.total_before_discount() * (self.discount_percent / 100)
        return self.discount_amount

    def total_with_tax_and_discount(self):
        return self.total_before_discount() - self.discount_value()

    def remaining_balance(self):
        return max(0, self.total_with_tax_and_discount() - self.advance_amount)

    def has_advance(self):
        return self.advance_amount > 0


class InvoiceItem(models.Model):
    invoice          = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="items")
    description      = models.TextField(blank=True, null=True)
    quantity         = models.FloatField(default=1)
    unit_price       = models.FloatField()
    tax_rate         = models.FloatField(blank=True, null=True)
    product          = models.ForeignKey(
        Product, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="invoice_items"
    )
    discount_percent = models.FloatField(default=0.0)

    class Meta:
        db_table = "invoice_item"

    def subtotal(self):
        return self.quantity * self.unit_price

    def subtotal_after_discount(self):
        return self.subtotal() * (1 - self.discount_percent / 100)


class Proforma(models.Model):
    STATUS_CHOICES = [
        ("draft",     "Brouillon"),
        ("sent",      "Envoyé"),
        ("converted", "Converti"),
        ("cancelled", "Annulé"),
    ]
    DOMAINE_CHOICES = [
        ("NETSYSTEME", "NETSYSTEME"),
        ("SSE",        "SSE"),
    ]

    proforma_number      = models.CharField(max_length=50, unique=True, blank=True, null=True)
    billing_client       = models.ForeignKey(
        BillingClient, on_delete=models.CASCADE, related_name="proformas"
    )
    date                 = models.DateField(default=timezone.now)
    valid_until          = models.DateField(blank=True, null=True)
    tax_rate             = models.FloatField(default=0.18)
    status               = models.CharField(max_length=20, default="draft", choices=STATUS_CHOICES)
    notes                = models.TextField(blank=True, null=True)
    domaine              = models.CharField(max_length=50, blank=True, null=True, choices=DOMAINE_CHOICES)
    converted_to_invoice = models.BooleanField(default=False)
    invoice              = models.ForeignKey(
        Invoice, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="from_proforma"
    )
    discount_percent     = models.FloatField(default=0.0)
    discount_amount      = models.FloatField(default=0.0)
    created_at           = models.DateTimeField(default=timezone.now)
    updated_at           = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "proforma"
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return self.proforma_number or f"Proforma #{self.id}"

    def total_amount(self):
        return sum(item.subtotal() for item in self.items.all())

    def total_before_discount(self):
        return self.total_amount() * (1 + self.tax_rate)

    def discount_value(self):
        if self.discount_percent > 0:
            return self.total_before_discount() * (self.discount_percent / 100)
        return self.discount_amount

    def total_with_tax_and_discount(self):
        return self.total_before_discount() - self.discount_value()


class ProformaItem(models.Model):
    proforma         = models.ForeignKey(Proforma, on_delete=models.CASCADE, related_name="items")
    description      = models.TextField(blank=True, null=True)
    quantity         = models.FloatField(default=1)
    unit_price       = models.FloatField()
    tax_rate         = models.FloatField(blank=True, null=True)
    product          = models.ForeignKey(
        Product, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="proforma_items"
    )
    discount_percent = models.FloatField(default=0.0)

    class Meta:
        db_table = "proforma_item"

    def subtotal(self):
        return self.quantity * self.unit_price

    def subtotal_after_discount(self):
        return self.subtotal() * (1 - self.discount_percent / 100)