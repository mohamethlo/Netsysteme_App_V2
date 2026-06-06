# apps/calendar/views.py
import logging
import datetime

from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from .models import CalendarEvent
from .serializers import CalendarEventSerializer
from .management.commands.import_ics import _parse_ics_file, _parse_dt

logger = logging.getLogger(__name__)


class CalendarEventViewSet(viewsets.ModelViewSet):
    """
    CRUD complet pour les événements du calendrier.
    Endpoints extras :
      GET  /api/calendar/events/month/?year=&month= → événements d'un mois
      POST /api/calendar/events/<id>/sync-google/   → synchroniser avec Google Calendar
      POST /api/calendar/events/sync-all/           → synchroniser tous les événements
    """
    serializer_class   = CalendarEventSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["all_day", "google_synced"]
    search_fields      = ["title"]
    ordering_fields    = ["start", "created_at"]
    pagination_class   = None  # on retourne tout d'un coup (calendrier)

    def get_queryset(self):
        qs = CalendarEvent.objects.select_related("created_by").order_by("start")
        # Filtrage par plage de dates (optionnel)
        start = self.request.query_params.get("start")
        end   = self.request.query_params.get("end")
        if start:
            qs = qs.filter(start__gte=start)
        if end:
            qs = qs.filter(start__lte=end)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    # ── Événements d'un mois ──────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="month")
    def by_month(self, request):
        year  = int(request.query_params.get("year",  timezone.now().year))
        month = int(request.query_params.get("month", timezone.now().month))

        # Premiers et derniers jours du mois (avec buffer ±7j pour l'affichage calendrier)
        import calendar
        first = datetime.date(year, month, 1)
        last  = datetime.date(year, month, calendar.monthrange(year, month)[1])
        # Buffer pour afficher les jours du mois précédent/suivant visibles dans la grille
        start_buf = (first - datetime.timedelta(days=7)).isoformat()
        end_buf   = (last  + datetime.timedelta(days=7)).isoformat()

        qs = CalendarEvent.objects.filter(
            start__gte=start_buf,
            start__lte=end_buf + "Z",  # couvre aussi les datetime avec heure
        ).order_by("start")
        return Response(CalendarEventSerializer(qs, many=True).data)

    # ── Sync Google Calendar (un événement) ──────────────────────────────────
    @action(detail=True, methods=["post"], url_path="sync-google")
    def sync_google(self, request, pk=None):
        event = self.get_object()
        try:
            result = _sync_event_to_google(event)
            if result.get("success"):
                event.google_event_id = result.get("google_event_id")
                event.google_synced   = True
                event.synced_at       = timezone.now()
                event.last_sync_error = None
                event.save(update_fields=["google_event_id", "google_synced", "synced_at", "last_sync_error"])
                return Response({"success": True, "message": "Synchronisé avec Google Calendar."})
            else:
                event.last_sync_error = result.get("error", "Erreur inconnue")
                event.save(update_fields=["last_sync_error"])
                return Response({"success": False, "message": result.get("error")}, status=400)
        except Exception as e:
            logger.error("Erreur sync Google: %s", e)
            return Response({"success": False, "message": str(e)}, status=500)

    # ── Sync tous les événements non synchronisés ─────────────────────────────
    @action(detail=False, methods=["post"], url_path="sync-all")
    def sync_all(self, request):
        events = CalendarEvent.objects.filter(google_synced=False)
        synced, failed = 0, 0
        for event in events:
            try:
                result = _sync_event_to_google(event)
                if result.get("success"):
                    event.google_event_id = result.get("google_event_id")
                    event.google_synced   = True
                    event.synced_at       = timezone.now()
                    event.last_sync_error = None
                    synced += 1
                else:
                    event.last_sync_error = result.get("error")
                    failed += 1
                event.save(update_fields=["google_event_id", "google_synced", "synced_at", "last_sync_error"])
            except Exception as e:
                event.last_sync_error = str(e)
                event.save(update_fields=["last_sync_error"])
                failed += 1
        return Response({
            "success": True,
            "message": f"{synced} événement(s) synchronisé(s), {failed} échec(s).",
            "synced": synced, "failed": failed,
        })

    # ── Import fichier .ics ───────────────────────────────────────────────────
    @action(detail=False, methods=["post"], url_path="import-ics")
    def import_ics(self, request):
        """
        POST /api/calendar/events/import-ics/
        Body : multipart/form-data avec le champ 'file' contenant le .ics
        """
        ics_file = request.FILES.get("file")
        if not ics_file:
            return Response({"success": False, "message": "Aucun fichier envoyé (champ 'file' requis)."}, status=400)
        if not ics_file.name.lower().endswith(".ics"):
            return Response({"success": False, "message": "Le fichier doit avoir l'extension .ics"}, status=400)

        # Lire le contenu en mémoire (pas besoin de sauvegarder sur disque)
        content = ics_file.read().decode("utf-8", errors="replace")

        # Parser via la même logique que le management command
        import tempfile, os
        with tempfile.NamedTemporaryFile(mode="w", suffix=".ics", delete=False, encoding="utf-8") as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            raw_events = _parse_ics_file(tmp_path)
        finally:
            os.unlink(tmp_path)

        created = skipped = errors = 0
        imported_titles = []

        for raw in raw_events:
            title = raw.get("title", "(sans titre)")
            uid   = raw.get("uid", "")

            if not raw.get("dtstart_raw"):
                errors += 1
                continue

            try:
                iso_start, all_day = _parse_dt(raw["dtstart_raw"], raw.get("dtstart_params", {}))
            except Exception:
                errors += 1
                continue

            # Éviter les doublons via UID
            if uid and CalendarEvent.objects.filter(google_event_id=uid).exists():
                skipped += 1
                continue

            CalendarEvent.objects.create(
                title           = title,
                start           = iso_start,
                all_day         = all_day,
                google_event_id = uid or None,
                google_synced   = False,
                created_by      = request.user,
                created_at      = timezone.now(),
            )
            created += 1
            imported_titles.append(title)

        return Response({
            "success": True,
            "message": f"{created} événement(s) importé(s), {skipped} ignoré(s), {errors} erreur(s).",
            "created": created,
            "skipped": skipped,
            "errors":  errors,
            "imported": imported_titles,
        })

    # ── Statistiques ──────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        today  = timezone.now().date()
        total  = CalendarEvent.objects.count()
        synced = CalendarEvent.objects.filter(google_synced=True).count()
        upcoming = CalendarEvent.objects.filter(start__gte=today.isoformat()).count()
        today_count = CalendarEvent.objects.filter(start__startswith=today.isoformat()).count()
        return Response({
            "total":    total,
            "synced":   synced,
            "upcoming": upcoming,
            "today":    today_count,
        })


