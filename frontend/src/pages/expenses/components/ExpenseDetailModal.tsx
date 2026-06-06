// src/pages/expenses/components/ExpenseDetailModal.tsx
import { useState } from "react";
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
  expense: Expense; isAdmin: boolean;
  onClose: () => void; onEdit: () => void; onRefresh: () => void;
}

export default function ExpenseDetailModal({ dark, theme, expense, isAdmin, onClose, onEdit, onRefresh }: Props) {
  const swal  = useSwal();
  const [busy, setBusy] = useState(false);
  const sc = STATUS_CFG[expense.statut] ?? STATUS_CFG.en_attente;

  const handleApprove = async () => {
    setBusy(true);
    try { await expensesService.approve(expense.id); swal.success("Dépense approuvée."); onRefresh(); onClose(); }
    catch { swal.serverError(); } finally { setBusy(false); }
  };

  const handleReject = async () => {
    setBusy(true);
    try { await expensesService.reject(expense.id, ""); swal.success("Dépense rejetée."); onRefresh(); onClose(); }
    catch { swal.serverError(); } finally { setBusy(false); }
  };

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.55rem 0", borderBottom: `1px solid ${theme.border}` }}>
      <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>{label}</span>
      <span style={{ fontSize: "0.875rem", color: theme.textPrimary, fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{value}</span>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: 3 }}>
              <h2 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: theme.textPrimary }}>{expense.titre}</h2>
              <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: sc.bg, color: sc.text }}>{sc.label}</span>
            </div>
            <div style={{ fontSize: "0.78rem", color: theme.textMuted }}>Site : <strong>{expense.site}</strong></div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
        </div>

        {/* Détails */}
        <div style={{ padding: "1.25rem 1.5rem" }}>
          <Row label="Employé"   value={expense.user_detail?.full_name ?? "—"} />
          <Row label="Montant"   value={<strong style={{ fontSize: "1rem", color: PALETTE.primary }}>{fmt(expense.montant)} F</strong>} />
          <Row label="Date"      value={expense.date_str ?? expense.date_depense} />
          <Row label="Catégorie" value={expense.categorie_display ?? expense.categorie ?? "—"} />
          {expense.description  && <Row label="Description"  value={expense.description} />}
          {expense.notes_admin  && <Row label="Notes admin"   value={expense.notes_admin} />}
          {expense.approved_by_detail && <Row label="Approuvé par" value={expense.approved_by_detail.full_name} />}
          {expense.justificatif_url && (
            <Row label="Justificatif" value={
              <a href={expense.justificatif_url} target="_blank" rel="noreferrer"
                style={{ color: PALETTE.primary, fontWeight: 600 }}>📎 Voir le fichier</a>
            } />
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "1rem 1.5rem", borderTop: `1px solid ${theme.border}`, display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {isAdmin && expense.statut !== "approuve" && (
            <button onClick={handleApprove} disabled={busy}
              style={{ padding: "0.55rem 0.9rem", borderRadius: RADIUS.md, border: "1px solid rgba(16,185,129,0.4)", background: "transparent", color: "#10b981", fontSize: "0.82rem", cursor: "pointer", fontFamily: FONTS.body }}>
              ✓ Approuver
            </button>
          )}
          {isAdmin && expense.statut === "approuve" && (
            <button onClick={handleReject} disabled={busy}
              style={{ padding: "0.55rem 0.9rem", borderRadius: RADIUS.md, border: "1px solid rgba(239,68,68,0.4)", background: "transparent", color: "#ef4444", fontSize: "0.82rem", cursor: "pointer", fontFamily: FONTS.body }}>
              ✕ Rejeter
            </button>
          )}
          <button onClick={onClose}
            style={{ padding: "0.55rem 1rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
            Fermer
          </button>
          {isAdmin && (
            <button onClick={onEdit}
              style={{ padding: "0.55rem 1.2rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
              ✏️ Modifier
            </button>
          )}
        </div>
      </div>
    </div>
  );
}