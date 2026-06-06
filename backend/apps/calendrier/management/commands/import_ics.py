# apps/calendrier/management/commands/import_ics.py
"""
Importe un fichier .ics (iCalendar) dans la base de données CalendarEvent.

Utilisation :
    python manage.py import_ics chemin/vers/fichier.ics
    python manage.py import_ics chemin/vers/fichier.ics --user admin
    python manage.py import_ics chemin/vers/fichier.ics --dry-run
"""
import os
import re
import datetime
import unicodedata

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.calendrier.models import CalendarEvent


def _clean_title(text: str) -> str:
    """
    Supprime les caractères Unicode invisibles/de contrôle qui font planter MySQL utf8.
    Exemples : U+202A (LTR embedding), U+202C, U+200B (zero-width space), etc.
    """
    # Supprimer les caractères de catégorie Unicode "Cf" (format) et "Cc" (contrôle)
    cleaned = "".join(
        ch for ch in text
        if unicodedata.category(ch) not in ("Cf", "Cc")
    )
    # Supprimer les caractères 4-octets (emoji composés) si MySQL est en utf8 (pas utf8mb4)
    cleaned = re.sub(r"[\U00010000-\U0010FFFF]", "", cleaned)
    return cleaned.strip()


def _parse_ics_file(filepath: str) -> list[dict]:
    """
    Parse un fichier .ics sans dépendance externe (stdlib uniquement).
    Retourne une liste de dicts avec les clés : title, start, all_day, uid.
    """
    events = []
    current = None

    with open(filepath, encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    # Dépliage des lignes pliées (RFC 5545 : continuation si ligne commence par espace/tab)
    unfolded = []
    for line in lines:
        line = line.rstrip("\r\n")
        if line.startswith((" ", "\t")) and unfolded:
            unfolded[-1] += line.lstrip()
        else:
            unfolded.append(line)

    for line in unfolded:
        if line == "BEGIN:VEVENT":
            current = {}
        elif line == "END:VEVENT" and current is not None:
            events.append(current)
            current = None
        elif current is not None and ":" in line:
            # Gestion des propriétés avec paramètres (ex: DTSTART;TZID=Europe/Paris:20260415T090000)
            prop, _, value = line.partition(":")
            prop_name = prop.split(";")[0].upper()
            params = {}
            for part in prop.split(";")[1:]:
                if "=" in part:
                    k, v = part.split("=", 1)
                    params[k.upper()] = v

            if prop_name == "SUMMARY":
                raw_title = value.replace("\\,", ",").replace("\\n", "\n").replace("\\\\", "\\")
                current["title"] = _clean_title(raw_title)
            elif prop_name in ("DTSTART", "DTSTART"):
                current["dtstart_raw"] = value
                current["dtstart_params"] = params
            elif prop_name == "UID":
                current["uid"] = value

    return events


def _parse_dt(raw: str, params: dict) -> tuple[str, bool]:
    """
    Convertit une valeur DTSTART en (iso_string, all_day).
    - Date seule  → all_day=True,  iso = "2026-04-15"
    - DateTime    → all_day=False, iso = "2026-04-15T09:00:00"
    """
    value = params.get("VALUE", "")

    # Date seule : DTSTART;VALUE=DATE:20260415
    if value == "DATE" or (len(raw) == 8 and raw.isdigit()):
        d = datetime.date(int(raw[:4]), int(raw[4:6]), int(raw[6:8]))
        return d.isoformat(), True

    # DateTime avec Z (UTC) : 20260415T090000Z
    if raw.endswith("Z"):
        raw = raw[:-1]
        dt = datetime.datetime(
            int(raw[:4]), int(raw[4:6]), int(raw[6:8]),
            int(raw[9:11]), int(raw[11:13]), int(raw[13:15]),
        )
        return dt.strftime("%Y-%m-%dT%H:%M:%S"), False

    # DateTime local : 20260415T090000
    if "T" in raw and len(raw) >= 15:
        dt = datetime.datetime(
            int(raw[:4]), int(raw[4:6]), int(raw[6:8]),
            int(raw[9:11]), int(raw[11:13]), int(raw[13:15]),
        )
        return dt.strftime("%Y-%m-%dT%H:%M:%S"), False

    # Fallback
    return raw, False


class Command(BaseCommand):
    help = "Importe les événements d'un fichier .ics dans CalendarEvent"

    def add_arguments(self, parser):
        parser.add_argument("ics_file", help="Chemin vers le fichier .ics à importer")
        parser.add_argument(
            "--user",
            default=None,
            help="Username de l'utilisateur propriétaire des événements (optionnel)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Affiche ce qui serait importé sans écrire en base",
        )
        parser.add_argument(
            "--skip-existing",
            action="store_true",
            default=True,
            help="Ignore les événements dont le google_event_id (UID) existe déjà (défaut: True)",
        )

    def handle(self, *args, **options):
        filepath = options["ics_file"]
        dry_run  = options["dry_run"]
        username = options["user"]

        # Vérification du fichier
        if not os.path.exists(filepath):
            raise CommandError(f"Fichier introuvable : {filepath}")
        if not filepath.lower().endswith(".ics"):
            self.stdout.write(self.style.WARNING("Attention : le fichier ne semble pas être un .ics"))

        # Résolution de l'utilisateur
        owner = None
        if username:
            from apps.users.models import User
            try:
                owner = User.objects.get(username=username)
                self.stdout.write(f"Propriétaire : {owner.username}")
            except User.DoesNotExist:
                raise CommandError(f"Utilisateur '{username}' introuvable.")

        # Parsing
        self.stdout.write(f"Lecture de : {filepath}")
        raw_events = _parse_ics_file(filepath)
        self.stdout.write(f"  → {len(raw_events)} événement(s) trouvé(s) dans le fichier")

        created = skipped = errors = 0

        for raw in raw_events:
            title = raw.get("title", "(sans titre)")
            uid   = raw.get("uid", "")

            if not raw.get("dtstart_raw"):
                self.stdout.write(self.style.WARNING(f"  ⚠ Ignoré (pas de date) : {title}"))
                errors += 1
                continue

            try:
                iso_start, all_day = _parse_dt(raw["dtstart_raw"], raw.get("dtstart_params", {}))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  ✗ Erreur parsing date '{title}': {e}"))
                errors += 1
                continue

            # Vérifier doublon via UID
            if uid and options["skip_existing"]:
                if CalendarEvent.objects.filter(google_event_id=uid).exists():
                    self.stdout.write(self.style.WARNING(f"  ⚠ Déjà en base (UID) : {title}"))
                    skipped += 1
                    continue

            self.stdout.write(
                f"  {'[DRY-RUN] ' if dry_run else ''}✅ {title} | {iso_start} | all_day={all_day}"
            )

            if not dry_run:
                CalendarEvent.objects.create(
                    title           = title,
                    start           = iso_start,
                    all_day         = all_day,
                    google_event_id = uid or None,
                    google_synced   = False,
                    created_by      = owner,
                    created_at      = timezone.now(),
                )
                created += 1
            else:
                created += 1  # comptage pour dry-run

        # Résumé
        label = "[DRY-RUN] " if dry_run else ""
        self.stdout.write("")
        if dry_run:
            self.stdout.write(self.style.WARNING(
                f"{label}{created} à créer, {skipped} ignoré(s), {errors} erreur(s). "
                f"(Rien n'a été écrit en base)"
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"{created} événement(s) importé(s), {skipped} ignoré(s), {errors} erreur(s)."
            ))
