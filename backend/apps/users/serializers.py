# ─────────────────────────────────────────────────────────────────────────────
#  apps/users/serializers.py
# ─────────────────────────────────────────────────────────────────────────────
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from .models import Role

User = get_user_model()

# ── Permissions disponibles (identiques Flask) ────────────────────────────────
AVAILABLE_PERMISSIONS = [
    "interventions",
    "inventory",
    "expenses",
    "clients",
    "installations",
    "billing",
    "attendance",
    "messaging",
    "advances",
    "chantiers",
    "outillage",
    "all",
]


# ═══════════════════════════════════════════════════════════════════════════════
#  Role
# ═══════════════════════════════════════════════════════════════════════════════
class RoleSerializer(serializers.ModelSerializer):
    permissions_list = serializers.SerializerMethodField()
    users_count      = serializers.SerializerMethodField()

    class Meta:
        model  = Role
        fields = ["id", "name", "permissions", "permissions_list", "users_count", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_permissions_list(self, obj):
        if not obj.permissions:
            return []
        if obj.permissions == "all":
            return ["all"]
        return [p.strip() for p in obj.permissions.split(",") if p.strip()]

    def get_users_count(self, obj):
        return obj.users.count()

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Le nom du rôle est obligatoire.")
        return value.strip()


class RoleWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Role
        fields = ["name", "permissions"]

    def validate_name(self, value):
        return (value or "").strip()

    def validate_permissions(self, value):
        if not value:
            return ""
        if value.strip() == "all":
            return "all"
        perms = [p.strip() for p in value.split(",") if p.strip()]
        invalid = [p for p in perms if p not in AVAILABLE_PERMISSIONS]
        if invalid:
            raise serializers.ValidationError(
                f"Permissions invalides : {', '.join(invalid)}. "
                f"Valeurs acceptées : {', '.join(AVAILABLE_PERMISSIONS)}"
            )
        return ",".join(perms)


# ═══════════════════════════════════════════════════════════════════════════════
#  User — lecture
# ═══════════════════════════════════════════════════════════════════════════════
class UserSerializer(serializers.ModelSerializer):
    role             = RoleSerializer(read_only=True)
    full_name        = serializers.SerializerMethodField()
    initials         = serializers.SerializerMethodField()
    permissions_list = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = [
            "id", "username", "email",
            "nom", "prenom", "telephone", "site",
            "role",
            "permissions", "permissions_list",
            "is_active", "is_staff",
            "full_name", "initials",
            "last_login", "created_at",
        ]
        read_only_fields = ["id", "last_login", "created_at"]

    def get_full_name(self, obj):
        parts = [p for p in [obj.prenom, obj.nom] if p]
        return " ".join(parts) or obj.username

    def get_initials(self, obj):
        p = (obj.prenom or "")[:1].upper()
        n = (obj.nom    or "")[:1].upper()
        return (p + n) or obj.username[:2].upper()

    def get_permissions_list(self, obj):
        return obj.get_permissions_list()


# ═══════════════════════════════════════════════════════════════════════════════
#  User — création
# ═══════════════════════════════════════════════════════════════════════════════
class UserCreateSerializer(serializers.ModelSerializer):
    password          = serializers.CharField(write_only=True, min_length=6)
    role_id           = serializers.IntegerField(required=True)
    extra_permissions = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False, default=list
    )

    class Meta:
        model  = User
        fields = [
            "username", "email", "nom", "prenom",
            "telephone", "site", "role_id",
            "extra_permissions", "password",
        ]

    def validate_username(self, value):
        value = (value or "").strip().lower()
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Ce nom d'utilisateur est déjà utilisé.")
        return value

    def validate_email(self, value):
        value = (value or "").strip()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Cet email est déjà utilisé.")
        return value

    def validate_role_id(self, value):
        if not Role.objects.filter(id=value).exists():
            raise serializers.ValidationError("Rôle introuvable.")
        return value

    def validate(self, attrs):
        """
        Logique Flask : fusion rôle + permissions extra.
        Si rôle == 'all' → permissions = 'all'
        Sinon → union rôle + extra
        """
        role_id    = attrs.get("role_id")
        extra      = attrs.get("extra_permissions", [])
        role       = Role.objects.get(id=role_id)

        if role.permissions == "all":
            attrs["permissions_str"] = "all"
        else:
            role_perms  = set(role.permissions.split(",")) if role.permissions else set()
            custom_perms= set(extra)
            all_perms   = role_perms | custom_perms
            attrs["permissions_str"] = ",".join(sorted(p for p in all_perms if p))

        attrs["role_obj"] = role
        return attrs

    def create(self, validated_data):
        role             = validated_data.pop("role_obj")
        permissions_str  = validated_data.pop("permissions_str")
        validated_data.pop("role_id", None)
        validated_data.pop("extra_permissions", None)
        password         = validated_data.pop("password")

        user = User(
            **validated_data,
            role=role,
            permissions=permissions_str,
            is_active=True,
        )
        user.set_password(password)
        user.save()
        return user


