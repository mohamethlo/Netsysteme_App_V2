from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from .models import Role, User


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display  = ['name', 'permissions', 'created_at']
    search_fields = ['name']
    ordering      = ['name']


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display   = ['username', 'full_name', 'email', 'role_badge', 'site', 'is_active', 'created_at']
    list_filter    = ['is_active', 'role', 'site']
    search_fields  = ['username', 'nom', 'prenom', 'email']
    ordering       = ['nom', 'prenom']
    readonly_fields = ['created_at', 'last_login']

    fieldsets = (
        ('Identité', {'fields': ('username', 'email', 'password')}),
        ('Informations personnelles', {'fields': ('nom', 'prenom', 'telephone', 'site')}),
        ('Rôle & Permissions', {'fields': ('role', 'permissions', 'is_active', 'is_staff', 'is_superuser')}),
        ('Dates', {'fields': ('created_at', 'last_login')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'password1', 'password2', 'nom', 'prenom', 'role'),
        }),
    )

    def full_name(self, obj):
        return f"{obj.prenom} {obj.nom}"
    full_name.short_description = 'Nom complet'

    def role_badge(self, obj):
        if not obj.role:
            return '—'
        colors = {'admin': '#dc2626', 'technicien': '#2563eb', 'commercial': '#16a34a'}
        color  = colors.get(obj.role.name.lower(), '#6b7280')
        return format_html(
            '<span style="background:{};color:white;padding:2px 8px;border-radius:4px;font-size:11px">{}</span>',
            color, obj.role.name
        )
    role_badge.short_description = 'Rôle'