"""
Commande management : envoie le rapport de présence du jour par email.
Usage : python manage.py send_presence_report [--date YYYY-MM-DD]
"""
import datetime
import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.attendance.models import Attendance

logger = logging.getLogger(__name__)
User = get_user_model()

LATE_TIME = datetime.time(9, 15)
JOURS_FR  = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]

STATUS_LABELS = {
    "present":  "Présent",
    "absent":   "Absent",
    "late":     "En retard",
    "half_day": "Demi-journée",
    "on_leave": "Congé",
}

STATUS_COLORS = {
    "present":  "#28a745",
    "late":     "#ffc107",
    "absent":   "#dc3545",
    "half_day": "#17a2b8",
    "on_leave": "#6c757d",
}


def _full_name(user) -> str:
    fn = getattr(user, "prenom", "") or user.first_name or ""
    ln = getattr(user, "nom",    "") or user.last_name  or ""
    return f"{fn} {ln}".strip() or user.username


def _build_daily_report(report_date: datetime.date) -> dict:
    employees = User.objects.filter(is_active=True).select_related("role").order_by("nom", "prenom")
    attendances = {
        a.user_id: a
        for a in Attendance.objects.filter(date=report_date).select_related("user", "work_location")
    }

    rows = []
    stats = {"present": 0, "absent": 0, "late": 0, "on_leave": 0, "half_day": 0}

    for emp in employees:
        att = attendances.get(emp.id)
        if att:
            ci = timezone.localtime(att.check_in)  if att.check_in  else None
            co = timezone.localtime(att.check_out) if att.check_out else None
            is_late = bool(ci and ci.time() > LATE_TIME)
            status  = "late" if is_late else (att.status or "present")
            rows.append({
                "name":      _full_name(emp),
                "role":      emp.role.name if emp.role else "—",
                "check_in":  ci.strftime("%H:%M") if ci else "—",
                "check_out": co.strftime("%H:%M") if co else "—",
                "location":  att.work_location.name if att.work_location else "—",
                "status":    status,
                "notes":     att.notes or "",
            })
        else:
            status = "absent"
            rows.append({
                "name":      _full_name(emp),
                "role":      emp.role.name if emp.role else "—",
                "check_in":  "—",
                "check_out": "—",
                "location":  "—",
                "status":    status,
                "notes":     "",
            })

        if status in stats:
            stats[status] += 1
        else:
            stats["present"] += 1

    total = len(rows)
    rate  = round(stats["present"] / total * 100, 1) if total else 0.0

    return {
        "date":    report_date,
        "day_name": JOURS_FR[report_date.weekday()],
        "rows":    sorted(rows, key=lambda r: (
            {"present": 0, "half_day": 1, "on_leave": 1, "late": 2, "absent": 3}.get(r["status"], 1),
            r["name"],
        )),
        "stats":   stats,
        "total":   total,
        "rate":    rate,
    }


