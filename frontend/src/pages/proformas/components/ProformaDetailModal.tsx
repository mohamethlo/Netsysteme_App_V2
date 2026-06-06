// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/billing/components/ProformaDetailModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { billingService, type Proforma } from "../../../services/billingService";
import { pdfService } from "../../../services/pdfService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark: boolean; theme: LayoutContext["theme"];
  proforma: Proforma;
  onClose: () => void; onEdit: () => void; onRefresh: () => void;
}

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  draft:     { label: "Brouillon", bg: "rgba(148,163,184,0.12)", text: "#94a3b8" },
  sent:      { label: "Envoyé",    bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  converted: { label: "Converti",  bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  cancelled: { label: "Annulé",    bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
};

const CSS = `
  @keyframes pfd-spin { to { transform: rotate(360deg); } }

  /* Overlay padding : plus serré sur mobile */
  .pfd-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 500;
    display: flex;
    align-items: flex-end;        /* collé en bas sur mobile */
    justify-content: center;
    padding: 0;
  }
  @media (min-width: 640px) {
    .pfd-overlay {
      align-items: center;
      padding: 1rem;
    }
  }

  /* Conteneur modal */
  .pfd-modal {
    width: 100%;
    max-height: 96vh;
    overflow-y: auto;
    border-radius: 18px 18px 0 0;  /* coins ronds en haut seulement sur mobile */
  }
  @media (min-width: 640px) {
    .pfd-modal {
      max-width: 700px;
      border-radius: 18px;
      max-height: 94vh;
    }
  }

  /* Header */
  .pfd-header {
    padding: 1rem 1.1rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
  }
  @media (min-width: 640px) {
    .pfd-header { padding: 1.25rem 1.5rem; }
  }

  /* Corps */
  .pfd-body { padding: 1rem 1.1rem; }
  @media (min-width: 640px) {
    .pfd-body { padding: 1.25rem 1.5rem; }
  }

  /* Tableau articles : grille sur desktop, cartes sur mobile */
  .pfd-items-table { display: none; }
  .pfd-items-cards { display: flex; flex-direction: column; gap: 0.5rem; }
  @media (min-width: 640px) {
    .pfd-items-table { display: block; }
    .pfd-items-cards { display: none; }
  }

  /* Totaux : 1 colonne sur mobile, 2 sur desktop */
  .pfd-totals {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  @media (min-width: 640px) {
    .pfd-totals {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }
  }

  /* Footer */
  .pfd-footer {
    padding: 0.85rem 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }
  @media (min-width: 640px) {
    .pfd-footer {
      padding: 1rem 1.5rem;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  }

  .pfd-footer-left {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .pfd-footer-right {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
  }
  @media (min-width: 640px) {
    .pfd-footer-right {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
  }

  /* Boutons pleine largeur sur mobile */
  .pfd-btn-full {
    width: 100%;
    justify-content: center;
  }
  @media (min-width: 640px) {
    .pfd-btn-full { width: auto; }
  }
`;

function PdfBtn({ icon, label, color, loading, onClick, fullWidth }: {
  icon: string; label: string; color: string;
  loading: boolean; onClick: () => void; fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={loading} title={label}
      className={fullWidth ? "pfd-btn-full" : ""}
      style={{
        display: "flex", alignItems: "center", gap: "0.4rem",
        padding: "0.55rem 0.9rem", borderRadius: RADIUS.md,
        border: `1.5px solid ${color}55`, background: "transparent",
        color, fontSize: "0.82rem", fontWeight: 600,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
        fontFamily: FONTS.body, transition: "background 0.15s",
      }}
      onMouseEnter={e => { if (!loading) e.currentTarget.style.background = color + "15"; }}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {loading
        ? <span style={{ width: 12, height: 12, border: `2px solid ${color}44`, borderTopColor: color, borderRadius: "50%", animation: "pfd-spin 0.7s linear infinite", display: "inline-block" }} />
        : icon}
      {label}
    </button>
  );
}

export default function ProformaDetailModal({ dark, theme, proforma, onClose, onEdit, onRefresh }: Props) {
  const swal = useSwal();
  const [busy,    setBusy]    = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const sc  = STATUS_CFG[proforma.status] ?? STATUS_CFG.draft;
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

  const withPdf = async (fn: () => Promise<void>) => {
    setPdfBusy(true);
    try { await fn(); }
    catch (e: any) { swal.error("Erreur PDF", e.message ?? "Impossible de générer le PDF."); }
    finally { setPdfBusy(false); }
  };

  const handleConvert = async () => {
    if (!await swal.confirm({ title: "Convertir en facture ?", confirmText: "Convertir", icon: "question" })) return;
    setBusy(true);
    try {
      await billingService.proformas.convert(proforma.id);
      swal.success("Proforma converti en facture !");
      onRefresh(); onClose();
    } catch (e: any) {
      swal.error("Erreur", e?.response?.data?.detail);
    } finally { setBusy(false); }
  };

  const handleDuplicate = async () => {
    if (!await swal.confirm({ title: "Dupliquer ce proforma ?", confirmText: "Dupliquer", icon: "question" })) return;
    setBusy(true);
    try {
      await billingService.proformas.duplicate(proforma.id);
      swal.success("Proforma dupliqué !");
      onRefresh(); onClose();
    } catch { swal.serverError(); } finally { setBusy(false); }
  };

  const expired = proforma.valid_until
    && new Date(proforma.valid_until) < new Date()
    && !proforma.converted_to_invoice;

  return (
    <>
      <style>{CSS}</style>

      <div className="pfd-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div
          className="pfd-modal"
          style={{
            background: theme.popupBg,
            border: `1px solid ${theme.border}`,
            boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)",
            fontFamily: FONTS.body,
          }}
        >
          {/* ── Header ── */}
          <div className="pfd-header" style={{ borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Numéro + badges */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: 4 }}>
                <h2 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: "#8b5cf6", margin: 0 }}>
                  {proforma.proforma_number ?? `Proforma #${proforma.id}`}
                </h2>
                <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: sc.bg, color: sc.text }}>
                  {sc.label}
                </span>
                {proforma.domaine && (
                  <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: "rgba(6,182,212,0.1)", color: PALETTE.primary }}>
                    {proforma.domaine}
                  </span>
                )}
                {expired && (
                  <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                    ⚠ Expiré
                  </span>
                )}
              </div>
              {/* Sous-titre */}
              <div style={{ fontSize: "0.8rem", color: theme.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {proforma.billing_client_detail?.display_name ?? "—"}
                {" · "}
                {new Date(proforma.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                {proforma.valid_until && (
                  <span> · <span style={{ color: expired ? "#ef4444" : theme.textMuted }}>
                    Valide jusqu'au {new Date(proforma.valid_until).toLocaleDateString("fr-FR")}
                  </span></span>
                )}
              </div>
            </div>
            <button onClick={onClose}
              style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1, flexShrink: 0 }}>
              ✕
            </button>
          </div>

          {/* ── Corps ── */}
          <div className="pfd-body">

            {/* Titre section articles */}
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.6rem" }}>
              Articles ({proforma.items.length})
            </div>

            {/* ── Tableau desktop (≥ 640px) ── */}
            <div className="pfd-items-table" style={{ border: `1px solid ${theme.border}`, borderRadius: RADIUS.md, overflow: "hidden", marginBottom: "1.25rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "3fr 0.7fr 1.2fr 0.7fr 1fr", gap: "0.5rem", padding: "0.55rem 0.9rem", background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", borderBottom: `1px solid ${theme.border}`, fontSize: "0.68rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase" }}>
                <span>Description</span><span>Qté</span><span>Prix unit.</span><span>Remise</span>
                <span style={{ textAlign: "right" }}>Total HT</span>
              </div>
              {proforma.items.map((item, i) => (
                <div key={item.id} style={{ display: "grid", gridTemplateColumns: "3fr 0.7fr 1.2fr 0.7fr 1fr", gap: "0.5rem", padding: "0.7rem 0.9rem", borderBottom: i < proforma.items.length - 1 ? `1px solid ${theme.border}` : "none", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 500, color: theme.textPrimary }}>{item.description ?? item.product_name ?? "—"}</div>
                    {item.product_name && item.description && item.description !== item.product_name && (
                      <div style={{ fontSize: "0.72rem", color: theme.textMuted }}>{item.product_name}</div>
                    )}
                  </div>
                  <span style={{ fontSize: "0.875rem", color: theme.textSecondary }}>{item.quantity}</span>
                  <span style={{ fontSize: "0.875rem", color: theme.textSecondary }}>{fmt(item.unit_price)} F</span>
                  <span style={{ fontSize: "0.875rem", color: item.discount_percent > 0 ? "#f59e0b" : theme.textMuted }}>
                    {item.discount_percent > 0 ? `${item.discount_percent}%` : "—"}
                  </span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600, color: theme.textPrimary, textAlign: "right" }}>
                    {fmt(item.subtotal_discount ?? item.subtotal)} F
                  </span>
                </div>
              ))}
            </div>

            {/* ── Cartes articles mobile (< 640px) ── */}
            <div className="pfd-items-cards" style={{ marginBottom: "1rem" }}>
              {proforma.items.map((item) => (
                <div key={item.id} style={{ border: `1px solid ${theme.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
                  {/* Nom article */}
                  <div style={{ padding: "0.6rem 0.85rem", borderBottom: `1px solid ${theme.border}`, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: theme.textPrimary }}>
                      {item.description ?? item.product_name ?? "—"}
                    </div>
                    {item.product_name && item.description && item.description !== item.product_name && (
                      <div style={{ fontSize: "0.72rem", color: theme.textMuted }}>{item.product_name}</div>
                    )}
                  </div>
                  {/* Métriques en grille 2×2 */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "0.6rem 0.85rem", gap: "0.5rem" }}>
                    {[
                      { l: "Quantité",    v: String(item.quantity) },
                      { l: "Prix unit.",  v: `${fmt(item.unit_price)} F` },
                      { l: "Remise",      v: item.discount_percent > 0 ? `${item.discount_percent}%` : "—" },
                      { l: "Total HT",    v: `${fmt(item.subtotal_discount ?? item.subtotal)} F` },
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

            {/* ── Totaux ── */}
            <div className="pfd-totals">
              {/* Notes */}
              {proforma.notes ? (
                <div style={{ padding: "0.85rem 1rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>Notes</div>
                  <div style={{ fontSize: "0.875rem", color: theme.textSecondary, lineHeight: 1.6 }}>{proforma.notes}</div>
                </div>
              ) : <div />}

              {/* Récap financier */}
              <div style={{ background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, overflow: "hidden" }}>
                {[
                  { l: "Total HT",  v: proforma.total_ht,                 bold: false },
                  { l: `TVA (${(proforma.tax_rate * 100).toFixed(0)}%)`,  v: proforma.tva_amount, bold: false },
                  { l: "Total TTC", v: proforma.total_ttc_before_discount, bold: true  },
                  ...(proforma.discount_value > 0 ? [{ l: "Remise", v: -proforma.discount_value, bold: false }] : []),
                ].map((row, i, arr) => (
                  <div key={row.l} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0.9rem", borderBottom: i < arr.length - 1 ? `1px solid ${theme.border}` : "none" }}>
                    <span style={{ fontSize: "0.82rem", color: theme.textMuted }}>{row.l}</span>
                    <span style={{ fontSize: row.bold ? "0.92rem" : "0.85rem", fontWeight: row.bold ? 700 : 500, color: row.v < 0 ? "#10b981" : row.bold ? theme.textPrimary : theme.textSecondary }}>
                      {row.v < 0 ? "- " : ""}{fmt(Math.abs(row.v))} F
                    </span>
                  </div>
                ))}
                <div style={{ padding: "0.75rem 0.9rem", background: dark ? "rgba(139,92,246,0.08)" : "rgba(139,92,246,0.05)", borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 700, color: theme.textPrimary }}>Total TTC</span>
                  <span style={{ fontSize: "1.2rem", fontWeight: 800, fontFamily: FONTS.display, color: "#8b5cf6" }}>
                    {fmt(proforma.total_ttc)} F
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="pfd-footer" style={{ borderTop: `1px solid ${theme.border}` }}>
            {/* Actions secondaires */}
            <div className="pfd-footer-left">
              {!proforma.converted_to_invoice && proforma.status !== "cancelled" && (
                <button onClick={handleConvert} disabled={busy}
                  className="pfd-btn-full"
                  style={{ padding: "0.55rem 0.9rem", borderRadius: RADIUS.md, border: "1px solid rgba(16,185,129,0.4)", background: "transparent", color: "#10b981", fontSize: "0.82rem", cursor: "pointer", fontFamily: FONTS.body, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(16,185,129,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  → Convertir en facture
                </button>
              )}
              <button onClick={handleDuplicate} disabled={busy}
                className="pfd-btn-full"
                style={{ padding: "0.55rem 0.9rem", borderRadius: RADIUS.md, border: "1px solid rgba(139,92,246,0.4)", background: "transparent", color: "#8b5cf6", fontSize: "0.82rem", cursor: "pointer", fontFamily: FONTS.body, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(139,92,246,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                📋 Dupliquer
              </button>
            </div>

            {/* Actions PDF + Fermer/Modifier */}
            <div className="pfd-footer-right">
              <PdfBtn icon="📄" label="Voir PDF"    color="#8b5cf6" loading={pdfBusy} fullWidth
                onClick={() => withPdf(() => pdfService.proforma.view(proforma.id, proforma.billing_client_detail?.display_name, proforma.proforma_number))} />
              <PdfBtn icon="⬇️" label="Télécharger" color="#10b981" loading={pdfBusy} fullWidth
                onClick={() => withPdf(() => pdfService.proforma.download(proforma.id, proforma.billing_client_detail?.display_name, proforma.proforma_number))} />
              <button onClick={onClose}
                className="pfd-btn-full"
                style={{ padding: "0.55rem 1rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
                Fermer
              </button>
              <button onClick={onEdit}
                className="pfd-btn-full"
                style={{ padding: "0.55rem 1.2rem", borderRadius: RADIUS.md, border: "none", background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
                ✏️ Modifier
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}