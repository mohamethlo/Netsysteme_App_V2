# apps/users/permissions.py
from rest_framework.permissions import BasePermission


class IsAdminUser(BasePermission):
    """Autorise uniquement les utilisateurs avec permissions='all' ou rôle admin."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return request.user.has_business_permission("all")


class IsSelfOrAdmin(BasePermission):
    """Autorise l'utilisateur lui-même ou un admin."""
    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser:
            return True
        if obj == request.user:
            return True
        return request.user.has_business_permission("all")


class HasBusinessPermission(BasePermission):
    """Permission dynamique basée sur les permissions métier."""
    required_permission = None

    def has_permission(self, request, view):
        perm = getattr(view, "required_permission", self.required_permission)
        if not perm:
            return True
        return (
            request.user.is_authenticated
            and request.user.has_business_permission(perm)
        )


def make_permission(permission_name: str):
    """Factory pour créer une classe de permission à la volée."""
    class DynamicPermission(HasBusinessPermission):
        required_permission = permission_name
    DynamicPermission.__name__ = f"Has{permission_name.capitalize()}Permission"
    return DynamicPermission