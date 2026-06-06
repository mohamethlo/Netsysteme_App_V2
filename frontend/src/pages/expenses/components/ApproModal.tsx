// src/pages/expenses/components/ApproModal.tsx
import { useState } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { expensesService, type Site, type Approvisionnement } from "../../../services/expensesService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark: boolean; theme: LayoutContext["theme"];
  site: Site;
  onClose: () => void; onSaved: () => void;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

export default function ApproModal({ dark, theme, site, onClose, onSaved }: Props) {
  const swal = useSwal();
  const [tab,      setTab]      = useState<"new" | "history">("new");
  const [saving,   setSaving]   = useState(false);
  const [history,  setHistory]  = useState<Approvisionnement[]>([]);
  const [loadingH, setLoadingH] = useState(false);
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ montant: "", date: today });

  const loadHistory = async () => {
    setLoadingH(true);
    try { setHistory(await expensesService.appros.history(site)); }
    catch { swal.serverError(); } finally { setLoadingH(false); }
  };

  const handleTabHistory = () => { setTab("history"); loadHistory(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.montant) { swal.error("Requis", "Le montant est obligatoire."); return; }
    setSaving(true);
    try {
      await expensesService.appros.create({ montant: parseFloat(form.montant), date: form.date, site });
      swal.success("Approvisionnement ajouté !");
      onSaved();
    } catch { swal.serverError(); } finally { setSaving(false); }
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.62rem 0.85rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: "0.72rem", fontWeight: 600,
    color: theme.textSecondary, marginBottom: "0.28rem",
    textTransform: "uppercase", letterSpacing: "0.05em",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: "#10b981" }}>
            💰 Approvisionnement — {site}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
        </div>

        {/* Onglets */}
        <div style={{ display: "flex", borderBottom: `1px solid ${theme.border}` }}>
          {(["new", "history"] as const).map(t => (
            <button key={t} onClick={() => t === "history" ? handleTabHistory() : setTab("new")}
              style={{
                flex: 1, padding: "0.75rem", border: "none", background: "transparent",
                color: tab === t ? "#10b981" : theme.textMuted,
                fontWeight: tab === t ? 700 : 400, fontSize: "0.85rem",
                cursor: "pointer", fontFamily: FONTS.body,
                borderBottom: tab === t ? "2px solid #10b981" : "2px solid transparent",
              }}>
              {t === "new" ? "Nouvel appro" : "Historique"}
            </button>
          ))}
        </div>

        {/* Onglet : Nouveau */}
        {tab === "new" && (
          <form onSubmit={handleSubmit} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div>
              <label style={lbl}>Montant (F) *</label>
              <input required type="number" min="0" step="0.01"
                value={form.montant} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={lbl}>Date *</label>
              <input required type="date"
                value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inp} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem", borderTop: `1px solid ${theme.border}` }}>
              <button type="button" onClick={onClose}
                style={{ padding: "0.62rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
                Annuler
              </button>
              <button type="submit" disabled={saving}
                style={{ padding: "0.62rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Enregistrement…" : "Approvisionner"}
              </button>
            </div>
          </form>
        )}

        {/* Onglet : Historique */}
        {tab === "history" && (
          <div style={{ padding: "1rem 1.5rem" }}>
            {loadingH ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
                <div style={{ width: 28, height: 28, border: "3px solid rgba(16,185,129,0.25)", borderTopColor: "#10b981", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              </div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: "center", color: theme.textMuted, padding: "2rem" }}>Aucun approvisionnement</div>
            ) : history.map((a, i) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.65rem 0", borderBottom: i < history.length - 1 ? `1px solid ${theme.border}` : "none" }}>
                <span style={{ fontSize: "0.82rem", color: theme.textSecondary }}>{a.date_str ?? a.date.slice(0, 10)}</span>
                <span style={{ fontWeight: 700, color: "#10b981" }}>{fmt(a.montant)} F</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}