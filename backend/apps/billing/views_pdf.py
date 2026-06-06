# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/views_pdf.py
#  Fix 406 : on hérite de View (pas APIView) pour contourner
#  la négociation de contenu DRF qui refuse application/pdf.
# ─────────────────────────────────────────────────────────────────────────────
import os
import json
from django.conf import settings
from django.core import signing
from django.http import HttpResponse, JsonResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated

from .models import Invoice, Proforma
from .pdf_invoice import generate_invoice_pdf
from .pdf_proforma import generate_proforma_pdf

PDF_TOKEN_SALT    = "pdf_access_token"
PDF_TOKEN_MAX_AGE = 3600  # 1 heure


def _static_dirs() -> list:
    dirs = list(getattr(settings, "STATICFILES_DIRS", []))
    if not dirs:
        dirs = [os.path.join(settings.BASE_DIR, "static")]
    return dirs


def _authenticate(request):
    """Vérifie le JWT manuellement (contourne DRF content negotiation)."""
    auth = JWTAuthentication()
    try:
        result = auth.authenticate(request)
        if result is None:
            raise NotAuthenticated("Token manquant.")
        return result[0]  # user
    except Exception as e:
        raise AuthenticationFailed(str(e))


def _check_signed_token(request, doc_type: str, pk: int) -> bool:
    """Valide le token signé passé en query param ?token=…"""
    token = request.GET.get("token")
    if not token:
        return False
    try:
        data = signing.loads(token, salt=PDF_TOKEN_SALT, max_age=PDF_TOKEN_MAX_AGE)
        return data.get("type") == doc_type and int(data.get("pk", -1)) == pk
    except signing.BadSignature:
        return False


@method_decorator(csrf_exempt, name="dispatch")
class InvoicePdfTokenView(View):
    """GET /api/billing/invoices/{pk}/pdf-token/
    Retourne un token signé valable 1 h pour accéder au PDF sans JWT header."""

    def get(self, request, pk):
        try:
            _authenticate(request)
        except (AuthenticationFailed, NotAuthenticated) as e:
            return HttpResponse(str(e), status=401, content_type="text/plain")

        if not Invoice.objects.filter(pk=pk).exists():
            return HttpResponse("Facture introuvable.", status=404, content_type="text/plain")

        token = signing.dumps({"type": "invoice", "pk": pk}, salt=PDF_TOKEN_SALT)
        return JsonResponse({"token": token})


@method_decorator(csrf_exempt, name="dispatch")
class ProformaPdfTokenView(View):
    """GET /api/billing/proformas/{pk}/pdf-token/
    Retourne un token signé valable 1 h pour accéder au PDF sans JWT header."""

    def get(self, request, pk):
        try:
            _authenticate(request)
        except (AuthenticationFailed, NotAuthenticated) as e:
            return HttpResponse(str(e), status=401, content_type="text/plain")

        if not Proforma.objects.filter(pk=pk).exists():
            return HttpResponse("Proforma introuvable.", status=404, content_type="text/plain")

        token = signing.dumps({"type": "proforma", "pk": pk}, salt=PDF_TOKEN_SALT)
        return JsonResponse({"token": token})


@method_decorator(csrf_exempt, name="dispatch")
class InvoicePDFView(View):
    """GET /api/billing/invoices/{pk}/pdf/
    Accepte soit le JWT header, soit ?token= (token signé 1 h)."""

    def get(self, request, pk):
        if not _check_signed_token(request, "invoice", pk):
            try:
                _authenticate(request)
            except (AuthenticationFailed, NotAuthenticated) as e:
                return HttpResponse(str(e), status=401, content_type="text/plain")

        try:
            invoice = (
                Invoice.objects
                .select_related("billing_client")
                .prefetch_related("items__product")
                .get(pk=pk)
            )
        except Invoice.DoesNotExist:
            return HttpResponse("Facture introuvable.", status=404, content_type="text/plain")

        try:
            pdf_bytes = generate_invoice_pdf(invoice, _static_dirs())
        except Exception as e:
            return HttpResponse(f"Erreur PDF : {e}", status=500, content_type="text/plain")

        client   = invoice.billing_client.display_name if invoice.billing_client else "client"
        filename = f"Facture de {client}.pdf"
        resp     = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="{filename}"'
        return resp


@method_decorator(csrf_exempt, name="dispatch")
class ProformaPDFView(View):
    """GET /api/billing/proformas/{pk}/pdf/
    Accepte soit le JWT header, soit ?token= (token signé 1 h)."""

    def get(self, request, pk):
        if not _check_signed_token(request, "proforma", pk):
            try:
                _authenticate(request)
            except (AuthenticationFailed, NotAuthenticated) as e:
                return HttpResponse(str(e), status=401, content_type="text/plain")

        try:
            proforma = (
                Proforma.objects
                .select_related("billing_client")
                .prefetch_related("items__product")
                .get(pk=pk)
            )
        except Proforma.DoesNotExist:
            return HttpResponse("Proforma introuvable.", status=404, content_type="text/plain")

        try:
            pdf_bytes = generate_proforma_pdf(proforma, _static_dirs())
        except Exception as e:
            return HttpResponse(f"Erreur PDF : {e}", status=500, content_type="text/plain")

        client   = proforma.billing_client.display_name if proforma.billing_client else "client"
        filename = f"Proforma de {client}.pdf"
        resp     = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="{filename}"'
        return resp