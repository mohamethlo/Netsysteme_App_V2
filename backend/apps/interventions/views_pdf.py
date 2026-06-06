# ─────────────────────────────────────────────────────────────────────────────
#  apps/interventions/views_pdf.py
#  Même pattern que billing/views_pdf.py — hérite de View (pas APIView)
#  pour contourner la négociation de contenu DRF qui refuse application/pdf.
# ─────────────────────────────────────────────────────────────────────────────
import os
from django.conf import settings
from django.http import HttpResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated

from .models import Intervention
from .pdf_intervention import generate_intervention_pdf


def _static_dirs() -> list:
    dirs = list(getattr(settings, "STATICFILES_DIRS", []))
    if not dirs:
        dirs = [os.path.join(settings.BASE_DIR, "static")]
    return dirs


def _authenticate(request):
    auth = JWTAuthentication()
    try:
        result = auth.authenticate(request)
        if result is None:
            raise NotAuthenticated("Token manquant.")
        return result[0]
    except Exception as e:
        raise AuthenticationFailed(str(e))


@method_decorator(csrf_exempt, name="dispatch")
class InterventionPDFView(View):
    """GET /api/interventions/{pk}/pdf/"""

    def get(self, request, pk):
        try:
            _authenticate(request)
        except (AuthenticationFailed, NotAuthenticated) as e:
            return HttpResponse(str(e), status=401, content_type="text/plain")

        try:
            intervention = (
                Intervention.objects
                .select_related("client", "technicien", "created_by", "responsable")
                .prefetch_related("autres_intervenants", "materiels__article")
                .get(pk=pk)
            )
        except Intervention.DoesNotExist:
            return HttpResponse("Intervention introuvable.", status=404, content_type="text/plain")

        try:
            pdf_bytes = generate_intervention_pdf(intervention, _static_dirs())
        except Exception as e:
            return HttpResponse(f"Erreur PDF : {e}", status=500, content_type="text/plain")

        # Nom du client pour le fichier
        if intervention.client:
            client_label = f"{intervention.client.nom or ''} {intervention.client.prenom or ''}".strip()
        elif intervention.client_libre_nom:
            client_label = intervention.client_libre_nom
        else:
            client_label = str(intervention.id)
        # Nettoyer les caractères non sûrs pour un nom de fichier
        safe_client = "".join(c if c.isalnum() or c in " _-" else " " for c in client_label).strip()
        filename = f"Fiche Intervention {safe_client}.pdf"
        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="{filename}"'
        return resp