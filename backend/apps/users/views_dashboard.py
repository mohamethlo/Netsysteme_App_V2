# ─────────────────────────────────────────────────────────────────────────────
#  apps/users/views_dashboard.py
#  Endpoint unique de statistiques dashboard — accessible à tous les utilisateurs
# ─────────────────────────────────────────────────────────────────────────────
import datetime
import logging
from django.db.models import Sum, F
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

logger = logging.getLogger(__name__)


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        month_start = today.replace(day=1)

        # ── Clients ───────────────────────────────────────────────────────────
        clients_total = prospects_total = 0
        try:
            from apps.clients.models import Client
            clients_total   = Client.objects.filter(type_client="client").count()
            prospects_total = Client.objects.filter(type_client="prospect").count()
        except Exception:
            pass

        # ── Interventions ─────────────────────────────────────────────────────
        interventions_total = interventions_planifiees = interventions_en_cours = 0
        interventions_terminees = interventions_urgentes = interventions_aujourd_hui = 0
        try:
            from apps.interventions.models import Intervention
            qs = Intervention.objects.all()
            interventions_total         = qs.count()
            interventions_planifiees    = qs.filter(statut="planifiee").count()
            interventions_en_cours      = qs.filter(statut="en_cours").count()
            interventions_terminees     = qs.filter(statut="terminee").count()
            interventions_urgentes      = qs.filter(
                priorite="urgente", statut__in=["planifiee", "en_cours"]
            ).count()
            interventions_aujourd_hui   = qs.filter(date_prevue__date=today).count()
        except Exception:
            pass

        # ── Installations ─────────────────────────────────────────────────────
        installations_total = installations_en_attente = installations_en_cours = 0
        installations_terminees = 0
        montant_total_installations = montant_restant_total = montant_avance_total = 0
        try:
            from apps.installations.models import Installation
            inst_qs = Installation.objects.all()
            installations_total      = inst_qs.count()
            installations_en_attente = inst_qs.filter(statut="en_attente").count()
            installations_en_cours   = inst_qs.filter(statut="en_cours").count()
            installations_terminees  = inst_qs.filter(statut="termine").count()
            agg = inst_qs.aggregate(
                restant=Sum("montant_restant"),
                avance=Sum("montant_avance"),
                total=Sum("montant_total"),
            )
            montant_restant_total       = round(agg["restant"] or 0, 2)
            montant_avance_total        = round(agg["avance"]  or 0, 2)
            montant_total_installations = round(agg["total"]   or 0, 2)
        except Exception:
            pass

        # ── Factures ──────────────────────────────────────────────────────────
        factures_total = factures_draft = 0
        montant_factures_total = montant_en_attente = 0
        try:
            from apps.billing.models import Invoice
            inv_qs = Invoice.objects.prefetch_related("items").all()
            factures_total         = inv_qs.count()
            factures_draft         = inv_qs.filter(status="draft").count()
            montant_factures_total = round(
                sum(i.total_with_tax_and_discount() for i in inv_qs), 2
            )
            montant_en_attente = round(
                sum(
                    i.total_with_tax_and_discount()
                    for i in inv_qs
                    if i.status in ("draft", "sent", "confirmed")
                ), 2
            )
        except Exception:
            pass

        # ── Présences ─────────────────────────────────────────────────────────
        presences_aujourd_hui = retards_aujourd_hui = techniciens_actifs = 0
        try:
            from apps.attendance.models import Attendance
            att_qs = Attendance.objects.filter(date=today)
            presences_aujourd_hui = att_qs.filter(check_in__isnull=False).count()
            retards_aujourd_hui   = att_qs.filter(status="late").count()
        except Exception:
            pass
        try:
            from django.contrib.auth import get_user_model
            _User = get_user_model()
            techniciens_actifs = _User.objects.filter(
                role__name__iexact="technicien", is_active=True
            ).count()
        except Exception:
            pass

        # ── Stock alertes ─────────────────────────────────────────────────────
        stock_alertes = 0
        try:
            from apps.inventory.models import InventoryItem
            stock_alertes = InventoryItem.objects.filter(
                quantity__lte=F("seuil_alerte")
            ).count()
        except Exception:
            pass

        # ── Activité récente ──────────────────────────────────────────────────
        recent_activity = []
        try:
            from apps.interventions.models import Intervention
            for i in Intervention.objects.select_related("client").order_by("-created_at")[:4]:
                client_name = (
                    i.client.display_name
                    if getattr(i, "client", None)
                    else (getattr(i, "client_libre_nom", None) or "—")
                )
                titre = getattr(i, "titre", None) or f"Intervention #{i.id}"
                recent_activity.append({
                    "type":  "intervention",
                    "title": f"Intervention #{i.id} — {titre[:45]}",
                    "sub":   client_name,
                    "time":  i.created_at.isoformat() if i.created_at else None,
                    "dot":   "interventions",
                })
        except Exception:
            pass
        try:
            from apps.installations.models import Installation
            for inst in Installation.objects.order_by("-created_at")[:3]:
                name = f"{inst.prenom or ''} {inst.nom or ''}".strip()
                recent_activity.append({
                    "type":  "installation",
                    "title": f"Installation #{inst.id}" + (f" — {name}" if name else ""),
                    "sub":   f"{int(inst.montant_total):,} FCFA · {inst.statut}".replace(",", " "),
                    "time":  inst.created_at.isoformat() if inst.created_at else None,
                    "dot":   "installations",
                })
        except Exception:
            pass
        recent_activity.sort(key=lambda x: x["time"] or "", reverse=True)
        recent_activity = recent_activity[:6]

        # ── Chart : Appels des 7 derniers jours ───────────────────────────────
        appels_7j = []
        appels_resultat = []
        try:
            from apps.clients.models import CallHistory
            for i in range(6, -1, -1):
                d = today - datetime.timedelta(days=i)
                total  = CallHistory.objects.filter(created_at__date=d).count()
                joints = CallHistory.objects.filter(
                    created_at__date=d, resultat_appel="client_joint"
                ).count()
                appels_7j.append({
                    "date":       d.strftime("%d/%m"),
                    "joints":     joints,
                    "non_joints": total - joints,
                })
            joints_total     = CallHistory.objects.filter(resultat_appel="client_joint").count()
            non_joints_total = CallHistory.objects.filter(resultat_appel="client_non_joint").count()
            appels_resultat = [
                {"name": "Joints",     "value": joints_total},
                {"name": "Non joints", "value": non_joints_total},
            ]
        except Exception:
            pass

        # ── Chart : Historique 6 mois (installations + interventions) ─────────
        hist_6mois = []
        try:
            for i in range(5, -1, -1):
                m = today.month - i
                y = today.year
                while m <= 0:
                    m += 12
                    y -= 1
                label = datetime.date(y, m, 1).strftime("%b")
                inst_c = interv_c = 0
                try:
                    from apps.installations.models import Installation
                    inst_c = Installation.objects.filter(
                        created_at__year=y, created_at__month=m
                    ).count()
                except Exception:
                    pass
                try:
                    from apps.interventions.models import Intervention
                    interv_c = Intervention.objects.filter(
                        created_at__year=y, created_at__month=m
                    ).count()
                except Exception:
                    pass
                hist_6mois.append({
                    "mois":          label,
                    "installations": inst_c,
                    "interventions": interv_c,
                })
        except Exception:
            pass

        # ── Performance commerciaux (mois en cours) ───────────────────────────
        perf_commerciaux = []
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            agents = User.objects.filter(role__name__iexact="commercial", is_active=True)
            logger.info("Dashboard perf_commerciaux: %d agent(s) trouvé(s)", agents.count())
            from apps.clients.models import CallHistory, Client
            from apps.installations.models import Installation as Inst

            for agent in agents:
                calls_mois   = CallHistory.objects.filter(
                    created_by=agent, created_at__date__gte=month_start
                )
                total_appels = calls_mois.count()
                joints       = calls_mois.filter(resultat_appel="client_joint").count()
                inst_mois    = Inst.objects.filter(
                    agent_commercial=agent, created_at__date__gte=month_start
                ).count()
                inst_total   = Inst.objects.filter(agent_commercial=agent).count()
                conversions  = Client.objects.filter(
                    converted_by=agent, converted_at__date__gte=month_start
                ).count()

                logger.info(
                    "Agent %s (id=%d): appels=%d, joints=%d, inst_total=%d, inst_mois=%d, conversions=%d | month_start=%s",
                    agent.username, agent.id,
                    total_appels, joints, inst_total, inst_mois, conversions,
                    month_start,
                )
                # Diagnostic : totaux sans filtre date
                logger.info(
                    "  -> CallHistory total (sans filtre date): %d | Inst total (sans filtre): %d | converted_by total: %d",
                    CallHistory.objects.filter(created_by=agent).count(),
                    Inst.objects.filter(agent_commercial=agent).count(),
                    Client.objects.filter(converted_by=agent).count(),
                )

                prenom = getattr(agent, "prenom", None) or ""
                nom    = getattr(agent, "nom",    None) or ""
                perf_commerciaux.append({
                    "id":          agent.id,
                    "name":        f"{prenom} {nom}".strip() or agent.username,
                    "appels":      total_appels,
                    "joints":      joints,
                    "taux_succes": round(joints / total_appels * 100) if total_appels > 0 else 0,
                    "inst_mois":   inst_mois,
                    "inst_total":  inst_total,
                    "conversions": conversions,
                })
        except Exception as e:
            logger.error("Dashboard perf_commerciaux erreur: %s", e, exc_info=True)

        # ── Performance techniciens ───────────────────────────────────────────
        perf_techniciens = []
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            techs = User.objects.filter(role__name__iexact="technicien", is_active=True)
            from apps.interventions.models import Intervention as Interv
            from apps.installations.models import Installation as Inst

            for tech in techs:
                interv_total     = Interv.objects.filter(technicien=tech).count()
                interv_terminees = Interv.objects.filter(technicien=tech, statut="terminee").count()
                interv_mois      = Interv.objects.filter(
                    technicien=tech, created_at__date__gte=month_start
                ).count()
                inst_total = Inst.objects.filter(techniciens=tech).count()
                inst_mois  = Inst.objects.filter(
                    techniciens=tech, created_at__date__gte=month_start
                ).count()

                if interv_total > 0 or inst_total > 0:
                    prenom = getattr(tech, "prenom", None) or ""
                    nom    = getattr(tech, "nom",    None) or ""
                    perf_techniciens.append({
                        "id":              tech.id,
                        "name":            f"{prenom} {nom}".strip() or tech.username,
                        "interv_total":    interv_total,
                        "interv_terminees":interv_terminees,
                        "interv_mois":     interv_mois,
                        "taux_completion": round(interv_terminees / interv_total * 100) if interv_total > 0 else 0,
                        "inst_total":      inst_total,
                        "inst_mois":       inst_mois,
                    })
        except Exception:
            pass

        return Response({
            # KPI
            "clients_total":               clients_total,
            "prospects_total":             prospects_total,
            "interventions_total":         interventions_total,
            "interventions_planifiees":    interventions_planifiees,
            "interventions_en_cours":      interventions_en_cours,
            "interventions_terminees":     interventions_terminees,
            "interventions_urgentes":      interventions_urgentes,
            "interventions_aujourd_hui":   interventions_aujourd_hui,
            "installations_total":         installations_total,
            "installations_en_attente":    installations_en_attente,
            "installations_en_cours":      installations_en_cours,
            "installations_terminees":     installations_terminees,
            "montant_total_installations": montant_total_installations,
            "montant_restant_total":       montant_restant_total,
            "montant_avance_total":        montant_avance_total,
            "factures_total":              factures_total,
            "factures_draft":              factures_draft,
            "montant_factures_total":      montant_factures_total,
            "montant_en_attente":          montant_en_attente,
            "presences_aujourd_hui":       presences_aujourd_hui,
            "retards_aujourd_hui":         retards_aujourd_hui,
            "techniciens_actifs":          techniciens_actifs,
            "stock_alertes":               stock_alertes,
            "recent_activity":             recent_activity,
            # Charts
            "appels_7j":                   appels_7j,
            "appels_resultat":             appels_resultat,
            "hist_6mois":                  hist_6mois,
            # Performance
            "perf_commerciaux":            perf_commerciaux,
            "perf_techniciens":            perf_techniciens,
        })
