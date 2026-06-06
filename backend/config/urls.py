from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/auth/', include('apps.users.urls')),
    path('api/attendance/', include('apps.attendance.urls')),
    path("api/reports/", include("apps.attendance.urls_reports")),

    path('api/clients/', include('apps.clients.urls')),
    path('api/interventions/', include('apps.interventions.urls')),
    path('api/inventory/', include('apps.inventory.urls')),
    path('api/billing/', include('apps.billing.urls')),
    path('api/billing-clients/', include('apps.billing.urls_clients')),
    path('api/products/', include('apps.billing.urls_products')),
    path('api/proformas/', include('apps.billing.urls_proformas')),
    path('api/invoices/', include('apps.billing.urls_invoices')),
    path('api/installations/', include('apps.installations.urls')),
    path('api/messaging/', include('apps.messaging.urls')),
    path("api/expenses/", include("apps.expenses.urls")),
    path("api/sms/", include("apps.sms.urls")),
    path("api/assignments/", include("apps.assignments.urls")),
    path("api/advances/", include("apps.advances.urls")),
    path("api/devis/", include("apps.devis.urls")),
    path("api/dashboard/", include("apps.users.urls_dashboard")),
    path("api/calendrier/", include("apps.calendrier.urls")),
    path("api/chantiers/",         include("apps.chantiers.urls")),
    path("api/outillage/",         include("apps.outillage.urls")),
    path("api/depenses-terrain/",  include("apps.depenses_terrain.urls")),


] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)