# ── Google Calendar integration (à compléter selon votre config OAuth) ───────
def _sync_event_to_google(event: CalendarEvent) -> dict:
    """
    Synchronise un événement vers Google Calendar via l'API Google.
    Nécessite : pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib
    Variables d'env : GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_JSON (chemin JSON)
    """
    import os
    cal_id       = os.environ.get("GOOGLE_CALENDAR_ID", "primary")
    sa_json_path = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")

    if not sa_json_path or not os.path.exists(sa_json_path):
        # Pas de config Google → simuler succès (dev)
        logger.warning("Google Calendar non configuré (GOOGLE_SERVICE_ACCOUNT_JSON manquant).")
        return {"success": True, "google_event_id": f"local_{event.id}"}

    try:
        from googleapiclient.discovery import build
        from google.oauth2 import service_account

        creds   = service_account.Credentials.from_service_account_file(
            sa_json_path,
            scopes=["https://www.googleapis.com/auth/calendar"],
        )
        service = build("calendar", "v3", credentials=creds)

        body = {
            "summary": event.title,
            "start":   {"date": event.start[:10]} if event.all_day else {"dateTime": event.start, "timeZone": "Africa/Dakar"},
            "end":     {"date": event.start[:10]} if event.all_day else {"dateTime": event.start, "timeZone": "Africa/Dakar"},
        }

        if event.google_event_id and not event.google_event_id.startswith("local_"):
            # Mise à jour
            result = service.events().update(calendarId=cal_id, eventId=event.google_event_id, body=body).execute()
        else:
            # Création
            result = service.events().insert(calendarId=cal_id, body=body).execute()

        return {"success": True, "google_event_id": result.get("id")}
    except Exception as e:
        return {"success": False, "error": str(e)}