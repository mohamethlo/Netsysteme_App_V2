# ─────────────────────────────────────────────────────────────────────────────
#  apps/installations/urls.py
#  path('api/installations/', include('apps.installations.urls'))
# ─────────────────────────────────────────────────────────────────────────────
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InstallationViewSet

router = DefaultRouter()
router.register(r"", InstallationViewSet, basename="installation")

urlpatterns = [path("", include(router.urls))]

# ── Endpoints ─────────────────────────────────────────────────────────────────
#  GET    /api/installations/                                  → liste paginée
#  POST   /api/installations/                                  → créer (multipart)
#  GET    /api/installations/{id}/                             → détail
#  PATCH  /api/installations/{id}/                             → modifier
#  DELETE /api/installations/{id}/                             → supprimer + fichier contrat
#  GET    /api/installations/dashboard/                        → stats globales
#  GET    /api/installations/form-data/                        → agents, techniciens, factures, produits
#  POST   /api/installations/{id}/versement/                   → enregistrer un versement
#  POST   /api/installations/{id}/generate-contract/           → générer + sauvegarder PDF
#  GET    /api/installations/{id}/contract-pdf/                → afficher le PDF inline
#
#  ── Rappels de paiement ──────────────────────────────────────────────────────
#  GET    /api/installations/payment-reminders/dashboard/      → statistiques dashboard
#  GET    /api/installations/payment-reminders/summary/        → résumé avant envoi
#  POST   /api/installations/payment-reminders/check/          → envoyer rappels (dry_run optionnel)
#  GET    /api/installations/payment-reminders/upcoming/       → paiements à venir (JSON)
#  GET    /api/installations/payment-reminders/history/        → historique rappels envoyés
#  GET    /api/installations/payment-reminders/statistics/     → statistiques globales
#  POST   /api/installations/{id}/send-reminder/               → rappel manuel
#  GET    /api/installations/{id}/preview-reminder/            → prévisualiser les messages