// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/profile/ProfilePage.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { getTheme, GRADIENT_PRIMARY, FONTS, RADIUS, SHADOW } from "../../theme";
import type { LayoutContext } from "../../layouts/MainLayout";

// ── Icons ─────────────────────────────────────────────────────────────────────
function Icon({ d, s = 18 }: { d: string; s?: number }) {
  return (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}
const ICONS = {
  user:    "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  mail:    "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75",
  phone:   "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z",
  map:     "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z",
  check:   "M4.5 12.75l6 6 9-13.5",
  lock:    "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z",
};

// ── Champ de formulaire ───────────────────────────────────────────────────────
function Field({
  label, icon, value, onChange, type = "text", placeholder, readOnly = false, t,
}: {
  label: string; icon: string; value: string;
  onChange?: (v: string) => void; type?: string;
  placeholder?: string; readOnly?: boolean;
  t: ReturnType<typeof getTheme>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, marginBottom: "0.45rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)", color: focused ? "#00afd4" : t.textMuted, transition: "color 0.15s", pointerEvents: "none" }}>
          <Icon d={ICONS[icon as keyof typeof ICONS]} s={16} />
        </div>
        <input
          type={type}
          value={value}
          readOnly={readOnly}
          onChange={e => onChange?.(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          style={{
            width: "100%",
            background: readOnly ? (t.inputBg + "80") : (focused ? t.inputBgFocus : t.inputBg),
            border: `1px solid ${focused ? "#00afd4" : t.border}`,
            borderRadius: RADIUS.md,
            padding: "0.75rem 1rem 0.75rem 2.75rem",
            color: readOnly ? t.textMuted : t.textPrimary,
            fontSize: "0.9rem",
            outline: "none",
            transition: "all 0.15s",
            boxShadow: focused ? "0 0 0 3px rgba(0,175,212,0.1)" : "none",
            cursor: readOnly ? "default" : "text",
            fontFamily: FONTS.body,
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { dark } = useOutletContext<LayoutContext>();
  const t = getTheme(dark);
  const shadow = dark ? SHADOW.dark : SHADOW.light;
  const { user, updateUser } = useAuthStore();

  const [form, setForm] = useState({
    prenom:    user?.prenom    ?? "",
    nom:       user?.nom       ?? "",
    email:     user?.email     ?? "",
    telephone: user?.telephone ?? "",
    site:      user?.site      ?? "",
  });

  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState("");

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const { data } = await api.patch("/auth/profile/", form);
      updateUser({
        prenom:    data.prenom,
        nom:       data.nom,
        email:     data.email,
        full_name: `${data.prenom} ${data.nom}`.trim(),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3500);
    } catch (err: any) {
      const d = err?.response?.data;
      if (d && typeof d === "object") {
        const msgs = Object.values(d).flat().join(" — ");
        setError(msgs);
      } else {
        setError("Une erreur est survenue. Veuillez réessayer.");
      }
    } finally {
      setSaving(false);
    }
  };

  const initials = `${user?.prenom?.[0] ?? ""}${user?.nom?.[0] ?? ""}`.toUpperCase() || "?";

  const card: React.CSSProperties = {
    background: t.cardBg,
    border: `1px solid ${t.border}`,
    borderRadius: RADIUS.xl,
    boxShadow: shadow.card,
    overflow: "hidden",
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", fontFamily: FONTS.body }}>

      {/* ── En-tête ── */}
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: t.textPrimary, margin: 0 }}>
          Mon profil
        </h1>
        <p style={{ fontSize: "0.875rem", color: t.textMuted, marginTop: "0.3rem" }}>
          Modifiez vos informations personnelles.
        </p>
      </div>

      {/* ── Carte avatar ── */}
      <div style={{ ...card, padding: "1.5rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: GRADIENT_PRIMARY,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.5rem", fontWeight: 700, color: "#fff",
          flexShrink: 0, boxShadow: "0 4px 16px rgba(0,175,212,0.35)",
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "1.15rem", fontWeight: 700, color: t.textPrimary }}>
            {user?.prenom} {user?.nom}
          </div>
          <div style={{ fontSize: "0.82rem", color: t.textMuted, marginTop: 2 }}>
            @{user?.username}
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {user?.role && (
              <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "3px 10px", borderRadius: RADIUS.full, background: "rgba(0,175,212,0.12)", color: "#00afd4", textTransform: "capitalize" }}>
                {user.role}
              </span>
            )}
            <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "3px 10px", borderRadius: RADIUS.full, background: user?.is_active ? "rgba(16,185,129,0.12)" : "rgba(229,53,53,0.1)", color: user?.is_active ? "#10b981" : "#e53535" }}>
              {user?.is_active ? "Actif" : "Inactif"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Formulaire ── */}
      <div style={{ ...card, padding: "1.75rem" }}>
        <div style={{ fontSize: "0.95rem", fontWeight: 600, color: t.textPrimary, marginBottom: "1.25rem", paddingBottom: "0.75rem", borderBottom: `1px solid ${t.border}` }}>
          Informations personnelles
        </div>

        {/* Messages */}
        {error && (
          <div style={{ background: "rgba(229,53,53,0.09)", border: "1px solid rgba(229,53,53,0.25)", borderRadius: RADIUS.md, padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#e53535", marginBottom: "1.25rem", display: "flex", gap: "0.6rem" }}>
            <span>⚠</span> {error}
          </div>
        )}
        {success && (
          <div style={{ background: "rgba(16,185,129,0.09)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: RADIUS.md, padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#10b981", marginBottom: "1.25rem", display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <Icon d={ICONS.check} s={16} /> Profil mis à jour avec succès.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
          <Field label="Prénom"         icon="user"  value={form.prenom}    onChange={set("prenom")}    placeholder="Prénom"              t={t} />
          <Field label="Nom"            icon="user"  value={form.nom}       onChange={set("nom")}       placeholder="Nom de famille"      t={t} />
          <Field label="Email"          icon="mail"  value={form.email}     onChange={set("email")}     placeholder="adresse@email.com"   t={t} type="email" />
          <Field label="Téléphone"      icon="phone" value={form.telephone} onChange={set("telephone")} placeholder="+221 77 000 00 00"   t={t} />
          <Field label="Site / Agence"  icon="map"   value={form.site}      onChange={set("site")}      placeholder="Ex: Dakar, Thiès…"   t={t} />
          <Field label="Nom d'utilisateur" icon="lock" value={user?.username ?? ""} readOnly t={t} />
        </div>

        {/* Bouton */}
        <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: "flex", alignItems: "center", gap: "0.6rem",
              background: saving ? "rgba(0,175,212,0.4)" : GRADIENT_PRIMARY,
              border: "none", borderRadius: RADIUS.md,
              padding: "0.7rem 1.75rem",
              color: "#fff", fontSize: "0.9rem", fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              boxShadow: saving ? "none" : shadow.button,
              fontFamily: FONTS.body,
            }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.boxShadow = shadow.buttonHover; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = saving ? "none" : shadow.button; }}
          >
            {saving ? (
              <>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                  <path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Enregistrement…
              </>
            ) : (
              <><Icon d={ICONS.check} s={16} /> Enregistrer</>
            )}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
