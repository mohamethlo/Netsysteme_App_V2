# ─────────────────────────────────────────────────────────────────────────────
#  apps/clients/views.py
# ─────────────────────────────────────────────────────────────────────────────
import csv
import io
import datetime
from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q

from .models import Client, Reminder, CallHistory, ClientImportHistory
from .serializers import ClientSerializer, ReminderSerializer, CallHistorySerializer

User = get_user_model()


def _is_admin(user):
    return user.has_business_permission("all") or (
        hasattr(user, "role") and user.role and
        user.role.name in ("Administrateur", "Dev_administration")
    )

def _is_commercial(user):
    return hasattr(user, "role") and user.role and user.role.name.lower() == "commercial"


# ── Client ViewSet ────────────────────────────────────────────────────────────
class ClientViewSet(viewsets.ModelViewSet):
    serializer_class   = ClientSerializer
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["type_client", "is_blacklisted", "assigned_to"]
    search_fields      = ["nom", "prenom", "entreprise", "telephone", "email", "ville"]
    ordering_fields    = ["nom", "created_at", "entreprise"]

    def get_queryset(self):
        user = self.request.user
        qs   = Client.objects.select_related("assigned_to", "converted_by").prefetch_related("reminders")

        # Vue blacklistés
        if self.request.query_params.get("blacklisted") == "1":
            return qs.filter(is_blacklisted=True).order_by("-date_blacklisted")

        qs = qs.filter(is_blacklisted=False)

        # Admin → tous
        if _is_admin(user):
            return qs.order_by("-created_at", "nom")

        # Commercial → ses clients/prospects + prospects non encore contactés
        if _is_commercial(user):
            ses_contacts = Q(assigned_to=user) | Q(call_history__created_by=user) | Q(reminders__user=user)
            non_contactes = Q(
                type_client="prospect",
                assigned_to__isnull=True,
                call_history__isnull=True,
                reminders__isnull=True,
            )
            return qs.filter(ses_contacts | non_contactes).distinct().order_by("-created_at", "nom")

        return qs.filter(assigned_to=user).order_by("-created_at", "nom")

    def perform_create(self, serializer):
        # Vérifier doublon téléphone
        telephone = self.request.data.get("telephone")
        if telephone and Client.objects.filter(telephone=telephone).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"telephone": "Un client avec ce numéro de téléphone existe déjà."})
        # Auto-assigner le commercial si aucun assigned_to fourni
        kwargs = {}
        if _is_commercial(self.request.user) and not serializer.validated_data.get("assigned_to"):
            kwargs["assigned_to"] = self.request.user
        serializer.save(**kwargs)

    def perform_update(self, serializer):
        telephone = self.request.data.get("telephone")
        if telephone:
            existing = Client.objects.filter(telephone=telephone).exclude(pk=serializer.instance.pk).first()
            if existing:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({"telephone": "Un client avec ce numéro de téléphone existe déjà."})
        serializer.save()

    # ── Stats ─────────────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        base = Client.objects.filter(is_blacklisted=False)
        if _is_commercial(request.user):
            base = base.filter(
                Q(assigned_to=request.user) |
                Q(call_history__created_by=request.user) |
                Q(reminders__user=request.user)
            ).distinct()
        data = {
            "total":          base.count(),
            "total_clients":  base.filter(type_client="client").count(),
            "total_prospects":base.filter(type_client="prospect").count(),
        }
        if _is_admin(request.user):
            data["blacklisted"] = Client.objects.filter(is_blacklisted=True).count()
        return Response(data)

    # ── Convertir prospect → client ───────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="convert")
    def convert(self, request, pk=None):
        client = self.get_object()
        if client.type_client == "client":
            return Response({"detail": "Ce contact est déjà un client."}, status=400)
        note = request.data.get("note", "")
        client.type_client    = "client"
        client.note_conversion= note
        client.converted_by   = request.user
        client.converted_at   = timezone.now()
        client.save(update_fields=["type_client", "note_conversion", "converted_by", "converted_at"])
        return Response(ClientSerializer(client, context={"request": request}).data)

    # ── Blacklister ───────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="blacklist")
    def blacklist(self, request, pk=None):
        client = self.get_object()
        client.is_blacklisted   = True
        client.date_blacklisted = timezone.now()
        client.save(update_fields=["is_blacklisted", "date_blacklisted"])
        return Response({"success": True, "message": f"{client.display_name} blacklisté."})

    # ── Rappel ────────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="remind")
    def remind(self, request, pk=None):
        client     = self.get_object()
        notes      = request.data.get("notes", "")
        remind_date= request.data.get("remind_date")
        if not notes:
            return Response({"success": False, "message": "Notes requises."}, status=400)
        remind_at = None
        if remind_date:
            try:
                naive = datetime.datetime.strptime(remind_date, "%Y-%m-%dT%H:%M")
            except ValueError:
                try:
                    naive = datetime.datetime.strptime(remind_date, "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    naive = datetime.datetime.strptime(remind_date, "%Y-%m-%d %H:%M")
            remind_at = timezone.make_aware(naive)
        reminder = Reminder.objects.create(
            client=client, user=request.user, notes=notes,
            remind_at=remind_at,
        )
        # Premier contact via rappel → le prospect appartient à ce commercial
        if client.assigned_to is None and _is_commercial(request.user):
            client.assigned_to = request.user
            client.save(update_fields=["assigned_to"])
        return Response({
            "success": True,
            "message": "Rappel enregistré.",
            "reminder": ReminderSerializer(reminder).data,
        })

    # ── Supprimer dernier import ───────────────────────────────────────────────
    @action(detail=False, methods=["delete"], url_path="delete-last-import")
    def delete_last_import(self, request):
        if _is_admin(request.user):
            last = ClientImportHistory.objects.order_by("-imported_at").first()
        else:
            last = ClientImportHistory.objects.filter(imported_by=request.user).order_by("-imported_at").first()

        if not last:
            return Response({"detail": "Aucune importation trouvée."}, status=404)

        count = last.clients.count()
        last.clients.all().delete()
        last.delete()
        return Response({"success": True, "message": f"Import supprimé ({count} clients retirés).", "count": count})

    # ── Import Excel ───────────────────────────────────────────────────────────
    @action(detail=False, methods=["post"], url_path="import")
    def import_clients(self, request):
        fichier = request.FILES.get("file")
        if not fichier:
            return Response({"detail": "Fichier manquant."}, status=400)

        try:
            import pandas as pd
            df = pd.read_excel(fichier)
            df.columns = df.columns.str.strip().str.lower()

            # ── Mapping des colonnes du fichier → noms standards ──────────────
            df.rename(columns={
                "téléphone":       "telephone",
                "prénom":          "prenom",
                "code postal":     "code_postal",
                "type":            "type_client",
                "date de création":"created_at_raw",  # ignoré, non utilisé
            }, inplace=True)

            expected = ["nom", "prenom", "entreprise", "email", "telephone", "adresse", "ville", "code_postal", "type_client"]
            for col in expected:
                if col not in df.columns:
                    df[col] = None

            df = df.where(pd.notnull(df), None)

            history = ClientImportHistory.objects.create(filename=fichier.name, imported_by=request.user)

            inserted = 0
            ignored  = 0
            new_clients = []
            seen_phones = set()

            def safe(v):
                if v is None:
                    return ""
                try:
                    if isinstance(v, float):
                        if v != v:  # NaN
                            return ""
                        if v.is_integer():
                            v = int(v)
                    s = str(v).strip()
                    if s.lower() == "nan":
                        return ""
                    return s
                except Exception:
                    return ""

            # Pré-charger tous les téléphones existants en une seule requête
            all_phones_in_df = {
                safe(row.get("telephone"))
                for _, row in df.iterrows()
                if safe(row.get("telephone"))
            }
            existing_phones = set(
                Client.objects.filter(telephone__in=all_phones_in_df)
                .values_list("telephone", flat=True)
            )

            for _, row in df.iterrows():
                tel = safe(row.get("telephone"))
                if not tel:
                    ignored += 1; continue
                if tel in seen_phones or tel in existing_phones:
                    ignored += 1; continue

                seen_phones.add(tel)

                c = Client(
                    nom=safe(row.get("nom")) or "Inconnu",
                    prenom=safe(row.get("prenom")) or None,
                    entreprise=safe(row.get("entreprise")) or None,
                    email=safe(row.get("email")) or None,
                    telephone=tel,
                    adresse=safe(row.get("adresse")) or None,
                    ville=safe(row.get("ville")) or None,
                    code_postal=safe(row.get("code_postal")) or None,
                    type_client=(safe(row.get("type_client")) or "prospect").lower(),
                    import_history=history,
                    assigned_to=request.user if _is_commercial(request.user) else None,
                )
                new_clients.append(c)
                inserted += 1

            if new_clients:
                Client.objects.bulk_create(new_clients)
            else:
                history.delete()

            return Response({
                "success": True,
                "message": f"{inserted} client(s) importé(s), {ignored} ignoré(s).",
                "inserted": inserted, "ignored": ignored,
            })

        except Exception as e:
            return Response({"detail": f"Erreur import : {e}"}, status=500)
    

    # ── Export CSV ────────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="export-csv")
    def export_csv(self, request):
        qs = self.get_queryset().filter(is_blacklisted=False)
        output = io.StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerow(["Nom", "Prénom", "Entreprise", "Email", "Téléphone", "Adresse", "Ville", "Code Postal", "Type", "Date création"])
        for c in qs:
            writer.writerow([
                c.nom, c.prenom or "", c.entreprise or "", c.email or "",
                c.telephone or "", c.adresse or "", c.ville or "", c.code_postal or "",
                "Client" if c.type_client == "client" else "Prospect",
                c.created_at.strftime("%d/%m/%Y %H:%M") if c.created_at else "",
            ])
        resp = HttpResponse("\ufeff" + output.getvalue(), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="clients_{datetime.datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"'
        return resp


# ── CallHistory ViewSet ───────────────────────────────────────────────────────
class CallHistoryViewSet(viewsets.ModelViewSet):
    serializer_class   = CallHistorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, OrderingFilter]
    filterset_fields   = ["client", "resultat_appel"]
    ordering_fields    = ["created_at", "date_appel"]

    def get_queryset(self):
        qs = CallHistory.objects.select_related("client", "created_by").order_by("-created_at")
        client_id = self.request.query_params.get("client_id")
        if client_id:
            qs = qs.filter(client_id=client_id)
        # Filtres période
        period = self.request.query_params.get("period")
        if period and period != "all":
            now = timezone.now()
            if period == "today":
                qs = qs.filter(created_at__date=now.date())
            elif period == "week":
                start = now - datetime.timedelta(days=now.weekday())
                qs = qs.filter(created_at__gte=start.replace(hour=0, minute=0, second=0))
            elif period == "month":
                qs = qs.filter(created_at__year=now.year, created_at__month=now.month)
        result = self.request.query_params.get("result")
        if result and result != "all":
            qs = qs.filter(resultat_appel=result)
        return qs

    def perform_create(self, serializer):
        instance = serializer.save(
            created_by=self.request.user,
            date_appel=datetime.date.today(),
        )
        # Premier contact → le prospect appartient à ce commercial
        client = instance.client
        if client.assigned_to is None and _is_commercial(self.request.user):
            client.assigned_to = self.request.user
            client.save(update_fields=["assigned_to"])

    # ── Export CSV historique appels ──────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="export-csv")
    def export_csv(self, request):
        client_id = request.query_params.get("client_id")
        if not client_id:
            return Response({"detail": "client_id requis."}, status=400)
        qs = self.get_queryset().filter(client_id=client_id)
        output = io.StringIO()
        writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_ALL)
        writer.writerow(["Date", "Heure", "Nom", "Prénom", "Adresse", "Contact 1", "Contact 2",
                         "Résultat", "Catégorie", "Motif", "Motif refus", "Détail refus",
                         "Moratoire", "Commentaires", "Date appel", "Date installation",
                         "Maintenance 1", "Maintenance 2", "Créé par"])
        for c in qs:
            writer.writerow([
                c.created_at.strftime("%d/%m/%Y") if c.created_at else "",
                c.created_at.strftime("%H:%M:%S") if c.created_at else "",
                c.nom, c.prenom or "", c.adresse or "", c.contact_1, c.contact_2 or "",
                c.resultat_appel, c.categorie or "", c.motif_principal or "",
                c.motif_refus or "", c.motif_refus_detail or "", c.moratoire or "",
                c.commentaires or "",
                c.date_appel.strftime("%d/%m/%Y") if c.date_appel else "",
                c.date_installation.strftime("%d/%m/%Y") if c.date_installation else "",
                c.date_maintenance_1.strftime("%d/%m/%Y") if c.date_maintenance_1 else "",
                c.date_maintenance_2.strftime("%d/%m/%Y") if c.date_maintenance_2 else "",
                c.created_by.username if c.created_by else "",
            ])
        resp = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="historique_appels_{client_id}.csv"'
        return resp