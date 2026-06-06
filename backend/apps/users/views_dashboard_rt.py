# ─────────────────────────────────────────────────────────────────────────────
#  apps/users/views_dashboard_rt.py
#  Dashboard stats pour le Responsable Technique
# ─────────────────────────────────────────────────────────────────────────────
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated


class DashboardRTStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()

        # ── Chantiers ─────────────────────────────────────────────────────────
        chantiers_total = chantiers_en_cours = chantiers_termines = chantiers_en_attente = 0
        try:
            from apps.chantiers.models import Chantier
            qs_ch = Chantier.objects.all()
            chantiers_total      = qs_ch.count()
            chantiers_en_cours   = qs_ch.filter(statut="en_cours").count()
            chantiers_termines   = qs_ch.filter(statut="termine").count()
            chantiers_en_attente = qs_ch.filter(statut="en_attente").count()
        except Exception:
            pass

        # ── Techniciens ───────────────────────────────────────────────────────
        techniciens_total = techniciens_actifs = 0
        techniciens_list  = []
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            qs_tech = User.objects.filter(role__name__iexact="technicien", is_active=True)
            techniciens_total  = qs_tech.count()
            techniciens_actifs = qs_tech.count()
            techniciens_list   = [
                {
                    "id":       t.id,
                    "nom":      f"{t.prenom} {t.nom}".strip() or t.username,
                    "site":     t.site,
                }
                for t in qs_tech[:10]
            ]
        except Exception:
            pass

        # ── Interventions (techniciens) ────────────────────────────────────────
        interventions_planifiees = interventions_en_cours = interventions_terminees = 0
        interventions_aujourd_hui = 0
        try:
            from apps.interventions.models import Intervention
            qs_iv = Intervention.objects.all()
            interventions_planifiees    = qs_iv.filter(statut="planifiee").count()
            interventions_en_cours      = qs_iv.filter(statut="en_cours").count()
            interventions_terminees     = qs_iv.filter(statut="terminee").count()
            interventions_aujourd_hui   = qs_iv.filter(date_prevue__date=today).count()
        except Exception:
            pass

        # ── Devis ─────────────────────────────────────────────────────────────
        devis_en_attente = devis_assignes = devis_completes = 0
        try:
            from apps.devis.models import Devis
            qs_dv = Devis.objects.all()
            devis_en_attente = qs_dv.filter(status="pending").count()
            devis_assignes   = qs_dv.filter(status="assigned").count()
            devis_completes  = qs_dv.filter(status="completed").count()
        except Exception:
            pass

        # ── Réservations outils ───────────────────────────────────────────────
        reservations_en_attente = reservations_approuvees = reservations_en_cours = 0
        try:
            from apps.outillage.models import ReservationOutil
            qs_ro = ReservationOutil.objects.all()
            reservations_en_attente = qs_ro.filter(statut="en_attente").count()
            reservations_approuvees = qs_ro.filter(statut="approuvee").count()
            reservations_en_cours   = qs_ro.filter(statut="en_cours").count()
        except Exception:
            pass

        # ── Affectations du jour ──────────────────────────────────────────────
        affectations_aujourd_hui = 0
        try:
            from apps.assignments.models import TechnicianAssignment
            affectations_aujourd_hui = TechnicianAssignment.objects.filter(
                date=today, is_active=True
            ).count()
        except Exception:
            pass

        # ── Chantiers récents ─────────────────────────────────────────────────
        chantiers_recents = []
        try:
            from apps.chantiers.models import Chantier
            for c in Chantier.objects.order_by("-created_at")[:5]:
                chantiers_recents.append({
                    "id":     c.id,
                    "nom":    c.nom,
                    "statut": c.statut,
                    "date":   c.date_debut.isoformat(),
                })
        except Exception:
            pass

        # ── Réservations récentes ─────────────────────────────────────────────
        reservations_recentes = []
        try:
            from apps.outillage.models import ReservationOutil
            for r in ReservationOutil.objects.select_related("outil", "technicien").order_by("-created_at")[:5]:
                reservations_recentes.append({
                    "id":         r.id,
                    "outil":      str(r.outil),
                    "technicien": f"{r.technicien.prenom} {r.technicien.nom}".strip(),
                    "statut":     r.statut,
                    "date_debut": r.date_debut.isoformat(),
                })
        except Exception:
            pass

        return Response({
            "chantiers_total":           chantiers_total,
            "chantiers_en_cours":        chantiers_en_cours,
            "chantiers_termines":        chantiers_termines,
            "chantiers_en_attente":      chantiers_en_attente,
            "techniciens_total":         techniciens_total,
            "techniciens_actifs":        techniciens_actifs,
            "techniciens_list":          techniciens_list,
            "interventions_planifiees":  interventions_planifiees,
            "interventions_en_cours":    interventions_en_cours,
            "interventions_terminees":   interventions_terminees,
            "interventions_aujourd_hui": interventions_aujourd_hui,
            "devis_en_attente":          devis_en_attente,
            "devis_assignes":            devis_assignes,
            "devis_completes":           devis_completes,
            "reservations_en_attente":   reservations_en_attente,
            "reservations_approuvees":   reservations_approuvees,
            "reservations_en_cours":     reservations_en_cours,
            "affectations_aujourd_hui":  affectations_aujourd_hui,
            "chantiers_recents":         chantiers_recents,
            "reservations_recentes":     reservations_recentes,
        })
