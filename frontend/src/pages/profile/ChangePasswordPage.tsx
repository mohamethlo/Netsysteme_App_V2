// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/profile/ChangePasswordPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import api from "../../services/api";
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
  lock:    "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z",
  eye:     "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  eyeOff:  "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88",
  check:   "M4.5 12.75l6 6 9-13.5",
  shield:  "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
};

// ── Indicateur de force ───────────────────────────────────────────────────────
function strengthInfo(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: "", color: "transparent" };
  let s = 0;
  if (pwd.length >= 8)                          s++;
  if (pwd.length >= 12)                         s++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd))  s++;
  if (/[0-9]/.test(pwd))                        s++;
  if (/[^A-Za-z0-9]/.test(pwd))                s++;
  if (s <= 1) return { score: s, label: "Très faible", color: "#e53535" };
  if (s === 2) return { score: s, label: "Faible",      color: "#f59e0b" };
  if (s === 3) return { score: s, label: "Moyen",       color: "#eab308" };
  if (s === 4) return { score: s, label: "Fort",        color: "#10b981" };
  return { score: s, label: "Très fort", color: "#06b6d4" };
}

// ── Champ mot de passe ────────────────────────────────────────────────────────
function PwdField({
  label, value, onChange, placeholder, t,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; t: ReturnType<typeof getTheme>;
}) {
  const [show,    setShow]    = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: t.textMuted, marginBottom: "0.45rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)", color: focused ? "#00afd4" : t.textMuted, transition: "color 0.15s", pointerEvents: "none" }}>
          <Icon d={ICONS.lock} s={16} />
        </div>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder ?? "••••••••"}
          autoComplete="new-password"
          style={{
            width: "100%",
            background: focused ? t.inputBgFocus : t.inputBg,
            border: `1px solid ${focused ? "#00afd4" : t.border}`,
            borderRadius: RADIUS.md,
            padding: "0.75rem 2.75rem 0.75rem 2.75rem",
            color: t.textPrimary,
            fontSize: "0.9rem",
            outline: "none",
            transition: "all 0.15s",
            boxShadow: focused ? "0 0 0 3px rgba(0,175,212,0.1)" : "none",
            fontFamily: FONTS.body,
            boxSizing: "border-box",
          }}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{ position: "absolute", right: "0.875rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: 0, display: "flex", transition: "color 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.color = t.textPrimary)}
          onMouseLeave={e => (e.currentTarget.style.color = t.textMuted)}
        >
          <Icon d={show ? ICONS.eyeOff : ICONS.eye} s={16} />
        </button>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function ChangePasswordPage() {
  const { dark } = useOutletContext<LayoutContext>();
  const t = getTheme(dark);
  const shadow = dark ? SHADOW.dark : SHADOW.light;

  const [form, setForm] = useState({ old_password: "", new_password: "", confirm: "" });
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState("");

  const set = (k: keyof typeof form) => (v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setError("");
    setSuccess(false);
  };

  const strength = strengthInfo(form.new_password);
  const mismatch = form.confirm.length > 0 && form.new_password !== form.confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.new_password !== form.confirm) {
      setError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (form.new_password.length < 6) {
      setError("Le nouveau mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await api.post("/auth/change-password/", {
        old_password: form.old_password,
        new_password: form.new_password,
      });
      setSuccess(true);
      setForm({ old_password: "", new_password: "", confirm: "" });
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

  const card: React.CSSProperties = {
    background: t.cardBg,
    border: `1px solid ${t.border}`,
    borderRadius: RADIUS.xl,
    boxShadow: shadow.card,
    overflow: "hidden",
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", fontFamily: FONTS.body }}>

      {/* ── En-tête ── */}
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: t.textPrimary, margin: 0 }}>
          Changer le mot de passe
        </h1>
        <p style={{ fontSize: "0.875rem", color: t.textMuted, marginTop: "0.3rem" }}>
          Choisissez un mot de passe fort pour sécuriser votre compte.
        </p>
      </div>

      {/* ── Conseil sécurité ── */}
      <div style={{ background: "rgba(0,175,212,0.07)", border: "1px solid rgba(0,175,212,0.18)", borderRadius: RADIUS.lg, padding: "0.9rem 1rem", marginBottom: "1.25rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
        <span style={{ color: "#00afd4", flexShrink: 0, marginTop: 1 }}>
          <Icon d={ICONS.shield} s={18} />
        </span>
        <div style={{ fontSize: "0.82rem", color: t.textSecondary, lineHeight: 1.6 }}>
          Utilisez au moins <strong>8 caractères</strong> avec un mélange de lettres majuscules/minuscules, chiffres et symboles.
        </div>
      </div>

      {/* ── Formulaire ── */}
      <form onSubmit={handleSubmit}>
        <div style={{ ...card, padding: "1.75rem" }}>
          <div style={{ fontSize: "0.95rem", fontWeight: 600, color: t.textPrimary, marginBottom: "1.25rem", paddingBottom: "0.75rem", borderBottom: `1px solid ${t.border}` }}>
            Modification du mot de passe
          </div>

          {/* Messages */}
          {error && (
            <div style={{ background: "rgba(229,53,53,0.09)", border: "1px solid rgba(229,53,53,0.25)", borderRadius: RADIUS.md, padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#e53535", marginBottom: "1.25rem", display: "flex", gap: "0.6rem" }}>
              <span>⚠</span> {error}
            </div>
          )}
          {success && (
            <div style={{ background: "rgba(16,185,129,0.09)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: RADIUS.md, padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#10b981", marginBottom: "1.25rem", display: "flex", gap: "0.6rem", alignItems: "center" }}>
              <Icon d={ICONS.check} s={16} /> Mot de passe modifié avec succès.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* Ancien mot de passe */}
            <PwdField
              label="Mot de passe actuel"
              value={form.old_password}
              onChange={set("old_password")}
              placeholder="Votre mot de passe actuel"
              t={t}
            />

            <div style={{ borderTop: `1px solid ${t.border}`, margin: "0.25rem 0" }} />

            {/* Nouveau mot de passe */}
            <PwdField
              label="Nouveau mot de passe"
              value={form.new_password}
              onChange={set("new_password")}
              t={t}
            />

            {/* Indicateur de force */}
            {form.new_password.length > 0 && (
              <div style={{ marginTop: "-0.4rem" }}>
                <div style={{ display: "flex", gap: "4px", marginBottom: "0.35rem" }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= strength.score ? strength.color : t.border, transition: "background 0.25s" }} />
                  ))}
                </div>
                <span style={{ fontSize: "0.75rem", color: strength.color, fontWeight: 600 }}>
                  {strength.label}
                </span>
              </div>
            )}

            {/* Confirmation */}
            <div>
              <PwdField
                label="Confirmer le nouveau mot de passe"
                value={form.confirm}
                onChange={set("confirm")}
                placeholder="Répétez le nouveau mot de passe"
                t={t}
              />
              {mismatch && (
                <p style={{ fontSize: "0.78rem", color: "#e53535", marginTop: "0.35rem", marginLeft: "0.2rem" }}>
                  Les mots de passe ne correspondent pas.
                </p>
              )}
            </div>
          </div>

          {/* Bouton */}
          <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={saving || mismatch}
              style={{
                display: "flex", alignItems: "center", gap: "0.6rem",
                background: (saving || mismatch) ? "rgba(0,175,212,0.4)" : GRADIENT_PRIMARY,
                border: "none", borderRadius: RADIUS.md,
                padding: "0.7rem 1.75rem",
                color: "#fff", fontSize: "0.9rem", fontWeight: 600,
                cursor: (saving || mismatch) ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                boxShadow: (saving || mismatch) ? "none" : shadow.button,
                fontFamily: FONTS.body,
              }}
              onMouseEnter={e => { if (!saving && !mismatch) e.currentTarget.style.boxShadow = shadow.buttonHover; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = (saving || mismatch) ? "none" : shadow.button; }}
            >
              {saving ? (
                <>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                    <path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Modification…
                </>
              ) : (
                <><Icon d={ICONS.lock} s={16} /> Changer le mot de passe</>
              )}
            </button>
          </div>
        </div>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
