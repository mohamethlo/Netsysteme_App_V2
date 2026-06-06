// src/pages/attendance/components/LateJustifyModal.tsx
import { useState } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { FONTS, RADIUS } from "../../../theme";

interface Props {
  dark:     boolean;
  theme:    LayoutContext["theme"];
  onClose:  () => void;
  onSubmit: (reason: string) => Promise<void>;
}

export default function LateJustifyModal({ dark, theme, onClose, onSubmit }: Props) {
  const [reason,  setReason]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { setError("La justification ne peut pas être vide."); return; }
    setSaving(true);
    try { await onSubmit(reason.trim()); }
    catch (err: any) { setError(err.message ?? "Erreur lors de l'envoi."); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 440, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.6)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}` }}>
          <h2 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: "#f59e0b", marginBottom: 2 }}>
            ⚠ Justification de retard
          </h2>
          <p style={{ fontSize: "0.78rem", color: theme.textMuted }}>
            Votre pointage dépasse l'heure limite (9h15). Veuillez justifier votre retard.
          </p>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: theme.textSecondary, marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Raison du retard *
          </label>
          <textarea required rows={4} value={reason} onChange={e => { setReason(e.target.value); setError(null); }}
            placeholder="Ex: Problème de transport, rendez-vous médical…"
            style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${error ? "#ef4444" : theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, outline: "none", resize: "vertical", boxSizing: "border-box" as const }} />
          {error && <div style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: 4 }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.25rem", paddingTop: "1rem", borderTop: `1px solid ${theme.border}` }}>
            <button type="button" onClick={onClose}
              style={{ padding: "0.62rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
              Plus tard
            </button>
            <button type="submit" disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.62rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? "rgba(245,158,11,0.45)" : "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
              {saving ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> Envoi…</> : "✓ Envoyer"}
            </button>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}