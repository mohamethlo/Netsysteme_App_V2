# ─────────────────────────────────────────────────────────────────────────────
#  apps/installations/views.py
#  Génération PDF via ReportLab (remplace WeasyPrint)
# ─────────────────────────────────────────────────────────────────────────────
import os
import datetime
from datetime import date, timedelta
from django.conf import settings
from django.core import signing
from django.db.models import Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

CONTRACT_TOKEN_SALT    = "contract_pdf_token"
CONTRACT_TOKEN_MAX_AGE = 3600  # 1 heure


def _check_contract_token(request, pk: int) -> bool:
    """Valide le token signé passé en query param ?token=…"""
    token = request.GET.get("token")
    if not token:
        return False
    try:
        data = signing.loads(token, salt=CONTRACT_TOKEN_SALT, max_age=CONTRACT_TOKEN_MAX_AGE)
        return data.get("type") == "contract" and int(data.get("pk", -1)) == int(pk)
    except signing.BadSignature:
        return False

from .models import Installation, InstallationProduct
from .serializers import InstallationSerializer, InstallationWriteSerializer
from .pdf_contract import generate_contract_pdf
from .pdf_receipt import generate_receipt_pdf
from .payment_reminder_service import payment_reminder_service


class InstallationViewSet(viewsets.ModelViewSet):
    """
    GET    /api/installations/                        → liste paginée
    POST   /api/installations/                        → créer
    GET    /api/installations/{id}/                   → détail
    PATCH  /api/installations/{id}/                   → modifier
    DELETE /api/installations/{id}/                   → supprimer + contrat
    GET    /api/installations/dashboard/              → stats globales
    GET    /api/installations/form-data/              → agents, techniciens, factures, produits
    POST   /api/installations/{id}/versement/         → enregistrer un versement
    POST   /api/installations/{id}/generate-contract/ → générer + sauvegarder PDF
    GET    /api/installations/{id}/contract-pdf/      → retourner le PDF inline
    """
    queryset = (
        Installation.objects
        .select_related("agent_commercial")
        .prefetch_related("techniciens", "products__product")
        .order_by("-created_at")
    )
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["statut", "methode_paiement", "agent_commercial"]
    search_fields      = ["prenom", "nom", "telephone", "adresse"]
    ordering_fields    = ["date_installation", "created_at", "montant_total", "montant_restant"]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return InstallationWriteSerializer
        return InstallationSerializer

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "request": self.request}

    # ── DELETE ────────────────────────────────────────────────────────────────
    def destroy(self, request, *args, **kwargs):
        installation = self.get_object()
        self._delete_contrat_file(installation.contrat_path)
        installation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── CREATE ────────────────────────────────────────────────────────────────
    def create(self, request, *args, **kwargs):
        import json
        contrat_path  = None
        contrat_file  = request.FILES.get("contrat")
        generate_pdf  = request.data.get("generate_contract") in ("1", "true", True)

        if contrat_file and contrat_file.name:
            contrat_path = self._save_contrat(contrat_file)

        data = request.data.dict() if hasattr(request.data, "dict") else dict(request.data)
        data = self._parse_json_fields(data)

        serializer = InstallationWriteSerializer(data=data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        installation = serializer.save()

        if contrat_path:
            installation.contrat_path = contrat_path
            installation.save(update_fields=["contrat_path"])

        if generate_pdf and not contrat_path:
            try:
                pdf_path = self._generate_and_save_pdf(installation)
                if pdf_path:
                    installation.contrat_path = pdf_path
                    installation.save(update_fields=["contrat_path"])
            except Exception as e:
                pass  # Installation créée, PDF échoué silencieusement

        return Response(
            InstallationSerializer(installation, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    # ── UPDATE ────────────────────────────────────────────────────────────────
    def update(self, request, *args, **kwargs):
        installation = self.get_object()
        contrat_file = request.FILES.get("contrat")
        data = request.data.dict() if hasattr(request.data, "dict") else dict(request.data)
        data = self._parse_json_fields(data)

        serializer = InstallationWriteSerializer(
            installation, data=data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        installation = serializer.save()

        if contrat_file and contrat_file.name:
            self._delete_contrat_file(installation.contrat_path)
            installation.contrat_path = self._save_contrat(contrat_file)
            installation.save(update_fields=["contrat_path"])
        else:
            try:
                old_path = installation.contrat_path
                pdf_path = self._generate_and_save_pdf(installation)
                if pdf_path:
                    self._delete_contrat_file(old_path)
                    installation.contrat_path = pdf_path
                    installation.save(update_fields=["contrat_path"])
            except Exception:
                pass

        return Response(InstallationSerializer(installation, context={"request": request}).data)

    # ── VERSEMENT ─────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="versement")
    def versement(self, request, pk=None):
        installation = self.get_object()
        try:
            montant = float(request.data.get("montant_verse", 0))
        except (ValueError, TypeError):
            return Response(
                {"detail": "montant_verse doit être un nombre."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if montant <= 0:
            return Response(
                {"detail": "Le montant doit être supérieur à 0."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if montant > installation.montant_restant:
            return Response(
                {"detail": f"Montant supérieur au restant ({installation.montant_restant} F)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        installation.montant_avance  += montant
        installation.montant_restant  = installation.montant_total - installation.montant_avance
        installation.save(update_fields=["montant_avance", "montant_restant"])

        # Générer le reçu PDF
        recu_url = None
        try:
            import datetime as _dt
            pdf_bytes  = generate_receipt_pdf(
                installation, montant,
                logo_path=self._logo_path(),
                cachet_path=self._cachet_path(),
            )
            upload_dir = os.path.join(settings.MEDIA_ROOT, "uploads", "recus")
            os.makedirs(upload_dir, exist_ok=True)
            prenom   = installation.prenom or ""
            nom      = installation.nom    or ""
            base     = f"Reçu de versement {prenom} {nom}".strip()
            filename = f"{base}.pdf"
            filepath = os.path.join(upload_dir, filename)
            counter  = 1
            while os.path.exists(filepath):
                filename = f"{base} ({counter}).pdf"
                filepath = os.path.join(upload_dir, filename)
                counter += 1
            with open(filepath, "wb") as f:
                f.write(pdf_bytes)
            recu_url = request.build_absolute_uri(f"/media/uploads/recus/{filename}")
        except Exception:
            pass

        return Response({
            "installation": InstallationSerializer(installation, context={"request": request}).data,
            "recu_url":     recu_url,
        })

    # ── GENERATE CONTRACT ─────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="generate-contract")
    def generate_contract(self, request, pk=None):
        """Génère le PDF ReportLab, le sauvegarde et met à jour contrat_path."""
        installation = self.get_object()
        try:
            old_path = installation.contrat_path
            pdf_path = self._generate_and_save_pdf(installation)
            if pdf_path:
                if old_path:
                    self._delete_contrat_file(old_path)
                installation.contrat_path = pdf_path
                installation.save(update_fields=["contrat_path"])
            return Response({
                "detail":      "Contrat PDF généré avec succès.",
                "contrat_path": pdf_path,
                "contrat_url":  request.build_absolute_uri(f"/media/{pdf_path}"),
                "installation": InstallationSerializer(
                    installation, context={"request": request}
                ).data,
            })
        except Exception as e:
            return Response(
                {"detail": f"Erreur génération PDF : {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    # ── CONTRACT PDF TOKEN ────────────────────────────────────────────────────
    @action(detail=True, methods=["get"], url_path="contract-pdf-token")
    def contract_pdf_token(self, request, pk=None):
        """GET /api/installations/{pk}/contract-pdf-token/
        Retourne un token signé valable 1 h pour accéder au PDF sans JWT header."""
        installation = self.get_object()
        token = signing.dumps({"type": "contract", "pk": installation.pk}, salt=CONTRACT_TOKEN_SALT)
        return Response({"token": token})

    # ── CONTRACT PDF (inline) ─────────────────────────────────────────────────
    @action(detail=True, methods=["get"], url_path="contract-pdf",
            permission_classes=[AllowAny])
    def contract_pdf(self, request, pk=None):
        """
        Retourne le PDF inline (pour aperçu navigateur).
        Accepte soit le JWT header, soit ?token= (token signé 1 h).
        Priorité :
          1. Fichier existant sur le disque
          2. Génération à la volée
        """
        if _check_contract_token(request, pk):
            # Token valide → pas besoin de JWT
            try:
                installation = Installation.objects.select_related(
                    "agent_commercial"
                ).prefetch_related(
                    "techniciens", "products__product"
                ).get(pk=pk)
            except Installation.DoesNotExist:
                return HttpResponse("Installation introuvable.", status=404, content_type="text/plain")
        else:
            installation = self.get_object()
            installation = Installation.objects.select_related(
                "agent_commercial"
            ).prefetch_related(
                "techniciens", "products__product"
            ).get(pk=installation.pk)

        # Fichier existant
        if installation.contrat_path:
            file_path = os.path.join(settings.MEDIA_ROOT, installation.contrat_path)
            if os.path.exists(file_path):
                with open(file_path, "rb") as f:
                    pdf_bytes = f.read()
                return self._pdf_response(pdf_bytes, installation)

        # Génération à la volée
        try:
            pdf_bytes = self._render_pdf_bytes(installation)
            return self._pdf_response(pdf_bytes, installation)
        except Exception as e:
            return Response(
                {"detail": f"Erreur PDF : {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    # ── DASHBOARD ─────────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        qs  = Installation.objects.all()
        agg = qs.aggregate(
            somme_total   = Sum("montant_total"),
            somme_restant = Sum("montant_restant"),
            somme_avance  = Sum("montant_avance"),
        )
        return Response({
            "total_installations": qs.count(),
            "en_attente":          qs.filter(statut="en_attente").count(),
            "en_cours":            qs.filter(statut="en_cours").count(),
            "terminees":           qs.filter(statut="termine").count(),
            "payees":              qs.filter(montant_restant__lte=0).count(),
            "somme_total":         round(agg["somme_total"]   or 0, 2),
            "somme_restant":       round(agg["somme_restant"] or 0, 2),
            "somme_avance":        round(agg["somme_avance"]  or 0, 2),
        })

    # ── FORM DATA ─────────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="form-data")
    def form_data(self, request):
        from django.contrib.auth import get_user_model
        from apps.billing.models import Invoice, Product
        from apps.billing.serializers import ProductSerializer

        User = get_user_model()

        def user_dict(u):
            prenom = getattr(u, "prenom", None) or ""
            nom    = getattr(u, "nom",    None) or ""
            return {"id": u.id, "prenom": prenom, "nom": nom,
                    "full_name": f"{prenom} {nom}".strip() or u.username}

        try:
            agents = User.objects.filter(role__name__iexact="commercial", is_active=True)
            techs  = User.objects.filter(role__name__iexact="technicien", is_active=True)
        except Exception:
            agents = User.objects.filter(is_active=True)
            techs  = User.objects.filter(is_active=True)

        invoices = (Invoice.objects
                    .filter(installation_id__isnull=True)
                    .select_related("billing_client")
                    .order_by("-date"))

        return Response({
            "agents_commerciaux": [user_dict(u) for u in agents],
            "techniciens":        [user_dict(u) for u in techs],
            "factures": [{
                "id":             inv.id,
                "invoice_number": inv.invoice_number,
                "date":           inv.date.strftime("%d/%m/%Y") if inv.date else None,
                "montant":        round(inv.total_with_tax_and_discount(), 2),
                "client":         inv.billing_client.display_name if inv.billing_client else None,
            } for inv in invoices],
            "products": ProductSerializer(
                Product.objects.all().order_by("name"),
                many=True, context={"request": request}
            ).data,
        })

    # ── RAPPELS DE PAIEMENT ───────────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="payment-reminders/dashboard")
    def payment_reminders_dashboard(self, request):
        """Statistiques du dashboard des rappels de paiement."""
        try:
            upcoming = payment_reminder_service.get_upcoming_payments()
            today    = date.today()

            j_minus_5, j_minus_2, j_day = [], [], []
            for p in upcoming:
                days = (p["payment_date"] - today).days
                if days == 5:
                    j_minus_5.append(p)
                elif days == 2:
                    j_minus_2.append(p)
                elif days == 0:
                    j_day.append(p)

            from apps.sms.models import SMSHistory
            today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            reminders_sent_today = SMSHistory.objects.filter(
                message_template__startswith="rappel_paiement",
                sent_at__gte=today_start,
                status="success",
            ).count()

            def _serialize(payments):
                return [{
                    "installation_id": p["installation"].id,
                    "client":          f"{p['installation'].prenom} {p['installation'].nom}",
                    "phone":           p["installation"].telephone,
                    "payment_date":    p["payment_date"].strftime("%Y-%m-%d"),
                    "payment_label":   p["payment_label"],
                    "payment_amount":  float(p["payment_amount"]),
                    "montant_restant": float(p["montant_restant_db"]),
                } for p in payments]

            return Response({
                "j_minus_5":           _serialize(j_minus_5),
                "j_minus_2":           _serialize(j_minus_2),
                "j_day":               _serialize(j_day),
                "reminders_sent_today": reminders_sent_today,
                "today":               today.strftime("%Y-%m-%d"),
            })
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=["get"], url_path="payment-reminders/summary")
    def reminders_summary(self, request):
        """Résumé des rappels qui seraient envoyés (sans les envoyer)."""
        try:
            summary = payment_reminder_service.get_reminders_to_send_summary()
            return Response({"success": True, "summary": summary})
        except Exception as e:
            return Response({"success": False, "detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=["post"], url_path="payment-reminders/check")
    def check_payment_reminders(self, request):
        """Vérifier et envoyer les rappels de paiement."""
        try:
            dry_run = request.data.get("dry_run", False)
            results = payment_reminder_service.check_and_send_reminders(dry_run=dry_run)

            if dry_run:
                message = (
                    f"TEST : {results['total_sent']} rappels seraient envoyés — "
                    f"J-5: {results['j_minus_5']['sent']}, "
                    f"J-2: {results['j_minus_2']['sent']}, "
                    f"J: {results['j_day']['sent']}"
                )
            else:
                message = (
                    f"{results['total_sent']} rappels envoyés avec succès — "
                    f"J-5: {results['j_minus_5']['sent']}, "
                    f"J-2: {results['j_minus_2']['sent']}, "
                    f"J: {results['j_day']['sent']}"
                )
                if results["total_failed"] > 0:
                    message += f" — {results['total_failed']} échec(s)"

            return Response({"success": True, "message": message, "results": results})
        except Exception as e:
            return Response({"success": False, "detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=["get"], url_path="payment-reminders/upcoming")
    def upcoming_payments(self, request):
        """Liste des paiements à venir (format JSON)."""
        try:
            today   = date.today()
            payments = payment_reminder_service.get_upcoming_payments()

            data = []
            for p in payments:
                inst       = p["installation"]
                pdate      = p["payment_date"]
                days_until = (pdate - today).days
                data.append({
                    "installation_id": inst.id,
                    "client_name":     f"{inst.prenom} {inst.nom}",
                    "phone":           inst.telephone,
                    "payment_date":    pdate.strftime("%Y-%m-%d"),
                    "payment_amount":  float(p["payment_amount"]),
                    "payment_label":   p["payment_label"],
                    "days_until":      days_until,
                    "reminder_needed": days_until in (5, 2, 0),
                    "reminder_type":   payment_reminder_service._days_to_type(days_until),
                })

            return Response({"success": True, "data": data, "total": len(data)})
        except Exception as e:
            return Response({"success": False, "detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=["get"], url_path="payment-reminders/history")
    def reminders_history(self, request):
        """Historique des rappels envoyés."""
        try:
            from apps.sms.models import SMSHistory

            period = request.query_params.get("period", "all")
            qs     = SMSHistory.objects.filter(message_template__startswith="rappel_paiement")

            if period == "today":
                qs = qs.filter(sent_at__gte=timezone.now().replace(hour=0, minute=0, second=0, microsecond=0))
            elif period == "week":
                qs = qs.filter(sent_at__gte=timezone.now() - timedelta(days=7))
            elif period == "month":
                qs = qs.filter(sent_at__gte=timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0))

            reminders = list(qs.order_by("-sent_at"))
            total     = len(reminders)
            success   = sum(1 for r in reminders if r.status == "success")
            failed    = sum(1 for r in reminders if r.status == "failed")

            data = [{
                "id":               r.id,
                "recipient_name":   r.recipient_name,
                "phone":            r.phone,
                "message_template": r.message_template,
                "status":           r.status,
                "sent_at":          r.sent_at.isoformat(),
                "installation_id":  r.installation_id,
                "extra_data":       r.extra_data,
            } for r in reminders]

            return Response({
                "success": True,
                "data": data,
                "statistics": {
                    "total":        total,
                    "success":      success,
                    "failed":       failed,
                    "success_rate": round((success / total * 100) if total > 0 else 0, 2),
                    "by_type": {
                        "j_minus_5": sum(1 for r in reminders if "j_minus_5" in (r.message_template or "")),
                        "j_minus_2": sum(1 for r in reminders if "j_minus_2" in (r.message_template or "")),
                        "j_day":     sum(1 for r in reminders if "j_day"     in (r.message_template or "")),
                    },
                },
            })
        except Exception as e:
            return Response({"success": False, "detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=["get"], url_path="payment-reminders/statistics")
    def reminders_statistics(self, request):
        """Statistiques globales des rappels de paiement."""
        try:
            from apps.sms.models import SMSHistory
            from django.db.models import Q

            base_qs = SMSHistory.objects.filter(message_template__startswith="rappel_paiement")

            today_start  = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            month_start  = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            week_ago     = timezone.now() - timedelta(days=7)

            total   = base_qs.count()
            success = base_qs.filter(status="success").count()
            failed  = base_qs.filter(status="failed").count()

            return Response({
                "success": True,
                "statistics": {
                    "total":        total,
                    "success":      success,
                    "failed":       failed,
                    "success_rate": round((success / total * 100) if total > 0 else 0, 2),
                    "today":        base_qs.filter(sent_at__gte=today_start).count(),
                    "week":         base_qs.filter(sent_at__gte=week_ago).count(),
                    "month":        base_qs.filter(sent_at__gte=month_start).count(),
                    "by_type": {
                        "j_minus_5": base_qs.filter(message_template="rappel_paiement_j_minus_5", status="success").count(),
                        "j_minus_2": base_qs.filter(message_template="rappel_paiement_j_minus_2", status="success").count(),
                        "j_day":     base_qs.filter(message_template="rappel_paiement_j_day",     status="success").count(),
                    },
                },
            })
        except Exception as e:
            return Response({"success": False, "detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"], url_path="send-reminder")
    def send_manual_reminder(self, request, pk=None):
        """Envoyer manuellement un rappel pour une installation."""
        try:
            payment_date = request.data.get("payment_date")
            result = payment_reminder_service.send_manual_reminder(pk, payment_date)
            return Response(result, status=status.HTTP_200_OK if result.get("success") else status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"success": False, "detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["get"], url_path="preview-reminder")
    def preview_reminder(self, request, pk=None):
        """Prévisualiser les messages de rappel pour une installation."""
        try:
            installation = self.get_object()

            if not installation.telephone:
                return Response({"success": False, "detail": "Numéro de téléphone manquant"}, status=status.HTTP_400_BAD_REQUEST)

            payment_dates = payment_reminder_service.calculate_payment_dates(installation)
            if not payment_dates:
                return Response({"success": False, "detail": "Aucune date de paiement trouvée"}, status=status.HTTP_400_BAD_REQUEST)

            today        = date.today()
            next_payment = next(
                (p for p in payment_dates if p["date"] >= today),
                payment_dates[0],
            )

            messages = {}
            for days in [5, 2, 0]:
                key = f"j_{days}" if days > 0 else "j_day"
                messages[key] = payment_reminder_service._generate_reminder_message(
                    installation,
                    {"payment_date": next_payment["date"], "payment_amount": next_payment["amount"], "payment_label": next_payment["label"]},
                    days,
                )

            return Response({
                "success":     True,
                "client_name": f"{installation.prenom} {installation.nom}",
                "phone":       installation.telephone,
                "next_payment": {
                    "date":            next_payment["date"].strftime("%d/%m/%Y"),
                    "amount":          float(next_payment["amount"]),
                    "montant_restant": float(installation.montant_restant),
                    "label":           next_payment["label"],
                },
                "messages": messages,
            })
        except Exception as e:
            return Response({"success": False, "detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _logo_path(self) -> str | None:
        """Cherche le logo SSE dans STATICFILES_DIRS."""
        candidates = getattr(settings, "STATICFILES_DIRS", [])
        if not candidates:
            candidates = [os.path.join(settings.BASE_DIR, "static")]
        for base in candidates:
            path = os.path.join(str(base), "img", "header_contrat_SSE.PNG")
            if os.path.exists(path):
                return path
        return None

    def _cachet_path(self) -> str | None:
        """Cherche le cachet SSE dans STATICFILES_DIRS."""
        candidates = getattr(settings, "STATICFILES_DIRS", [])
        if not candidates:
            candidates = [os.path.join(settings.BASE_DIR, "static")]
        for base in candidates:
            path = os.path.join(str(base), "img", "CachetSSE.PNG")
            if os.path.exists(path):
                return path
        return None

    def _render_pdf_bytes(self, installation) -> bytes:
        """Appelle generate_contract_pdf et retourne les bytes."""
        return generate_contract_pdf(
            installation,
            logo_path=self._logo_path(),
            cachet_path=self._cachet_path(),
        )

    def _generate_and_save_pdf(self, installation) -> str:
        """Génère le PDF, le sauvegarde, retourne le chemin relatif."""
        pdf_bytes  = self._render_pdf_bytes(installation)
        upload_dir = os.path.join(settings.MEDIA_ROOT, "uploads", "contrats")
        os.makedirs(upload_dir, exist_ok=True)

        prenom   = installation.prenom or ""
        nom      = installation.nom    or ""
        base     = f"Contrat de {prenom} {nom}".strip()
        filename = f"{base}.pdf"
        filepath = os.path.join(upload_dir, filename)
        counter  = 1
        while os.path.exists(filepath):
            filename = f"{base} ({counter}).pdf"
            filepath = os.path.join(upload_dir, filename)
            counter += 1

        with open(filepath, "wb") as f:
            f.write(pdf_bytes)
        return f"uploads/contrats/{filename}"

    def _pdf_response(self, pdf_bytes: bytes, installation) -> HttpResponse:
        prenom = installation.prenom or ""
        nom    = installation.nom    or ""
        name   = f"Contrat de {prenom} {nom}".strip() + ".pdf"
        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="{name}"'
        return resp

    def _save_contrat(self, file) -> str:
        upload_dir = os.path.join(settings.MEDIA_ROOT, "uploads", "contrats")
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, file.name)
        with open(file_path, "wb") as f:
            for chunk in file.chunks():
                f.write(chunk)
        return f"uploads/contrats/{file.name}"

    def _delete_contrat_file(self, contrat_path: str | None):
        if not contrat_path:
            return
        full = os.path.join(settings.MEDIA_ROOT, contrat_path)
        if os.path.exists(full):
            try:
                os.remove(full)
            except OSError:
                pass

    @staticmethod
    def _parse_json_fields(data: dict) -> dict:
        """Décode products_data et techniciens_ids si envoyés en JSON string."""
        import json
        for field in ("products_data", "techniciens_ids"):
            if field in data and isinstance(data[field], str):
                try:
                    data[field] = json.loads(data[field])
                except Exception:
                    data[field] = []
        return data