# ═══════════════════════════════════════════════════════════════════════════════
#  User — mise à jour
# ═══════════════════════════════════════════════════════════════════════════════
class UserUpdateSerializer(serializers.ModelSerializer):
    role_id           = serializers.IntegerField(required=False, allow_null=True)
    extra_permissions = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )

    class Meta:
        model  = User
        fields = [
            "email", "nom", "prenom",
            "telephone", "site", "role_id",
            "extra_permissions", "is_active",
        ]

    def validate(self, attrs):
        role_id = attrs.get("role_id")
        extra   = attrs.get("extra_permissions")

        if role_id is not None or extra is not None:
            role = None
            if role_id:
                try:
                    role = Role.objects.get(id=role_id)
                except Role.DoesNotExist:
                    raise serializers.ValidationError({"role_id": "Rôle introuvable."})
            else:
                role = self.instance.role if self.instance else None

            if role:
                e = extra if extra is not None else []
                if role.permissions == "all":
                    attrs["permissions_str"] = "all"
                else:
                    role_perms  = set(role.permissions.split(",")) if role.permissions else set()
                    custom_perms= set(e)
                    all_perms   = role_perms | custom_perms
                    attrs["permissions_str"] = ",".join(sorted(p for p in all_perms if p))
                if role_id:
                    attrs["role_obj"] = role

        return attrs

    def update(self, instance, validated_data):
        role             = validated_data.pop("role_obj", None)
        permissions_str  = validated_data.pop("permissions_str", None)
        validated_data.pop("role_id", None)
        validated_data.pop("extra_permissions", None)

        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        if role:
            instance.role = role
        if permissions_str is not None:
            instance.permissions = permissions_str
        instance.save()
        return instance


# ═══════════════════════════════════════════════════════════════════════════════
#  Profil utilisateur connecté
# ═══════════════════════════════════════════════════════════════════════════════
class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = ["nom", "prenom", "telephone", "email", "site"]

    def validate_email(self, value):
        qs = User.objects.filter(email=value).exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Cet email est déjà utilisé.")
        return value


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=6)

    def validate_old_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Mot de passe actuel incorrect.")
        return value


# ═══════════════════════════════════════════════════════════════════════════════
#  JWT enrichi
# ═══════════════════════════════════════════════════════════════════════════════
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"]         = user.username
        token["full_name"]        = f"{user.prenom} {user.nom}".strip()
        token["role"]             = user.role.name if user.role else None
        token["permissions"]      = user.get_permissions_list()
        token["is_staff"]         = user.is_staff
        return token

    def validate(self, attrs):
        # Résolution de l'identifiant : username, email ou téléphone
        identifier = attrs.get("username", "").strip()
        user = None

        if "@" in identifier:
            user = User.objects.filter(email__iexact=identifier).first()
        else:
            # Essai par téléphone puis par username
            user = (
                User.objects.filter(telephone=identifier).first()
                or User.objects.filter(username__iexact=identifier).first()
            )

        if user:
            attrs["username"] = user.username

        data = super().validate(attrs)
        user = self.user
        data["user"] = {
            "id":              user.id,
            "username":        user.username,
            "email":           user.email,
            "full_name":       f"{user.prenom} {user.nom}".strip(),
            "prenom":          user.prenom,
            "nom":             user.nom,
            "role":            user.role.name if user.role else None,
            "role_id":         user.role.id   if user.role else None,
            "permissions":     user.get_permissions_list(),
            "is_active":       user.is_active,
            "is_staff":        user.is_staff,
            "site":            user.site,
        }
        return data


# ═══════════════════════════════════════════════════════════════════════════════
#  Stats utilisateurs
# ═══════════════════════════════════════════════════════════════════════════════
class UserStatsSerializer(serializers.Serializer):
    total           = serializers.IntegerField()
    actifs          = serializers.IntegerField()
    inactifs        = serializers.IntegerField()
    administrateurs = serializers.IntegerField()
    commerciaux     = serializers.IntegerField()
    techniciens     = serializers.IntegerField()