def _build_html(data: dict) -> str:
    date_str = data["date"].strftime("%d/%m/%Y")
    day_name = data["day_name"]
    stats    = data["stats"]
    total    = data["total"]
    rate     = data["rate"]
    generated_at = datetime.datetime.now().strftime("%d/%m/%Y à %H:%M")

    rows_html = ""
    for r in data["rows"]:
        color  = STATUS_COLORS.get(r["status"], "#6c757d")
        label  = STATUS_LABELS.get(r["status"], r["status"])
        notes  = f'<br><small style="color:#888;">{r["notes"]}</small>' if r["notes"] else ""
        rows_html += f"""
        <tr>
          <td style="padding:10px 12px; border-bottom:1px solid #eee;">{r['name']}</td>
          <td style="padding:10px 12px; border-bottom:1px solid #eee; color:#555;">{r['role']}</td>
          <td style="padding:10px 12px; border-bottom:1px solid #eee; text-align:center;">{r['check_in']}</td>
          <td style="padding:10px 12px; border-bottom:1px solid #eee; text-align:center;">{r['check_out']}</td>
          <td style="padding:10px 12px; border-bottom:1px solid #eee; color:#555;">{r['location']}</td>
          <td style="padding:10px 12px; border-bottom:1px solid #eee; text-align:center;">
            <span style="background:{color}; color:#fff; padding:3px 10px; border-radius:12px;
                         font-size:12px; font-weight:600;">{label}</span>
            {notes}
          </td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#f4f6f9; font-family:Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9; padding:30px 0;">
    <tr><td align="center">
      <table width="680" cellpadding="0" cellspacing="0"
             style="background:#fff; border-radius:8px; overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- En-tête -->
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#2c3e50,#3498db); padding:28px 32px; text-align:center;">
            <h1 style="margin:0; color:#fff; font-size:22px;">
              Rapport de Présence — {day_name} {date_str}
            </h1>
            <p style="margin:6px 0 0; color:rgba(255,255,255,.75); font-size:14px;">
              Netsysteme Informatique - SSE
            </p>
          </td>
        </tr>

        <!-- Statistiques -->
        <tr>
          <td style="padding:24px 32px; background:#f8f9fa; border-bottom:1px solid #e9ecef;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:0 8px;">
                  <div style="font-size:32px; font-weight:700; color:#28a745;">{stats['present']}</div>
                  <div style="font-size:12px; color:#6c757d; text-transform:uppercase;">Présents</div>
                </td>
                <td align="center" style="padding:0 8px;">
                  <div style="font-size:32px; font-weight:700; color:#dc3545;">{stats['absent']}</div>
                  <div style="font-size:12px; color:#6c757d; text-transform:uppercase;">Absents</div>
                </td>
                <td align="center" style="padding:0 8px;">
                  <div style="font-size:32px; font-weight:700; color:#ffc107;">{stats['late']}</div>
                  <div style="font-size:12px; color:#6c757d; text-transform:uppercase;">En retard</div>
                </td>
                <td align="center" style="padding:0 8px;">
                  <div style="font-size:32px; font-weight:700; color:#17a2b8;">{stats.get('on_leave', 0) + stats.get('half_day', 0)}</div>
                  <div style="font-size:12px; color:#6c757d; text-transform:uppercase;">Congés / Demi-j.</div>
                </td>
                <td align="center" style="padding:0 8px;">
                  <div style="font-size:32px; font-weight:700; color:#3498db;">{rate}%</div>
                  <div style="font-size:12px; color:#6c757d; text-transform:uppercase;">Taux présence</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Tableau employés -->
        <tr>
          <td style="padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse; font-size:14px;">
              <thead>
                <tr style="background:#3498db; color:#fff;">
                  <th style="padding:12px; text-align:left;">Employé</th>
                  <th style="padding:12px; text-align:left;">Rôle</th>
                  <th style="padding:12px; text-align:center;">Entrée</th>
                  <th style="padding:12px; text-align:center;">Sortie</th>
                  <th style="padding:12px; text-align:left;">Lieu</th>
                  <th style="padding:12px; text-align:center;">Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows_html}
              </tbody>
            </table>
          </td>
        </tr>

        <!-- Pied de page -->
        <tr>
          <td style="padding:16px 32px; background:#f8f9fa; border-top:1px solid #e9ecef;
                     text-align:center; color:#aaa; font-size:12px;">
            Rapport généré automatiquement le {generated_at} — Système de Gestion Netsysteme
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _build_text(data: dict) -> str:
    date_str = data["date"].strftime("%d/%m/%Y")
    lines = [
        f"RAPPORT DE PRÉSENCE — {data['day_name']} {date_str}",
        "=" * 50,
        f"Présents : {data['stats']['present']}  |  "
        f"Absents : {data['stats']['absent']}  |  "
        f"Retards : {data['stats']['late']}  |  "
        f"Taux : {data['rate']}%",
        "",
        f"{'Employé':<25} {'Rôle':<20} {'Entrée':>6} {'Sortie':>6} {'Statut':>12}",
        "-" * 75,
    ]
    for r in data["rows"]:
        label = STATUS_LABELS.get(r["status"], r["status"])
        lines.append(
            f"{r['name']:<25} {r['role']:<20} {r['check_in']:>6} {r['check_out']:>6} {label:>12}"
        )
    lines.append("")
    lines.append(f"Rapport généré le {datetime.datetime.now().strftime('%d/%m/%Y à %H:%M')}")
    return "\n".join(lines)


def send_daily_presence_report(report_date: datetime.date | None = None) -> bool:
    if report_date is None:
        report_date = datetime.date.today()

    recipients = getattr(settings, "REPORT_EMAIL_RECIPIENTS", [])
    if not recipients:
        logger.warning("REPORT_EMAIL_RECIPIENTS est vide — rapport non envoyé.")
        return False

    data      = _build_daily_report(report_date)
    date_str  = report_date.strftime("%d/%m/%Y")
    day_name  = data["day_name"]
    subject   = f"[Netsysteme] Rapport de présence — {day_name} {date_str}"
    text_body = _build_text(data)
    html_body = _build_html(data)

    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=recipients,
    )
    msg.attach_alternative(html_body, "text/html")

    try:
        msg.send(fail_silently=False)
        logger.info("Rapport de présence envoyé à %s pour le %s", recipients, date_str)
        return True
    except Exception as exc:
        logger.error("Échec de l'envoi du rapport de présence : %s", exc)
        raise


class Command(BaseCommand):
    help = "Envoie le rapport de présence du jour par email"

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            type=lambda s: datetime.date.fromisoformat(s),
            help="Date du rapport au format YYYY-MM-DD (défaut : aujourd'hui)",
        )

    def handle(self, *args, **options):
        report_date = options.get("date") or datetime.date.today()
        self.stdout.write(f"Envoi du rapport de présence pour le {report_date.strftime('%d/%m/%Y')}…")
        try:
            send_daily_presence_report(report_date)
            self.stdout.write(self.style.SUCCESS("Rapport envoyé avec succès."))
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"Erreur : {exc}"))
