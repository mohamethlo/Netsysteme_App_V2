# apps/assignments/views.py
import datetime as dt
import logging

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.attendance.models import Attendance, WorkLocation
from .models import TechnicianAssignment
from .serializers import TechnicianAssignmentSerializer

logger = logging.getLogger(__name__)
User   = get_user_model()


_MANAGER_ROLES = (
    "Administrateur", "Dev_administration", "administration",
    "Responsable Technique", "responsable_technique",
)

def _is_admin(user):
    return user.has_business_permission("all") or (
        hasattr(user, "role") and user.role and
        user.role.name in _MANAGER_ROLES
    )


def _full_name(user):
    fn = getattr(user, "prenom", "") or ""
    ln = getattr(user, "nom",    "") or ""
    return f"{fn} {ln}".strip() or user.username


def _technicians():
    """Retourne tous les techniciens actifs."""
    qs = User.objects.filter(is_active=True)
    # Filtre par rôle si le modèle User a un champ role
    try:
        qs = qs.filter(role__name="Technicien")
    except Exception:
        pass
    return qs.order_by("prenom", "nom") if hasattr(User, "prenom") else qs.order_by("first_name")


def _send_sms(technician, message: str, domain: str = "NETSYSTEME") -> dict:
    """Envoie un SMS si le module sms est disponible."""
    phone = getattr(technician, "telephone", None) or getattr(technician, "phone", None)
    if not phone:
        return {"sent": False, "error": "Numéro manquant"}
    try:
        from apps.sms.orange_service import OrangeSMSService
        svc    = OrangeSMSService(domain)
        result = svc.send_sms(phone, message)
        # Enregistrer dans l'historique SMS
        try:
            from apps.sms.models import SMSHistory
            SMSHistory.objects.create(
                recipient_name=_full_name(technician),
                phone=phone, message=message,
                status="success" if result.get("success") else "failed",
                sender_domain=domain,
            )
        except Exception:
            pass
        return {"sent": result.get("success", False), "error": result.get("message") if not result.get("success") else None}
    except ImportError:
        return {"sent": False, "error": "Module SMS non configuré"}
    except Exception as e:
        return {"sent": False, "error": str(e)}


class TechnicianAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class   = TechnicianAssignmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = TechnicianAssignment.objects.select_related(
            "technician", "work_location", "assigned_by"
        ).order_by("-assigned_at")
        # Filtres optionnels
        date_str = self.request.query_params.get("date")
        if date_str:
            try:
                qs = qs.filter(date=dt.date.fromisoformat(date_str))
            except ValueError:
                pass
        tech_id = self.request.query_params.get("technician_id")
        if tech_id:
            qs = qs.filter(technician_id=tech_id)
        active = self.request.query_params.get("active")
        if active == "1":
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(assigned_by=self.request.user)

    # ── Rapport quotidien ─────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="daily-report")
    def daily_report(self, request):
        if not _is_admin(request.user):
            return Response({"error": "Accès refusé."}, status=403)

        date_str = request.query_params.get("date", dt.date.today().isoformat())
        try:
            selected_date = dt.date.fromisoformat(date_str)
        except ValueError:
            return Response({"error": "Date invalide."}, status=400)

        is_future = selected_date > dt.date.today()
        techs     = list(_technicians())

        # Chargement groupé : 2 requêtes au lieu de 2×N
        tech_ids   = [t.id for t in techs]
        att_map    = {
            a.user_id: a
            for a in Attendance.objects.filter(user_id__in=tech_ids, date=selected_date)
        }
        assign_map: dict[int, list] = {}
        for a in TechnicianAssignment.objects.filter(
            technician_id__in=tech_ids, date=selected_date
        ).select_related("work_location").order_by("assigned_at"):
            assign_map.setdefault(a.technician_id, []).append(a)

        daily_data    = []
        present_count = 0
        absent_count  = 0
        total_hours   = 0.0

        for tech in techs:
            attendance  = att_map.get(tech.id)
            assignments = assign_map.get(tech.id, [])

            if attendance and attendance.check_in:
                present_count += 1
                total_minutes  = sum(a.duration_minutes for a in assignments)
                hours_worked   = round(total_minutes / 60, 1)
                total_hours   += hours_worked
                pointage_loc   = getattr(attendance, "check_in_location", None) or (
                    attendance.location.name if attendance.location else "Non spécifié"
                )
                active_assign  = next((a for a in assignments if a.is_active), None)
                if active_assign:
                    assigned_loc_name  = active_assign.work_location.name
                    assignment_status  = "assigned"
                elif assignments:
                    assigned_loc_name  = "Disponible"
                    assignment_status  = "available"
                else:
                    assigned_loc_name  = "Disponible"
                    assignment_status  = "available"
                status_val = "present"
            else:
                absent_count      += 1
                hours_worked       = 0.0
                pointage_loc       = "---"
                assigned_loc_name  = "Absent"
                assignment_status  = "absent"
                status_val         = "absent"

            daily_data.append({
                "technician": {
                    "id":                tech.id,
                    "name":              _full_name(tech),
                    "phone":             getattr(tech, "telephone", "") or "",
                    "assigned_location": assigned_loc_name,
                    "assignment_status": assignment_status,
                },
                "status":           status_val,
                "hours_worked":     hours_worked,
                "pointage_location":pointage_loc,
                "assignments_count":len(assignments),
            })

        # Présents en haut
        daily_data.sort(key=lambda x: (x["status"] != "present", x["technician"]["name"]))

        total  = len(daily_data)
        return Response({
            "daily_data":        daily_data,
            "selected_date":     selected_date.isoformat(),
            "total_technicians": total,
            "present_count":     present_count,
            "absent_count":      absent_count,
            "presence_rate":     round(present_count / total * 100, 1) if total else 0,
            "total_hours":       round(total_hours, 1),
            "avg_hours":         round(total_hours / present_count, 1) if present_count else 0,
            "is_future_date":    is_future,
        })

    # ── Affecter un technicien ────────────────────────────────────────────────
    @action(detail=False, methods=["post"], url_path="assign")
    def assign(self, request):
        if not _is_admin(request.user):
            return Response({"error": "Accès refusé."}, status=403)

        tech_id     = request.data.get("technician_id")
        location_id = request.data.get("location_id")   # None / 0 = libérer
        date_str    = request.data.get("date", dt.date.today().isoformat())
        sms_domain  = str(request.data.get("sms_domain", "NETSYSTEME")).upper()

        if not tech_id:
            return Response({"error": "technician_id requis."}, status=400)

        try:
            selected_date = dt.date.fromisoformat(date_str)
        except ValueError:
            return Response({"error": "Date invalide."}, status=400)

        if selected_date > dt.date.today():
            return Response({"error": "Impossible d'affecter pour une date future."}, status=400)

        try:
            tech = User.objects.get(pk=tech_id, is_active=True)
        except User.DoesNotExist:
            return Response({"error": "Technicien introuvable."}, status=404)

        # Vérifier présence
        attendance = Attendance.objects.filter(user=tech, date=selected_date).first()
        if not attendance or not attendance.check_in:
            return Response({"error": "Le technicien doit être présent pour être affecté."}, status=400)

        # Terminer l'affectation active si elle existe
        active = TechnicianAssignment.objects.filter(
            technician=tech, date=selected_date, is_active=True
        ).first()

        sms_result = {"sent": False, "error": None}
        now        = timezone.now()

        # ── Libérer ───────────────────────────────────────────────────────────
        if not location_id or location_id == 0:
            if active:
                active.is_active     = False
                active.unassigned_at = now
                active.save(update_fields=["is_active", "unassigned_at"])
                # SMS libération
                msg = (
                    f"Bonjour {getattr(tech, 'prenom', tech.first_name or tech.username)},\n\n"
                    f"✅ FIN D'AFFECTATION\n"
                    f"Date : {selected_date.strftime('%d/%m/%Y')}\n"
                    f"Heure : {now.strftime('%H:%M')}\n\n"
                    f"Vous avez été libéré de :\n{active.work_location.name}\n\n"
                    f"Merci pour votre travail !\n- NETSYSTEME"
                )
                sms_result = _send_sms(tech, msg, sms_domain)
                return Response({
                    "success":   True,
                    "message":   f"{_full_name(tech)} libéré(e) avec succès.",
                    "sms_sent":  sms_result["sent"],
                    "sms_error": sms_result["error"],
                })
            return Response({"success": True, "message": "Aucune affectation active à terminer.", "sms_sent": False})

        # ── Nouvelle affectation ──────────────────────────────────────────────
        try:
            location = WorkLocation.objects.get(pk=location_id, is_active=True)
        except WorkLocation.DoesNotExist:
            return Response({"error": "Zone de travail introuvable."}, status=404)

        if active:
            active.is_active     = False
            active.unassigned_at = now
            active.save(update_fields=["is_active", "unassigned_at"])

        new_assign = TechnicianAssignment.objects.create(
            technician=tech, work_location=location,
            date=selected_date, assigned_at=now,
            assigned_by=request.user, is_active=True,
        )

        # SMS affectation
        addr_line = f"\n📍 Adresse : {location.address[:60]}..." if getattr(location, "address", "") else ""
        gps_line  = (
            f"\nGPS : {location.latitude}, {location.longitude}"
            if getattr(location, "latitude", None) and getattr(location, "longitude", None)
            else ""
        )
        type_line = getattr(location, "type", "") or ""
        msg = (
            f"Bonjour {tech.prenom or tech.username},\n\n"
            f"📍 NOUVELLE AFFECTATION\n"
            f"Date : {selected_date.strftime('%d/%m/%Y')}\n"
            f"Heure : {now.strftime('%H:%M')}\n\n"
            f"Lieu : {location.name}\n"
            + (f"Type : {type_line.capitalize()}\n" if type_line else "")
            + addr_line + gps_line
            + f"\n\nBon courage !\n- NETSYSTEME"
        )
        sms_result = _send_sms(tech, msg, sms_domain)

        return Response({
            "success":       True,
            "message":       f"{_full_name(tech)} affecté(e) à {location.name}.",
            "assignment_id": new_assign.id,
            "sms_sent":      sms_result["sent"],
            "sms_error":     sms_result["error"],
        })

    # ── Historique d'un technicien pour une date ──────────────────────────────
    @action(detail=False, methods=["get"], url_path="history")
    def history(self, request):
        tech_id  = request.query_params.get("technician_id")
        date_str = request.query_params.get("date", dt.date.today().isoformat())
        if not tech_id:
            return Response({"error": "technician_id requis."}, status=400)
        try:
            sel_date = dt.date.fromisoformat(date_str)
        except ValueError:
            return Response({"error": "Date invalide."}, status=400)

        qs = TechnicianAssignment.objects.filter(
            technician_id=tech_id, date=sel_date
        ).select_related("work_location").order_by("assigned_at")

        data = [{
            "id":               a.id,
            "location":         a.work_location.name,
            "assigned_at":      a.assigned_at.strftime("%H:%M"),
            "unassigned_at":    a.unassigned_at.strftime("%H:%M") if a.unassigned_at else "En cours",
            "duration_minutes": a.duration_minutes,
            "duration_hours":   a.duration_hours,
            "is_active":        a.is_active,
        } for a in qs]

        total_min = sum(a.duration_minutes for a in qs)
        return Response({
            "success":       True,
            "assignments":   data,
            "total_minutes": total_min,
            "total_hours":   round(total_min / 60, 1),
        })

    # ── Liste techniciens enrichie ────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="technicians")
    def technicians_list(self, request):
        if not _is_admin(request.user):
            return Response({"error": "Accès refusé."}, status=403)

        date_str = request.query_params.get("date", dt.date.today().isoformat())
        try:
            sel_date = dt.date.fromisoformat(date_str)
        except ValueError:
            return Response({"error": "Date invalide."}, status=400)

        techs     = list(_technicians())
        tech_ids  = [t.id for t in techs]

        # Chargement groupé : 2 requêtes au lieu de 2×N
        att_map = {
            a.user_id: a
            for a in Attendance.objects.filter(user_id__in=tech_ids, date=sel_date)
        }
        active_assign_map = {
            a.technician_id: a
            for a in TechnicianAssignment.objects.filter(
                technician_id__in=tech_ids, date=sel_date, is_active=True
            ).select_related("work_location")
        }

        data = []

        for tech in techs:
            attendance    = att_map.get(tech.id)
            active_assign = active_assign_map.get(tech.id)
            is_present    = bool(attendance and attendance.check_in)

            data.append({
                "id":              tech.id,
                "name":            _full_name(tech),
                "phone":           getattr(tech, "telephone", "") or "",
                "email":           tech.email or "",
                "is_present":      is_present,
                "active_location": active_assign.work_location.name if active_assign else None,
                "active_assignment_id": active_assign.id if active_assign else None,
                "check_in_time": attendance.check_in.strftime("%H:%M") if is_present else None,

            })

        data.sort(key=lambda x: (not x["is_present"], x["name"]))
        return Response({"technicians": data, "date": sel_date.isoformat()})