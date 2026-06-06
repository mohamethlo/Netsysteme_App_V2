// src/pages/expenses/components/TrashModal.tsx
import { useState, useEffect } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { expensesService, type Expense } from "../../../services/expensesService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  en_attente: { label: "En attente", bg: "rgba(245,158,11,0.12)", text: "#f59e0b" },
  approuve:   { label: "Approuvé",   bg: "rgba(16,185,129,0.12)", text: "#10b981" },
  rejete:     { label: "Rejeté",     bg: "rgba(239,68,68,0.12)",  text: "#ef4444" },
};
const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

interface Props {
  dark: boolean; theme: LayoutContext["theme"];
  onClose: () => void;
}

export default function TrashModal({ dark, theme, onClose }: Props) {
  const swal = useSwal();
  const [items,   setItems]   = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setItems(await expensesService.getTrash()); }
    catch { swal.serverError(); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleRestore = async (id: number) => {
    if (!await swal.confirm({ title: "Restaurer cette dépense ?", confirmText: "Restaurer", icon: "question" })) return;
    try { await expensesService.restore(id); swal.success("Dépense restaurée."); load(); }
    catch { swal.serverError(); }
  };

  const handleForceDelete = async (id: number) => {
    if (!await swal.confirm({ title: "Supprimer définitivement ?", text: "Cette action est irréversible.", confirmText: "Supprimer", icon: "warning" })) return;
    try { await expensesService.forceDelete(id); swal.success("Supprimée définitivement."); load(); }
    catch { swal.serverError(); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: "#ef4444" }}>
              🗑 Corbeille des dépenses
            </h2>
            <p style={{ fontSize: "0.78rem", color: theme.textMuted }}>
              Supprimées depuis moins de 24h — restauration possible
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
        </div>

        {/* Contenu */}
        <div style={{ padding: "1.25rem 1.5rem" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
              <div style={{ width: 28, height: 28, border: "3px solid rgba(239,68,68,0.2)", borderTopColor: "#ef4444", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: theme.textMuted }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✨</div>
              <div>La corbeille est vide</div>
            </div>
          ) : items.map((exp, i) => {
            const sc = STATUS_CFG[exp.statut] ?? STATUS_CFG.en_attente;
            return (
              <div key={exp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 0", borderBottom: i < items.length - 1 ? `1px solid ${theme.border}` : "none", gap: "0.75rem" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: theme.textPrimary, marginBottom: 2 }}>{exp.titre}</div>
                  <div style={{ fontSize: "0.75rem", color: theme.textMuted }}>
                    {exp.date_str} · {exp.site} · <strong style={{ color: PALETTE.primary }}>{fmt(exp.montant)} F</strong>
                    {exp.categorie && ` · ${exp.categorie}`}
                    {" · "}
                    <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "1px 5px", borderRadius: RADIUS.full, background: sc.bg, color: sc.text }}>
                      {sc.label}
                    </span>
                  </div>
                  {exp.deleted_at_str && (
                    <div style={{ fontSize: "0.68rem", color: theme.textMuted, marginTop: 1 }}>
                      Supprimée le : {exp.deleted_at_str}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.3rem", flexShrink: 0 }}>
                  {exp.can_restore && (
                    <button onClick={() => handleRestore(exp.id)} title="Restaurer"
                      style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: "1px solid rgba(16,185,129,0.4)", background: "transparent", color: "#10b981", cursor: "pointer", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(16,185,129,0.1)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >↩</button>
                  )}
                  <button onClick={() => handleForceDelete(exp.id)} title="Supprimer définitivement"
                    style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: "1px solid rgba(239,68,68,0.4)", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >🗑</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: "1rem 1.5rem", borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose}
            style={{ padding: "0.55rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
            Fermer
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}