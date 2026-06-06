// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/users/components/UserFormModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { usersService, type User, type Role } from "../../../services/usersService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

const PERM_LABELS: Record<string, string> = {
  interventions: "Interventions",
  inventory:     "Stock",
  expenses:      "Dépenses",
  clients:       "Clients",
  installations: "Installations",
  billing:       "Facturation",
  attendance:    "Présences",
  messaging:     "Messagerie",
  advances:      "Avances salaire",
};

const SITES = ["Dakar", "Mbour"];

interface Props {
  dark:           boolean;
  theme:          LayoutContext["theme"];
  user:           User | null;   // null = création, User = édition
  roles:          Role[];
  availablePerms: string[];
  onClose:        () => void;
  onSaved:        () => void;
}

interface FormData {
  prenom:            string;
  nom:               string;
  username:          string;
  email:             string;
  telephone:         string;
  site:              string;
  role_id:           string;
  password:          string;
  extra_permissions: string[];
  is_active:         boolean;
}

export default function UserFormModal({ dark, theme, user, roles, availablePerms, onClose, onSaved }: Props) {
  const swal    = useSwal();
  const isEdit  = !!user;
  const [saving, setSaving] = useState(false);
  const [pwdStrength, setPwdStrength] = useState<"" | "faible" | "moyen" | "fort">("");

  // ── Formulaire ───────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormData>({
    prenom:            user?.prenom      ?? "",
    nom:               user?.nom         ?? "",
    username:          user?.username    ?? "",
    email:             user?.email       ?? "",
    telephone:         user?.telephone   ?? "",
    site:              user?.site        ?? "",
    role_id:           user?.role?.id.toString() ?? "",
    password:          "",
    extra_permissions: user?.permissions_list.filter(p => p !== "all") ?? [],
    is_active:         user?.is_active   ?? true,
  });

  const set = (k: keyof FormData, v: string | boolean | string[]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Aperçu des permissions du rôle sélectionné
  const selectedRole = roles.find((r) => r.id.toString() === form.role_id);
  const isAdminRole  = selectedRole?.permissions === "all";

  // Permissions finales (union rôle + extra)
  const finalPerms: string[] = isAdminRole
    ? ["all"]
    : [...new Set([
        ...(selectedRole?.permissions_list?.filter(p => p !== "all") ?? []),
        ...form.extra_permissions,
      ])];

  // Forcer extra_permissions vides si admin
  useEffect(() => {
    if (isAdminRole) set("extra_permissions", []);
  }, [form.role_id]);

  const togglePerm = (perm: string) => {
    set("extra_permissions",
      form.extra_permissions.includes(perm)
        ? form.extra_permissions.filter((p) => p !== perm)
        : [...form.extra_permissions, perm]
    );
  };

  // Indicateur de force mot de passe
  const checkPwd = (pwd: string) => {
    if (!pwd) { setPwdStrength(""); return; }
    const ok = pwd.length >= 6;
    const letter = /[a-zA-Z]/.test(pwd);
    const num    = /\d/.test(pwd);
    if (ok && letter && num) setPwdStrength("fort");
    else if (ok && (letter || num)) setPwdStrength("moyen");
    else setPwdStrength("faible");
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.role_id) { swal.error("Champ requis", "Veuillez sélectionner un rôle."); return; }
    if (!isEdit && form.password.length < 6) { swal.error("Mot de passe trop court", "Minimum 6 caractères."); return; }

    setSaving(true);
    try {
      const payload = {
        prenom:            form.prenom,
        nom:               form.nom,
        username:          form.username.toLowerCase().replace(/[^a-z0-9_]/g, ""),
        email:             form.email,
        telephone:         form.telephone || undefined,
        site:              form.site       || undefined,
        role_id:           parseInt(form.role_id),
        extra_permissions: form.extra_permissions,
        is_active:         form.is_active,
        ...((!isEdit || form.password) ? { password: form.password } : {}),
      };

      if (isEdit) {
        await usersService.update(user!.id, payload);
        swal.updated("L'utilisateur");
      } else {
        await usersService.create({ ...payload, password: form.password });
        swal.saved("L'utilisateur");
      }
      onSaved();
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.username) swal.error("Erreur", data.username[0]);
      else if (data?.email) swal.error("Erreur", data.email[0]);
      else swal.serverError();
    } finally {
      setSaving(false);
    }
  };

  // ── Styles partagés ──────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.6rem 0.85rem",
    borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`,
    background: theme.inputBg,
    color: theme.textPrimary,
    fontSize: "0.875rem", fontFamily: FONTS.body, outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "0.75rem", fontWeight: 600,
    color: theme.textSecondary, marginBottom: "0.35rem",
    textTransform: "uppercase", letterSpacing: "0.05em",
  };

  const pwdColors: Record<string, string> = { faible: "#ef4444", moyen: "#f59e0b", fort: "#10b981" };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 640, maxHeight: "92vh", overflowY: "auto", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.6)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: theme.textPrimary }}>
              {isEdit ? `Modifier ${user!.prenom} ${user!.nom}` : "Nouvel utilisateur"}
            </h2>
            <p style={{ fontSize: "0.78rem", color: theme.textMuted, marginTop: 2 }}>
              {isEdit ? "Modifiez les informations du compte" : "Créez un nouveau compte utilisateur"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.2rem", lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>

          {/* Infos perso */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.85rem" }}>Informations personnelles</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
              <div>
                <label style={labelStyle}>Prénom *</label>
                <input required value={form.prenom} onChange={(e) => set("prenom", e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Nom *</label>
                <input required value={form.nom} onChange={(e) => set("nom", e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Nom d'utilisateur *</label>
                <input required value={form.username}
                  onChange={(e) => set("username", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  style={inputStyle} placeholder="ex: jean_dupont" />
                <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 3 }}>Minuscules, chiffres et _ uniquement</div>
              </div>
              <div>
                <label style={labelStyle}>Email *</label>
                <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Téléphone</label>
                <input value={form.telephone} onChange={(e) => set("telephone", e.target.value)} style={inputStyle} placeholder="77 000 00 00" />
              </div>
              <div>
                <label style={labelStyle}>Site / Filiale</label>
                <select value={form.site} onChange={(e) => set("site", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">— Sélectionner —</option>
                  {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Rôle & permissions */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.85rem" }}>Rôle & permissions</div>
            <div style={{ marginBottom: "0.85rem" }}>
              <label style={labelStyle}>Rôle *</label>
              <select required value={form.role_id} onChange={(e) => set("role_id", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="">— Sélectionner un rôle —</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            {/* Permissions supplémentaires (masquées si admin) */}
            {form.role_id && !isAdminRole && (
              <div>
                <label style={labelStyle}>Permissions supplémentaires</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.85rem" }}>
                  {availablePerms.map((perm) => {
                    const checked = form.extra_permissions.includes(perm);
                    const inRole  = selectedRole?.permissions_list?.includes(perm) ?? false;
                    return (
                      <button key={perm} type="button"
                        onClick={() => !inRole && togglePerm(perm)}
                        style={{
                          padding: "0.35rem 0.85rem", borderRadius: RADIUS.full, fontSize: "0.78rem", fontWeight: 500, cursor: inRole ? "default" : "pointer", fontFamily: FONTS.body, transition: "all 0.15s",
                          background: (checked || inRole) ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : (dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"),
                          color: (checked || inRole) ? "#fff" : theme.textSecondary,
                          border: `1px solid ${(checked || inRole) ? "transparent" : theme.border}`,
                          opacity: inRole ? 0.7 : 1,
                        }}
                      >
                        {PERM_LABELS[perm] ?? perm}
                        {inRole && <span style={{ marginLeft: 4, fontSize: "0.65rem", opacity: 0.8 }}>(rôle)</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Aperçu permissions finales */}
            <div style={{ background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", borderRadius: RADIUS.md, padding: "0.75rem 1rem", border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginBottom: "0.4rem" }}>Permissions accordées :</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {finalPerms.length === 0 ? (
                  <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>Aucune permission sélectionnée</span>
                ) : finalPerms.includes("all") ? (
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, padding: "2px 9px", borderRadius: RADIUS.full, background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>Toutes les permissions (Admin)</span>
                ) : (
                  finalPerms.map((p) => (
                    <span key={p} style={{ fontSize: "0.78rem", fontWeight: 500, padding: "2px 9px", borderRadius: RADIUS.full, background: `rgba(6,182,212,0.1)`, color: PALETTE.primary }}>
                      {PERM_LABELS[p] ?? p}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Mot de passe */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.85rem" }}>
              {isEdit ? "Mot de passe (laisser vide pour ne pas modifier)" : "Mot de passe"}
            </div>
            <div>
              <label style={labelStyle}>Mot de passe {!isEdit && "*"}</label>
              <input
                type="password" required={!isEdit} minLength={6}
                value={form.password}
                onChange={(e) => { set("password", e.target.value); checkPwd(e.target.value); }}
                style={inputStyle} placeholder={isEdit ? "Laisser vide = inchangé" : "Min. 6 caractères"}
              />
              {pwdStrength && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.4rem" }}>
                  <div style={{ flex: 1, height: 3, borderRadius: 2, background: theme.border }}>
                    <div style={{ height: "100%", borderRadius: 2, background: pwdColors[pwdStrength], width: pwdStrength === "fort" ? "100%" : pwdStrength === "moyen" ? "60%" : "30%", transition: "width 0.3s" }} />
                  </div>
                  <span style={{ fontSize: "0.73rem", color: pwdColors[pwdStrength], fontWeight: 600, textTransform: "capitalize" }}>{pwdStrength}</span>
                </div>
              )}
            </div>
          </div>

          {/* Statut */}
          <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", userSelect: "none" }}>
              <div
                onClick={() => set("is_active", !form.is_active)}
                style={{ width: 40, height: 22, borderRadius: 11, background: form.is_active ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : theme.border, position: "relative", cursor: "pointer", transition: "background 0.2s" }}
              >
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: form.is_active ? 21 : 3, transition: "left 0.2s" }} />
              </div>
              <span style={{ fontSize: "0.875rem", color: theme.textPrimary }}>Compte actif</span>
            </label>
          </div>

          {/* Boutons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem", borderTop: `1px solid ${theme.border}` }}>
            <button type="button" onClick={onClose}
              style={{ padding: "0.65rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
              Annuler
            </button>
            <button type="submit" disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.65rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? "rgba(6,182,212,0.4)" : `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
              {saving ? "Enregistrement…" : isEdit ? "Enregistrer les modifications" : "Créer l'utilisateur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}