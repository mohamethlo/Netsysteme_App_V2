# ─────────────────────────────────────────────────────────────────────────────
#  apps/attendance/views.py
# ─────────────────────────────────────────────────────────────────────────────
import datetime
import logging
import math
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
from django.core.cache import cache
from django.utils import timezone
from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from .models import Attendance, WorkLocation
from .serializers import AttendanceSerializer, WorkLocationSerializer
from apps.messaging.utils import notify_admins

User = get_user_model()
HEURE_LIMITE = datetime.time(9, 15)
RAYON_DEFAUT = 100  # mètres


def _haversine(lat1, lon1, lat2, lon2) -> float:
    """Distance en mètres entre deux coordonnées GPS."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi  = math.radians(lat2 - lat1)
    dlam  = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


_WORK_LOCATIONS_CACHE_KEY = "active_work_locations"
_WORK_LOCATIONS_CACHE_TTL = 120  # 2 minutes


def _get_active_work_locations():
    """Retourne les zones actives depuis le cache ou la DB."""
    locations = cache.get(_WORK_LOCATIONS_CACHE_KEY)
    if locations is None:
        locations = list(WorkLocation.objects.filter(is_active=True))
        cache.set(_WORK_LOCATIONS_CACHE_KEY, locations, _WORK_LOCATIONS_CACHE_TTL)
    return locations


def _invalidate_work_locations_cache():
    cache.delete(_WORK_LOCATIONS_CACHE_KEY)


def _find_nearest_zone(lat, lon):
    """Retourne (WorkLocation, distance) la plus proche, ou (None, inf)."""
    nearest, min_dist = None, float("inf")
    for loc in _get_active_work_locations():
        d = _haversine(lat, lon, loc.latitude, loc.longitude)
        if d < min_dist:
            min_dist = d
            nearest = loc
    return nearest, min_dist


# ── WorkLocation CRUD ─────────────────────────────────────────────────────────
class WorkLocationViewSet(viewsets.ModelViewSet):
    queryset           = WorkLocation.objects.filter(is_active=True).order_by("name")
    serializer_class   = WorkLocationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class   = None

    def perform_create(self, serializer):
        serializer.save()
        _invalidate_work_locations_cache()

    def perform_update(self, serializer):
        serializer.save()
        _invalidate_work_locations_cache()

    def destroy(self, request, *args, **kwargs):
        loc = self.get_object()
        loc.is_active = False
        loc.save(update_fields=["is_active"])
        _invalidate_work_locations_cache()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Attendance ────────────────────────────────────────────────────────────────
class AttendanceViewSet(viewsets.ModelViewSet):
    """
    GET    /api/attendance/                → historique (admin = tous, user = soi)
    GET    /api/attendance/today/          → pointage du jour (utilisateur courant)
    GET    /api/attendance/daily-summary/  → présents/absents/retards du jour (admin)
    GET    /api/attendance/dashboard/      → stats globales (admin)
    POST   /api/attendance/check-in/       → pointer l'entrée
    POST   /api/attendance/check-out/      → pointer la sortie
    POST   /api/attendance/justify-late/   → soumettre une justification de retard
    """
    serializer_class   = AttendanceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ["status", "date", "user"]
    search_fields      = ["user__prenom", "user__nom", "user__username", "check_in_location"]
    ordering_fields    = ["date", "check_in", "check_out"]

    def get_queryset(self):
        user = self.request.user
        qs   = Attendance.objects.select_related("user", "work_location").order_by("-date", "-check_in")
        # Admin ou Administration → tout voir
        if user.has_business_permission("all") or (
            hasattr(user, "role") and user.role and user.role.name in ("Administration", "Administrateur")
        ):
            return qs
        return qs.filter(user=user)

    # ── Pointage du jour (utilisateur courant) ────────────────────────────────
    @action(detail=False, methods=["get"], url_path="today")
    def today(self, request):
        today = datetime.date.today()
        att   = Attendance.objects.select_related("work_location").filter(
            user=request.user, date=today
        ).first()

        work_locations = [
            {"id": l.id, "name": l.name, "latitude": l.latitude, "longitude": l.longitude,
             "radius": l.radius, "address": l.address, "type": l.type}
            for l in _get_active_work_locations()
        ]

        return Response({
            "today_attendance":    AttendanceSerializer(att, context={"request": request}).data if att else None,
            "is_late":             att.is_late            if att else False,
            "needs_justification": att.needs_justification if att else False,
            "work_locations":      work_locations,
            "date":                today.isoformat(),
        })

    # ── Check-in ──────────────────────────────────────────────────────────────
    @action(detail=False, methods=["post"], url_path="check-in")
    def check_in(self, request):
        lat  = request.data.get("latitude")
        lon  = request.data.get("longitude")
        zone_name = (request.data.get("location_name") or "").strip()

        if lat is None or lon is None:
            return Response({"success": False, "message": "Coordonnées GPS manquantes."},
                            status=status.HTTP_400_BAD_REQUEST)

        lat, lon = float(lat), float(lon)

        # Cherche une zone existante dans le rayon
        nearest, dist = _find_nearest_zone(lat, lon)
        found_location = nearest if (nearest and dist <= nearest.radius) else None

        # Si hors zone → besoin d'un nom pour créer la zone
        if not found_location:
            if not zone_name:
                return Response({"success": False, "need_zone_name": True,
                                 "message": "Aucune zone connue. Saisissez un nom pour ce lieu."})
            if WorkLocation.objects.filter(name=zone_name).exists():
                return Response({"success": False,
                                 "message": "Ce nom de zone existe déjà, choisissez-en un autre."})
            found_location = WorkLocation.objects.create(
                name=zone_name, latitude=lat, longitude=lon,
                radius=RAYON_DEFAUT, is_active=True, type="chantier",
            )
            _invalidate_work_locations_cache()

        # Vérifie si déjà pointé
        today = datetime.date.today()
        att   = Attendance.objects.filter(user=request.user, date=today).first()

        if att and att.check_in:
            return Response({"success": False, "message": "Vous êtes déjà pointé aujourd'hui."})

        now = timezone.now()
        if att:
            att.check_in          = now
            att.check_in_location = found_location.name
            att.check_in_lat      = lat
            att.check_in_lng      = lon
            att.work_location     = found_location
            att.status            = "late" if now.time() > HEURE_LIMITE else "present"
            att.save()
        else:
            att = Attendance.objects.create(
                user=request.user, date=today,
                check_in=now, check_in_location=found_location.name,
                check_in_lat=lat, check_in_lng=lon,
                work_location=found_location,
                status="late" if now.time() > HEURE_LIMITE else "present",
            )

        return Response({
            "success": True,
            "message": f"Pointage enregistré à {found_location.name}.",
            "attendance": AttendanceSerializer(att, context={"request": request}).data,
        })

    # ── Check-out ─────────────────────────────────────────────────────────────
    @action(detail=False, methods=["post"], url_path="check-out")
    def check_out(self, request):
        lat  = request.data.get("latitude")
        lon  = request.data.get("longitude")
        location_name = request.data.get("location", "Position inconnue")

        today = datetime.date.today()
        att   = Attendance.objects.filter(user=request.user, date=today).first()

        if not att or not att.check_in:
            return Response({"success": False, "message": "Vous devez d'abord pointer votre entrée."})
        if att.check_out:
            return Response({"success": False, "message": "Vous avez déjà pointé votre sortie aujourd'hui."})

        att.check_out          = timezone.now()
        att.check_out_location = location_name
        if lat is not None: att.check_out_lat = float(lat)
        if lon is not None: att.check_out_lng = float(lon)
        att.save(update_fields=["check_out", "check_out_location", "check_out_lat", "check_out_lng"])

        return Response({
            "success": True,
            "message": "Pointage de sortie enregistré.",
            "attendance": AttendanceSerializer(att, context={"request": request}).data,
        })

    # ── Justification retard ──────────────────────────────────────────────────
    @action(detail=False, methods=["post"], url_path="justify-late")
    def justify_late(self, request):
        reason = (request.data.get("reason") or "").strip()
        if not reason:
            return Response({"success": False, "message": "La justification ne peut pas être vide."},
                            status=status.HTTP_400_BAD_REQUEST)
        today = datetime.date.today()
        att   = Attendance.objects.filter(user=request.user, date=today).first()
        if not att:
            return Response({"success": False, "message": "Aucun pointage trouvé pour aujourd'hui."},
                            status=status.HTTP_404_NOT_FOUND)
        att.notes = reason
        att.save(update_fields=["notes"])

        # ── Notifier les admins ───────────────────────────────────────────────
        user      = request.user
        prenom    = getattr(user, "prenom", None) or user.first_name or ""
        nom       = getattr(user, "nom",    None) or user.last_name  or ""
        check_in  = att.check_in.strftime("%H:%M") if att.check_in else "—"
        try:
            notify_admins(
                f"Retard justifié : {prenom} {nom} (arrivée {check_in}) — {reason}"
            )
        except Exception as exc:
            logger.warning(f"justify_late: échec notification admins — {exc}")

        return Response({"success": True, "message": "Justification enregistrée."})

    # ── Résumé journalier (admin) ─────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="daily-summary")
    def daily_summary(self, request):
        user = request.user
        if not (user.has_business_permission("all") or (
            hasattr(user, "role") and user.role and user.role.name in ("Administration", "Administrateur")
        )):
            return Response({"detail": "Accès refusé."}, status=status.HTTP_403_FORBIDDEN)

        today      = datetime.date.today()
        all_users  = User.objects.filter(is_active=True).exclude(email="admin@entreprise.fr")
        att_today  = {a.user_id: a for a in Attendance.objects.filter(date=today)}

        presents, absents, retards = [], [], []
        for u in all_users:
            att = att_today.get(u.id)
            if att and att.check_in:
                presents.append(u)
                if att.is_late:
                    retards.append(u)
            else:
                absents.append(u)

        def user_dict(u):
            prenom = getattr(u, "prenom", "") or u.first_name or ""
            nom    = getattr(u, "nom",    "") or u.last_name  or ""
            return {"id": u.id, "prenom": prenom, "nom": nom,
                    "full_name": f"{prenom} {nom}".strip() or u.username}

        # Justifications pour les retards
        retards_with_notes = []
        for u in retards:
            att = att_today.get(u.id)
            d   = user_dict(u)
            d["notes"] = att.notes if att else None
            retards_with_notes.append(d)

        return Response({
            "date":    today.isoformat(),
            "presents": [user_dict(u) for u in presents],
            "absents":  [user_dict(u) for u in absents],
            "retards":  retards_with_notes,
        })

    # ── Localisations techniciens (Responsable Technique) ────────────────────
    @action(detail=False, methods=["get"], url_path="tech-locations")
    def tech_locations(self, request):
        user = request.user
        is_rt = (hasattr(user, "role") and user.role and
                 user.role.name == "Responsable Technique")
        if not (user.has_business_permission("all") or is_rt):
            return Response({"detail": "Accès refusé."}, status=status.HTTP_403_FORBIDDEN)

        today = datetime.date.today()
        technicians = (User.objects.filter(is_active=True, role__name="Technicien")
                       .select_related("role"))
        att_map = {
            a.user_id: a
            for a in Attendance.objects.filter(
                date=today, user__role__name="Technicien"
            ).select_related("work_location")
        }

        result = []
        for tech in technicians:
            att = att_map.get(tech.id)
            prenom = getattr(tech, "prenom", "") or tech.first_name or ""
            nom    = getattr(tech, "nom",    "") or tech.last_name  or ""
            full_name = f"{prenom} {nom}".strip() or tech.username

            item = {
                "id":                tech.id,
                "full_name":         full_name,
                "status":            att.status if (att and att.check_in) else "absent",
                "check_in_lat":      att.check_in_lat if att else None,
                "check_in_lng":      att.check_in_lng if att else None,
                "check_in_time":     att.check_in.strftime("%H:%M") if (att and att.check_in) else None,
                "check_in_location": att.check_in_location if att else None,
                "is_late":           att.is_late if att else False,
                "work_location":     None,
                "is_in_zone":        False,
            }

            if att and att.work_location:
                wl = att.work_location
                item["work_location"] = {
                    "id":        wl.id,
                    "name":      wl.name,
                    "latitude":  wl.latitude,
                    "longitude": wl.longitude,
                    "radius":    wl.radius,
                    "type":      wl.type,
                }
                if att.check_in_lat is not None and att.check_in_lng is not None:
                    dist = _haversine(att.check_in_lat, att.check_in_lng,
                                      wl.latitude, wl.longitude)
                    item["is_in_zone"] = dist <= wl.radius

            result.append(item)

        return Response(result)

    # ── Dashboard stats ───────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        today = datetime.date.today()
        qs    = self.get_queryset()
        return Response({
            "total_aujourd_hui": qs.filter(date=today).count(),
            "presents_aujourd_hui": qs.filter(date=today, check_in__isnull=False).count(),
            "retards_aujourd_hui":  qs.filter(date=today, status="late").count(),
            "total_ce_mois":        qs.filter(date__year=today.year, date__month=today.month).count(),
        })