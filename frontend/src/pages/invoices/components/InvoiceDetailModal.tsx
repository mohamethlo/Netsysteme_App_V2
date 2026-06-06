// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/billing/components/InvoiceDetailModal.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { billingService, type Invoice, type InvoiceStatus } from "../../../services/billingService";
import { pdfService } from "../../../services/pdfService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark: boolean; theme: LayoutContext["theme"];
  invoice: Invoice;
  onClose: () => void; onEdit: () => void; onRefresh: () => void;
}

const STATUS_CFG: Record<InvoiceStatus, { label: string; bg: string; text: string }> = {
  draft:     { label: "Brouillon",  bg: "rgba(148,163,184,0.12)", text: "#94a3b8" },
  confirmed: { label: "Confirmée",  bg: "rgba(6,182,212,0.12)",   text: "#06b6d4" },
  sent:      { label: "Envoyée",    bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  paid:      { label: "Payée",      bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  overdue:   { label: "En retard",  bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
  cancelled: { label: "Annulée",    bg: "rgba(100,116,139,0.12)", text: "#64748b" },
};

const NEXT: Partial<Record<InvoiceStatus, { to: InvoiceStatus; label: string; color: string }[]>> = {
  draft:     [{ to: "confirmed", label: "✓ Confirmer", color: "#06b6d4" },
              { to: "sent",      label: "📤 Envoyer",  color: "#3b82f6" },
              { to: "cancelled", label: "✕ Annuler",   color: "#64748b" }],
  confirmed: [{ to: "sent", label: "📤 Envoyer", color: "#3b82f6" },
              { to: "paid", label: "💰 Payée",   color: "#10b981" }],
  sent:      [{ to: "paid",    label: "💰 Marquer payée", color: "#10b981" },
              { to: "overdue", label: "⚠ En retard",      color: "#ef4444" }],
};

const CSS = `
  @keyframes idm-spin { to { transform: rotate(360deg); } }

  .idm-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 500;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0;
  }
  @media (min-width: 640px) {
    .idm-overlay { align-items: center; padding: 1rem; }
  }

  .idm-modal {
    width: 100%;
    max-height: 96vh;
    overflow-y: auto;
    border-radius: 18px 18px 0 0;
  }
  @media (min-width: 640px) {
    .idm-modal { max-width: 700px; border-radius: 18px; max-height: 94vh; }
  }

  .idm-header { padding: 1rem 1.1rem; }
  @media (min-width: 640px) { .idm-header { padding: 1.25rem 1.5rem; } }

  .idm-body { padding: 1rem 1.1rem; }
  @media (min-width: 640px) { .idm-body { padding: 1.25rem 1.5rem; } }

  .idm-items-table { display: none; }
  .idm-items-cards { display: flex; flex-direction: column; gap: 0.5rem; }
  @media (min-width: 640px) {
    .idm-items-table { display: block; }
    .idm-items-cards { display: none; }
  }

  .idm-totals {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  @media (min-width: 640px) {
    .idm-totals { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
  }

  .idm-footer {
    padding: 0.85rem 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }
  @media (min-width: 640px) {
    .idm-footer {
      padding: 1rem 1.5rem;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  }

  .idm-footer-left {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .idm-footer-right {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
  }
  @media (min-width: 640px) {
    .idm-footer-right { display: flex; flex-direction: row; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
  }

  .idm-btn-full { width: 100%; justify-content: center; }
  @media (min-width: 640px) { .idm-btn-full { width: auto; } }
`;

function PdfBtn({ icon, label, color, loading, onClick, fullWidth }: {
  icon: string; label: string; color: string;
  loading: boolean; onClick: () => void; fullWidth?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={loading}
      className={fullWidth ? "idm-btn-full" : ""}
      style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.9rem", borderRadius: RADIUS.md, border: `1.5px solid ${color}55`, background: "transparent", color, fontSize: "0.82rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: FONTS.body, transition: "background 0.15s" }}
      onMouseEnter={e => { if (!loading) e.currentTarget.style.background = color + "15"; }}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {loading
        ? <span style={{ width: 12, height: 12, border: `2px solid ${color}44`, borderTopColor: color, borderRadius: "50%", animation: "idm-spin 0.7s linear infinite", display: "inline-block" }} />
        : icon}
      {label}
    </button>
  );
}

export default function InvoiceDetailModal({ dark, theme, invoice, onClose, onEdit, onRefresh }: Props) {
  const swal        = useSwal();
  const [busy,    setBusy]    = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const sc          = STATUS_CFG[invoice.status] ?? STATUS_CFG.draft;
  const fmt         = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
  const nextActions = NEXT[invoice.status] ?? [];

  const withPdf = async (fn: () => Promise<void>) => {
    setPdfBusy(true);
    try { await fn(); }
    catch (e: any) { swal.error("Erreur PDF", e.message ?? "Impossible de générer le PDF."); }
    finally { setPdfBusy(false); }
  };

  const handleConfirm = async () => {
    if (!await swal.confirm({ title: "Confirmer la facture ?", text: "Le stock sera déduit.", confirmText: "Confirmer", icon: "question" })) return;
    setBusy(true);
    try { await billingService.invoices.confirm(invoice.id); swal.success("Facture confirmée."); onRefresh(); onClose(); }
    catch (e: any) { swal.error("Stock insuffisant", e?.response?.data?.detail); }
    finally { setBusy(false); }
  };

  const handleChangeStatus = async (toStatus: InvoiceStatus, label: string) => {
    if (toStatus === "confirmed") { await handleConfirm(); return; }
    if (!await swal.confirm({ title: `${label} cette facture ?`, icon: "question", confirmText: label })) return;
    setBusy(true);
    try { await billingService.invoices.changeStatus(invoice.id, toStatus); swal.success("Statut mis à jour."); onRefresh(); onClose(); }
    catch { swal.serverError(); } finally { setBusy(false); }
  };

  const handleConvertToProforma = async () => {
    if (!await swal.confirm({ title: "Convertir en proforma ?", text: "La facture sera supprimée.", confirmText: "Convertir", icon: "question" })) return;
    setBusy(true);
    try { await billingService.invoices.convertToProforma(invoice.id); swal.success("Converti en proforma."); onRefresh(); onClose(); }
    catch { swal.serverError(); } finally { setBusy(false); }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="idm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="idm-modal" style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

          {/* Header */}
          <div className="idm-header" style={{ borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: 4 }}>
                <h2 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: theme.textPrimary, margin: 0 }}>
                  {invoice.invoice_number ?? `Facture #${invoice.id}`}
                </h2>
                <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: sc.bg, color: sc.text }}>{sc.label}</span>
                {invoice.domaine && (
                  <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: invoice.domaine === "SSE" ? "rgba(139,92,246,0.12)" : "rgba(6,182,212,0.1)", color: invoice.domaine === "SSE" ? "#8b5cf6" : PALETTE.primary }}>
                    {invoice.domaine}
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.8rem", color: theme.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {invoice.billing_client_detail?.display_name ?? "—"}
                {" · "}{new Date(invoice.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                {invoice.due_date && ` · Échéance : ${new Date(invoice.due_date).toLocaleDateString("fr-FR")}`}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1, flexShrink: 0 }}>✕</button>
          </div>

          {/* Corps */}
          <div className="idm-body">
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.6rem" }}>
              Articles ({invoice.items.length})
            </div>

            {/* Tableau desktop */}
            <div className="idm-items-table" style={{ border: `1px solid ${theme.border}`, borderRadius: RADIUS.md, overflow: "hidden", marginBottom: "1.25rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "3fr 0.7fr 1.2fr 0.7fr 1fr", gap: "0.5rem", padding: "0.55rem 0.9rem", background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", borderBottom: `1px solid ${theme.border}`, fontSize: "0.68rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase" }}>
                <span>Description</span><span>Qté</span><span>Prix unit.</span><span>Remise</span><span style={{ textAlign: "right" }}>Total HT</span>
              </div>
              {invoice.items.map((item, i) => (
                <div key={item.id} style={{ display: "grid", gridTemplateColumns: "3fr 0.7fr 1.2fr 0.7fr 1fr", gap: "0.5rem", padding: "0.7rem 0.9rem", borderBottom: i < invoice.items.length - 1 ? `1px solid ${theme.border}` : "none", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 500, color: theme.textPrimary }}>{item.description ?? item.product_name ?? "—"}</div>
                    {item.product_name && item.description && item.description !== item.product_name && <div style={{ fontSize: "0.72rem", color: theme.textMuted }}>{item.product_name}</div>}
                  </div>
                  <span style={{ fontSize: "0.875rem", color: theme.textSecondary }}>{item.quantity}</span>
                  <span style={{ fontSize: "0.875rem", color: theme.textSecondary }}>{fmt(item.unit_price)} F</span>
                  <span style={{ fontSize: "0.875rem", color: item.discount_percent > 0 ? "#f59e0b" : theme.textMuted }}>
                    {item.discount_percent > 0 ? `${item.discount_percent}%` : "—"}
                  </span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600, color: theme.textPrimary, textAlign: "right" }}>
                    {fmt(item.subtotal_after_discount)} F
                  </span>
                </div>
              ))}
            </div>

            {/* Cartes articles mobile */}
            <div className="idm-items-cards" style={{ marginBottom: "1rem" }}>
              {invoice.items.map(item => (
                <div key={item.id} style={{ border: `1px solid ${theme.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
                  <div style={{ padding: "0.6rem 0.85rem", borderBottom: `1px solid ${theme.border}`, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: theme.textPrimary }}>{item.description ?? item.product_name ?? "—"}</div>
                    {item.product_name && item.description && item.description !== item.product_name && (
                      <div style={{ fontSize: "0.72rem", color: theme.textMuted }}>{item.product_name}</div>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "0.6rem 0.85rem", gap: "0.5rem" }}>
                    {[
                      { l: "Quantité",   v: String(item.quantity) },
                      { l: "Prix unit.", v: `${fmt(item.unit_price)} F` },
                      { l: "Remise",     v: item.discount_percent > 0 ? `${item.discount_percent}%` : "—" },
                      { l: "Total HT",   v: `${fmt(item.subtotal_after_discount)} F` },
                    ].map(m => (
                      <div key={m.l}>
                        <div style={{ fontSize: "0.65rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 1 }}>{m.l}</div>
                        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: theme.textPrimary }}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Totaux */}
            <div className="idm-totals">
              {invoice.notes ? (
                <div style={{ padding: "0.85rem 1rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>Notes</div>
                  <div style={{ fontSize: "0.875rem", color: theme.textSecondary, lineHeight: 1.6 }}>{invoice.notes}</div>
                </div>
              ) : <div />}
              <div style={{ background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, overflow: "hidden" }}>
                {[
                  { l: "Total HT",  v: invoice.total_ht,                  bold: false },
                  { l: `TVA (${(invoice.tax_rate * 100).toFixed(0)}%)`,   v: invoice.tva_amount, bold: false },
                  { l: "Total TTC", v: invoice.total_ttc_before_discount,  bold: true  },
                  ...(invoice.discount_value > 0 ? [{ l: "Remise", v: -invoice.discount_value, bold: false }] : []),
                  ...(invoice.has_advance       ? [{ l: "Avance",  v: -invoice.advance_amount, bold: false }] : []),
                ].map((row, i, arr) => (
                  <div key={row.l} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0.9rem", borderBottom: i < arr.length - 1 ? `1px solid ${theme.border}` : "none" }}>
                    <span style={{ fontSize: "0.82rem", color: theme.textMuted }}>{row.l}</span>
                    <span style={{ fontSize: row.bold ? "0.92rem" : "0.85rem", fontWeight: row.bold ? 700 : 500, color: row.v < 0 ? "#10b981" : row.bold ? theme.textPrimary : theme.textSecondary }}>
                      {row.v < 0 ? "- " : ""}{fmt(Math.abs(row.v))} F
                    </span>
                  </div>
                ))}
                <div style={{ padding: "0.75rem 0.9rem", background: dark ? "rgba(6,182,212,0.08)" : "rgba(6,182,212,0.05)", borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 700, color: theme.textPrimary }}>Reste à payer</span>
                  <span style={{ fontSize: "1.2rem", fontWeight: 800, fontFamily: FONTS.display, color: PALETTE.primary }}>{fmt(invoice.remaining_balance)} F</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="idm-footer" style={{ borderTop: `1px solid ${theme.border}` }}>
            {/* Actions statut */}
            <div className="idm-footer-left">
              {nextActions.map(a => (
                <button key={a.to} onClick={() => handleChangeStatus(a.to, a.label)} disabled={busy}
                  className="idm-btn-full"
                  style={{ padding: "0.55rem 0.9rem", borderRadius: RADIUS.md, border: `1px solid ${a.color}44`, background: "transparent", color: a.color, fontSize: "0.8rem", cursor: busy ? "not-allowed" : "pointer", fontFamily: FONTS.body, opacity: busy ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                  onMouseEnter={e => (e.currentTarget.style.background = a.color + "12")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >{a.label}</button>
              ))}
              {invoice.status === "draft" && (
                <button onClick={handleConvertToProforma} disabled={busy}
                  className="idm-btn-full"
                  style={{ padding: "0.55rem 0.9rem", borderRadius: RADIUS.md, border: "1px solid rgba(139,92,246,0.4)", background: "transparent", color: "#8b5cf6", fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  ↩ En proforma
                </button>
              )}
            </div>

            {/* PDF + Fermer/Modifier */}
            <div className="idm-footer-right">
              <PdfBtn icon="📄" label="Voir PDF"    color={PALETTE.primary} loading={pdfBusy} fullWidth
                onClick={() => withPdf(() => pdfService.invoice.view(invoice.id, invoice.billing_client_detail?.display_name, invoice.invoice_number))} />
              <PdfBtn icon="⬇️" label="Télécharger" color="#10b981" loading={pdfBusy} fullWidth
                onClick={() => withPdf(() => pdfService.invoice.download(invoice.id, invoice.billing_client_detail?.display_name, invoice.invoice_number))} />
              <button onClick={onClose} className="idm-btn-full"
                style={{ padding: "0.55rem 1rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
                Fermer
              </button>
              <button onClick={onEdit} className="idm-btn-full"
                style={{ padding: "0.55rem 1.2rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
                ✏️ Modifier
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}