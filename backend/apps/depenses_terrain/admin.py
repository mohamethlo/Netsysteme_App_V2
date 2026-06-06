from django.contrib import admin
from .models import DepenseTerrain, JustificatifDepense

class JustificatifInline(admin.TabularInline):
    model = JustificatifDepense
    extra = 0
    readonly_fields = ["uploaded_at"]

@admin.register(DepenseTerrain)
class DepenseTerrainAdmin(admin.ModelAdmin):
    list_display  = ["technicien", "type_depense", "montant", "date_depense", "statut", "created_at"]
    list_filter   = ["statut", "type_depense"]
    search_fields = ["technicien__prenom", "technicien__nom", "description"]
    inlines       = [JustificatifInline]
