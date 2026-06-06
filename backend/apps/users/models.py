from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone


class Role(models.Model):
    name        = models.CharField(max_length=64, unique=True)
    permissions = models.TextField(null=True, blank=True)   # virgule-séparées
    created_at  = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'role'

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    def create_user(self, username, email, password=None, **extra):
        if not email:
            raise ValueError("L'email est obligatoire")
        email = self.normalize_email(email)
        user  = self.model(username=username, email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        extra.setdefault('is_active', True)
        # Crée un rôle admin si inexistant
        role, _ = Role.objects.get_or_create(
            name='admin',
            defaults={'permissions': 'all'}
        )
        extra.setdefault('role', role)
        extra.setdefault('nom', 'Admin')
        extra.setdefault('prenom', 'Super')
        return self.create_user(username, email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    username      = models.CharField(max_length=64, unique=True)
    email         = models.CharField(max_length=120, unique=True)
    password_hash = models.CharField(max_length=256, blank=True)  # conservé pour compat Flask
    nom           = models.CharField(max_length=100)
    prenom        = models.CharField(max_length=100)
    telephone     = models.CharField(max_length=20, null=True, blank=True)
    role          = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name='users',
        null=True, blank=True
    )
    is_active     = models.BooleanField(default=True, db_index=True)
    is_staff      = models.BooleanField(default=False)   # requis par Django admin
    created_at    = models.DateTimeField(default=timezone.now)
    last_login    = models.DateTimeField(null=True, blank=True)
    permissions   = models.CharField(max_length=255, null=True, blank=True)
    site          = models.CharField(max_length=50, null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD  = 'username'
    REQUIRED_FIELDS = ['email']

    class Meta:
        db_table = 'user'
        indexes = [
            models.Index(fields=["is_active", "role"]),
        ]

    # ------------------------------------------------------------------ #
    #  Système de permissions métier (identique à la logique Flask)        #
    # ------------------------------------------------------------------ #
    def has_business_permission(self, permission: str) -> bool:
        """
        Vérifie les permissions métier (différent de has_perm Django).
        Ordre de priorité :
          1. permissions perso == 'all'
          2. permissions perso contient la permission
          3. role.permissions == 'all'
          4. role.permissions contient la permission
        """
        if self.permissions == 'all':
            return True
        if self.permissions:
            if permission in self.permissions.split(','):
                return True
        if self.role:
            if self.role.permissions == 'all':
                return True
            if self.role.permissions:
                if permission in self.role.permissions.split(','):
                    return True
        return False

    def get_permissions_list(self) -> list[str]:
        """Retourne la liste des permissions actives de l'utilisateur."""
        if self.permissions == 'all':
            return ['all']
        perms = set()
        if self.permissions:
            perms.update(self.permissions.split(','))
        if self.role and self.role.permissions:
            if self.role.permissions == 'all':
                return ['all']
            perms.update(self.role.permissions.split(','))
        return list(perms)

    # Utilise password_hash Flask si le mot de passe Django n'est pas défini
    def check_password(self, raw_password):
        result = super().check_password(raw_password)
        if not result and self.password_hash:
            # Compatibilité werkzeug (Flask utilisait generate_password_hash)
            try:
                from werkzeug.security import check_password_hash
                result = check_password_hash(self.password_hash, raw_password)
                if result:
                    # Migrer vers le hash Django
                    self.set_password(raw_password)
                    self.password_hash = ''
                    self.save(update_fields=['password', 'password_hash'])
            except ImportError:
                pass
        return result

    def __str__(self):
        return self.username