# ─────────────────────────────────────────────────────────────────────────────
#  apps/installations/payment_reminder_service.py
#  Service de rappels de paiement automatiques — adapté pour Django
# ─────────────────────────────────────────────────────────────────────────────
import calendar
import logging
from datetime import date, datetime, timedelta

from django.utils import timezone

logger = logging.getLogger(__name__)


def _add_months(d, months):
    """Ajoute `months` mois à une date sans dépendance externe."""
    month = d.month - 1 + months
    year  = d.year + month // 12
    month = month % 12 + 1
    day   = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


class PaymentReminderService:
    """Service pour gérer les rappels de paiement automatiques."""

    REMINDER_DAYS = [5, 2, 0]

    TRANCHES_MAP = {
        "one_tranche":  1, "two_tranche":  2, "three_tranche": 3,
        "four_tranche": 4, "five_tranche": 5, "six_tranche":   6,
        "1 Tranche": 1, "2 Tranches": 2, "3 Tranches": 3,
        "4 Tranches": 4, "5 Tranches": 5, "6 Tranches": 6,
    }

    TRANCHE_LABELS = {
        1: "1ère Tranche", 2: "2ème Tranche", 3: "3ème Tranche",
        4: "4ème Tranche", 5: "5ème Tranche", 6: "6ème Tranche",
    }

    def __init__(self):
        from apps.sms.orange_service import OrangeSMSService
        self.sms_service = OrangeSMSService("SSE")

    # ─── Calcul des dates de paiement ────────────────────────────────────────

    def calculate_payment_dates(self, installation):
        """
        Retourne une liste de dicts :
          { 'date': date, 'amount': float, 'label': str, 'tranche_number': int|None }
        """
        dates = []

        if not installation.date_installation:
            return dates

        methode = installation.methode_paiement

        # Paiement comptant
        if methode in ("cash", "Espèce", "Virement", "Chèque", "transfer", "check"):
            payment_date = installation.date_echeance or (
                installation.date_installation + timedelta(days=30)
            )
            dates.append({
                "date":           payment_date,
                "amount":         installation.montant_restant,
                "label":          "Solde final (50%)",
                "tranche_number": None,
            })

        # Paiement par tranches
        elif methode in self.TRANCHES_MAP:
            nb_tranches        = self.TRANCHES_MAP[methode]
            montant_par_tranche = installation.montant_restant / nb_tranches

            if installation.date_echeance:
                date_base = installation.date_echeance
            else:
                date_base = _add_months(installation.date_installation, 1)

            for i in range(1, nb_tranches + 1):
                payment_date = date_base if i == 1 else _add_months(date_base, i - 1)

                if i == nb_tranches:
                    montant_tranche = installation.montant_restant - montant_par_tranche * (nb_tranches - 1)
                else:
                    montant_tranche = montant_par_tranche

                dates.append({
                    "date":           payment_date,
                    "amount":         montant_tranche,
                    "label":          self.TRANCHE_LABELS.get(i, f"{i}ème Tranche"),
                    "tranche_number": i,
                })

        # Autre méthode
        else:
            if installation.date_echeance:
                dates.append({
                    "date":           installation.date_echeance,
                    "amount":         installation.montant_restant,
                    "label":          "Paiement",
                    "tranche_number": None,
                })

        return dates

    # ─── Paiements à venir ───────────────────────────────────────────────────

    def get_upcoming_payments(self):
        """
        Retourne tous les paiements à venir pour les installations
        avec un montant restant > 0.
        """
        from .models import Installation

        installations = Installation.objects.filter(
            montant_restant__gt=0,
            date_installation__isnull=False,
        )

        upcoming = []
        for inst in installations:
            for payment_info in self.calculate_payment_dates(inst):
                upcoming.append({
                    "installation":     inst,
                    "payment_date":     payment_info["date"],
                    "payment_amount":   payment_info["amount"],
                    "payment_label":    payment_info["label"],
                    "montant_restant_db": inst.montant_restant,
                    "tranche_number":   payment_info.get("tranche_number"),
                })
        return upcoming

    # ─── Résumé (avant envoi) ────────────────────────────────────────────────

    def get_reminders_to_send_summary(self):
        today            = date.today()
        upcoming_payments = self.get_upcoming_payments()

        summary = {
            "j_minus_5":         [],
            "j_minus_2":         [],
            "j_day":             [],
            "total_to_send":     0,
            "total_already_sent": 0,
            "total_skipped":     0,
        }

        for payment in upcoming_payments:
            inst         = payment["installation"]
            payment_date = payment["payment_date"]
            days_until   = (payment_date - today).days

            reminder_type = self._days_to_type(days_until)
            if not reminder_type:
                continue

            if not inst.telephone:
                summary["total_skipped"] += 1
                continue

            if self._is_payment_completed(inst):
                summary["total_skipped"] += 1
                continue

            entry = {
                "client":           f"{inst.prenom} {inst.nom}",
                "phone":            inst.telephone,
                "amount":           payment["payment_amount"],
                "montant_restant":  float(inst.montant_restant),
                "date":             payment_date.strftime("%d/%m/%Y"),
                "label":            payment["payment_label"],
            }

            if self._reminder_already_sent(inst, payment_date, reminder_type):
                summary["total_already_sent"] += 1
                entry["already_sent"] = True
            else:
                summary["total_to_send"] += 1
                entry["already_sent"] = False

            summary[reminder_type].append(entry)

        return summary

    # ─── Envoi automatique ───────────────────────────────────────────────────

    def check_and_send_reminders(self, dry_run=False):
        from apps.sms.models import SMSHistory

        results = {
            "j_minus_5": {"sent": 0, "failed": 0, "skipped": 0},
            "j_minus_2": {"sent": 0, "failed": 0, "skipped": 0},
            "j_day":     {"sent": 0, "failed": 0, "skipped": 0},
            "total_sent":    0,
            "total_failed":  0,
            "total_skipped": 0,
            "details":       [],
        }

        today            = date.today()
        upcoming_payments = self.get_upcoming_payments()

        logger.info("=" * 80)
        logger.info(f"VERIFICATION DES RAPPELS DE PAIEMENT - {today}")
        logger.info(f"   Paiements a venir: {len(upcoming_payments)}")
        logger.info(f"   Mode: {'DRY RUN' if dry_run else 'ENVOI REEL'}")
        logger.info("=" * 80)

        sms_records = []

        for payment in upcoming_payments:
            inst         = payment["installation"]
            payment_date = payment["payment_date"]
            days_until   = (payment_date - today).days

            reminder_type = self._days_to_type(days_until)
            if not reminder_type:
                continue

            base_detail = {
                "client":          f"{inst.prenom} {inst.nom}",
                "phone":           inst.telephone or "N/A",
                "type":            reminder_type,
                "date":            payment_date.strftime("%d/%m/%Y"),
                "amount":          payment["payment_amount"],
                "montant_restant": float(inst.montant_restant),
            }

            if self._is_payment_completed(inst):
                results[reminder_type]["skipped"] += 1
                results["total_skipped"] += 1
                results["details"].append({**base_detail, "status": "skipped", "reason": "Paiement deja effectue"})
                continue

            if self._reminder_already_sent(inst, payment_date, reminder_type):
                results[reminder_type]["skipped"] += 1
                results["total_skipped"] += 1
                results["details"].append({**base_detail, "status": "already_sent", "reason": "Rappel deja envoye aujourd'hui"})
                continue

            if not inst.telephone:
                results[reminder_type]["skipped"] += 1
                results["total_skipped"] += 1
                results["details"].append({**base_detail, "status": "skipped", "reason": "Numero de telephone manquant"})
                continue

            message_payment_info = {
                "payment_date":   payment_date,
                "payment_amount": payment["payment_amount"],
                "payment_label":  payment["payment_label"],
            }
            message = self._generate_reminder_message(inst, message_payment_info, days_until)

            logger.info(
                f"{reminder_type.upper()}: {inst.prenom} {inst.nom} - "
                f"{payment['payment_label']} - Tranche: {payment['payment_amount']:,.0f} F - "
                f"Restant total: {inst.montant_restant:,.0f} F"
            )

            if dry_run:
                results[reminder_type]["sent"] += 1
                results["total_sent"] += 1
                results["details"].append({**base_detail, "message": message, "status": "dry_run"})
            else:
                send_result = self.sms_service.send_sms(inst.telephone, message)
                sms_records.append(SMSHistory(
                    recipient_name=f"{inst.prenom} {inst.nom}",
                    phone=inst.telephone,
                    message=message,
                    message_template=f"rappel_paiement_{reminder_type}",
                    status="success" if send_result.get("success") else "failed",
                    error_message=send_result.get("error") if not send_result.get("success") else None,
                    installation_id=inst.id,
                    extra_data={
                        "payment_date":   payment_date.isoformat(),
                        "reminder_type":  reminder_type,
                        "payment_label":  payment["payment_label"],
                        "payment_amount": float(payment["payment_amount"]),
                        "montant_restant": float(inst.montant_restant),
                        "sender_domain":  send_result.get("sender_domain", "SSE"),
                    },
                ))

                if send_result.get("success"):
                    results[reminder_type]["sent"] += 1
                    results["total_sent"] += 1
                    results["details"].append({**base_detail, "status": "success"})
                else:
                    results[reminder_type]["failed"] += 1
                    results["total_failed"] += 1
                    results["details"].append({**base_detail, "status": "failed", "error": send_result.get("message")})

        if not dry_run and sms_records:
            try:
                SMSHistory.objects.bulk_create(sms_records)
            except Exception as e:
                logger.error(f"Erreur lors de la sauvegarde des SMS: {e}")

        logger.info("RESULTATS:")
        logger.info(f"   J-5: {results['j_minus_5']['sent']} envoyes, {results['j_minus_5']['failed']} echecs, {results['j_minus_5']['skipped']} ignores")
        logger.info(f"   J-2: {results['j_minus_2']['sent']} envoyes, {results['j_minus_2']['failed']} echecs, {results['j_minus_2']['skipped']} ignores")
        logger.info(f"   J:   {results['j_day']['sent']} envoyes, {results['j_day']['failed']} echecs, {results['j_day']['skipped']} ignores")
        logger.info(f"   TOTAL: {results['total_sent']} envoyes, {results['total_failed']} echecs, {results['total_skipped']} ignores")

        return results

    # ─── Envoi manuel ────────────────────────────────────────────────────────

    def send_manual_reminder(self, installation_id, payment_date=None):
        from apps.sms.models import SMSHistory
        from .models import Installation

        try:
            installation = Installation.objects.get(pk=installation_id)
        except Installation.DoesNotExist:
            return {"success": False, "message": "Installation non trouvée"}

        if not installation.telephone:
            return {"success": False, "message": "Numéro de téléphone manquant"}

        payment_dates = self.calculate_payment_dates(installation)
        if not payment_dates:
            return {"success": False, "message": "Aucune date de paiement trouvée"}

        if payment_date:
            if isinstance(payment_date, str):
                payment_date = datetime.strptime(payment_date, "%Y-%m-%d").date()
            payment_info = next(
                (p for p in payment_dates if p["date"] == payment_date), None
            )
        else:
            today = date.today()
            payment_info = next(
                (p for p in payment_dates if p["date"] >= today),
                payment_dates[0] if payment_dates else None,
            )

        if not payment_info:
            return {"success": False, "message": "Aucun paiement à venir"}

        days_until = (payment_info["date"] - date.today()).days

        message_payment_info = {
            "payment_date":   payment_info["date"],
            "payment_amount": payment_info["amount"],
            "payment_label":  payment_info["label"],
        }
        message = self._generate_reminder_message(
            installation, message_payment_info, max(0, days_until)
        )

        result = self.sms_service.send_sms(installation.telephone, message)

        sms_record = SMSHistory(
            recipient_name=f"{installation.prenom} {installation.nom}",
            phone=installation.telephone,
            message=message,
            message_template="rappel_paiement_manuel",
            status="success" if result.get("success") else "failed",
            error_message=result.get("error") if not result.get("success") else None,
            installation_id=installation.id,
            extra_data={
                "payment_date":   payment_info["date"].isoformat(),
                "payment_label":  payment_info["label"],
                "payment_amount": float(payment_info["amount"]),
                "montant_restant": float(installation.montant_restant),
                "manual":         True,
                "sender_domain":  result.get("sender_domain", "SSE"),
            },
        )
        try:
            sms_record.save()
        except Exception as e:
            logger.error(f"Erreur sauvegarde SMS: {e}")

        return result

    # ─── Helpers privés ──────────────────────────────────────────────────────

    @staticmethod
    def _days_to_type(days_until):
        if days_until == 5:
            return "j_minus_5"
        if days_until == 2:
            return "j_minus_2"
        if days_until == 0:
            return "j_day"
        return None

    @staticmethod
    def _is_payment_completed(installation):
        return installation.montant_restant <= 0

    @staticmethod
    def _reminder_already_sent(installation, payment_date, reminder_type):
        from apps.sms.models import SMSHistory

        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end   = timezone.now().replace(hour=23, minute=59, second=59, microsecond=999999)

        existing = SMSHistory.objects.filter(
            installation_id=installation.id,
            message_template=f"rappel_paiement_{reminder_type}",
            sent_at__gte=today_start,
            sent_at__lte=today_end,
            status="success",
        ).first()

        if existing and existing.extra_data:
            stored_date = existing.extra_data.get("payment_date")
            if stored_date and stored_date == payment_date.isoformat():
                logger.info(
                    f"   Rappel deja envoye aujourd'hui a {existing.sent_at.strftime('%H:%M:%S')}"
                )
                return True
        return False

    @staticmethod
    def _generate_reminder_message(installation, payment_info, days_until):
        client_name = f"{installation.prenom} {installation.nom}"

        tranche_value  = payment_info.get("payment_amount") or payment_info.get("amount", 0)
        montant_restant = "{:,.0f}".format(installation.montant_restant)

        payment_date = payment_info.get("payment_date") or payment_info.get("date")
        if isinstance(payment_date, datetime):
            date_str = payment_date.strftime("%d/%m/%Y")
        else:
            date_str = payment_date.strftime("%d/%m/%Y")

        if days_until == 5:
            return (
                f"Bonjour {client_name},\n"
                f"Rappel : Votre montant total restant : {montant_restant} FCFA "
                f"arrive a echeance dans 5 jours ({date_str}).\n"
                f"Merci de prevoir votre paiement.\n"
                f"SSE SUARL - 77 846 16 55"
            )
        elif days_until == 2:
            return (
                f"Bonjour {client_name},\n"
                f"Rappel : Votre montant total restant : {montant_restant} FCFA "
                f"est du dans 2 jours ({date_str}).\n"
                f"Pour toute question, contactez-nous.\n"
                f"SSE SUARL - 77 846 16 55"
            )
        else:
            return (
                f"Bonjour {client_name},\n"
                f"Rappel : Votre montant total restant : {montant_restant} FCFA "
                f"est du aujourd'hui ({date_str}).\n"
                f"Merci de proceder au reglement.\n"
                f"SSE SUARL - 77 846 16 55"
            )


# Instance globale
payment_reminder_service = PaymentReminderService()
