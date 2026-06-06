// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/installations/components/VersementModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { installationsService, type Installation } from "../../../services/installationService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface VersementProps {
  dark:         boolean;
  theme:        LayoutContext["theme"];
  installation: Installation;
  onClose:      () => void;
  onSaved:      () => void;
}

export function VersementModal({ dark, theme, installation, onClose, onSaved }: VersementProps) {
  const swal     = useSwal();
  const [montant, setMontant] = useState("");
  const [saving,  setSaving]  = useState(false);
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = parseFloat(montant);
    if (!m || m <= 0) { swal.error("Invalide", "Le montant doit être positif."); return; }
    setSaving(true);
    try {
      const result = await installationsService.versement(installation.id, m);
      swal.success("Versement enregistré !");
      if (result.recu_url) {
        window.open(result.recu_url, "_blank");
      }
      onSaved();
    } catch { swal.serverError(); } finally { setSaving(false); }
  };

  const inp: React.CSSProperties = { width: "100%", padding: "0.62rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, outline: "none" };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.72rem", fontWeight: 600, color: theme.textSecondary, marginBottom: "0.28rem", textTransform: "uppercase", letterSpacing: "0.05em" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 420, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.6)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: theme.textPrimary }}>Nouveau versement</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {/* Infos read-only */}
          {[
            { l: "Montant total (FCFA)",     v: fmt(installation.montant_total) },
            { l: "Montant déjà payé (FCFA)", v: fmt(installation.montant_avance) },
            { l: "Montant restant (FCFA)",   v: fmt(installation.montant_restant) },
          ].map(r => (
            <div key={r.l}>
              <label style={lbl}>{r.l}</label>
              <input readOnly value={r.v} style={{ ...inp, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", cursor: "not-allowed" }} />
            </div>
          ))}
          <div>
            <label style={lbl}>Montant à verser (FCFA) *</label>
            <input type="number" required
              value={montant} onChange={e => setMontant(e.target.value)}
              style={inp} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem", borderTop: `1px solid ${theme.border}` }}>
            <button type="button" onClick={onClose}
              style={{ padding: "0.62rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
              Annuler
            </button>
            <button type="submit" disabled={saving || !montant}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.62rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? "rgba(6,182,212,0.45)" : `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
              {saving ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> Enregistrement…</> : "Valider le versement"}
            </button>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}