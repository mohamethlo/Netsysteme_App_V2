# ─────────────────────────────────────────────────────────────────────────────
#  apps/users/urls.py
# ─────────────────────────────────────────────────────────────────────────────
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    LoginView, LogoutView,
    MeView, ProfileUpdateView, ChangePasswordView,
    RoleViewSet, UserViewSet,
)

router = DefaultRouter()
router.register(r"roles", RoleViewSet, basename="role")
router.register(r"users", UserViewSet, basename="user")

urlpatterns = [
    # Auth
    path("login/",          LoginView.as_view(),         name="auth-login"),
    path("logout/",         LogoutView.as_view(),        name="auth-logout"),
    path("token/refresh/",  TokenRefreshView.as_view(),  name="token-refresh"),

    # Profil connecté
    path("me/",             MeView.as_view(),             name="auth-me"),
    path("profile/",        ProfileUpdateView.as_view(),  name="auth-profile"),
    path("change-password/",ChangePasswordView.as_view(), name="auth-change-password"),

    # Rôles & utilisateurs
    path("", include(router.urls)),
]

# ── Endpoints ─────────────────────────────────────────────────────────────────
#  POST   /api/auth/login/
#  POST   /api/auth/logout/
#  POST   /api/auth/token/refresh/
#  GET    /api/auth/me/
#  PATCH  /api/auth/profile/
#  POST   /api/auth/change-password/
#
#  GET    /api/auth/roles/              → liste complète (sans pagination)
#  POST   /api/auth/roles/              → créer un rôle
#  GET    /api/auth/roles/{id}/         → détail
#  PATCH  /api/auth/roles/{id}/         → modifier
#  DELETE /api/auth/roles/{id}/         → supprimer (si aucun utilisateur)
#
#  GET    /api/auth/users/              → liste paginée
#  POST   /api/auth/users/              → créer
#  GET    /api/auth/users/{id}/         → détail
#  PATCH  /api/auth/users/{id}/         → modifier
#  DELETE /api/auth/users/{id}/         → supprimer (inactifs seulement)
#  GET    /api/auth/users/stats/        → compteurs
#  GET    /api/auth/users/available-permissions/
#  POST   /api/auth/users/{id}/toggle-active/
#  POST   /api/auth/users/{id}/reset-password/