# apps/users/management/commands/init_roles.py
from django.core.management.base import BaseCommand
from apps.users.models import Role

DEFAULT_ROLES = [
    {"name": "Administrateur",        "permissions": "all"},
    {"name": "Commercial",            "permissions": "attendance,clients,interventions,chantiers,depenses_terrain"},
    {"name": "Technicien",            "permissions": "attendance,interventions,outillage,depenses_terrain"},
    {"name": "Administration",        "permissions": "attendance,interventions"},
    {"name": "Dev_administration",    "permissions": "attendance"},
    {"name": "Responsable Technique", "permissions": "chantiers,outillage,interventions,attendance,depenses_terrain"},
]

class Command(BaseCommand):
    help = "Crée les rôles par défaut s'ils n'existent pas, et met à jour les permissions des existants"

    def handle(self, *args, **options):
        created = updated = 0
        for role_data in DEFAULT_ROLES:
            role, is_new = Role.objects.get_or_create(
                name=role_data["name"],
                defaults={"permissions": role_data["permissions"]},
            )
            if is_new:
                created += 1
                self.stdout.write(self.style.SUCCESS(f"  [+] Créé     : {role.name}"))
            else:
                # Met à jour les permissions si elles ont changé
                if role.permissions != role_data["permissions"]:
                    role.permissions = role_data["permissions"]
                    role.save()
                    self.stdout.write(self.style.WARNING(f"  [~] Mis à jour : {role.name}"))
                else:
                    self.stdout.write(self.style.WARNING(f"  [!] Existant   : {role.name}"))
                updated += 1
        self.stdout.write(self.style.SUCCESS(
            f"\n{created} rôle(s) créé(s), {updated} déjà existant(s)."
        ))