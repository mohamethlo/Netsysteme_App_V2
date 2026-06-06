import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import { billingService, type BillingDashboard } from "../../services/billingService";
import { productsService } from "../../services/productsService";
import { useSwal } from "../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../theme";

import InvoicesTab   from "./tabs/InvoicesTab";
import ProformasTab  from "./tabs/ProformasTab";
import ClientsTab    from "./tabs/ClientsTab";
import ProductsTab   from "./tabs/ProductsTab";

const TABS = [
  { key: "dashboard",  label: "Vue d'ensemble", icon: "📊" },
  { key: "invoices",   label: "Factures",        icon: "📄" },
  { key: "proformas",  label: "Proformas",        icon: "📋" },
  { key: "clients",    label: "Clients",          icon: "👥" },
  { key: "products",   label: "Produits",         icon: "📦" },
] as const;

type TabKey = typeof TABS[number]["key"];

type ProductAlert = {
  id:             number;
  name:           string;
  description:    string | null;
  quantity:       number;
  alert_quantity: number;
  unit_price:     number;
  supplier:       string | null;
  image_path:     string | null;
  stock_status:   "ok" | "faible" | "rupture";
  is_low_stock:   boolean;
};

const CSS = `
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes bell    {
    0%,100% { transform: rotate(0deg) scale(1); }
    10%     { transform: rotate(-22deg) scale(1.05); }
    20%     { transform: rotate(22deg)  scale(1.05); }
    30%     { transform: rotate(-16deg) scale(1.02); }
    40%     { transform: rotate(16deg)  scale(1.02); }
    50%     { transform: rotate(-8deg)  scale(1.01); }
    60%     { transform: rotate(8deg)   scale(1.01); }
    70%,90% { transform: rotate(0deg)   scale(1); }
  }
  @keyframes pulse   {
    0%,100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
    50%     { transform: scale(1.18); box-shadow: 0 0 0 5px rgba(239,68,68,0); }
  }
  @keyframes fadeIn  {
    from { opacity: 0; transform: translateY(-10px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)     scale(1); }
  }
  @keyframes glow {
    0%,100% { box-shadow: 0 0 8px 2px rgba(239,68,68,0.35); }
    50%     { box-shadow: 0 0 22px 6px rgba(239,68,68,0.65); }
  }

  /* ── Cloche ── */
  .stock-bell-wrap { position: relative; }

  /* Dans le CSS const, remplace les règles .stock-bell et .bell-icon par : */

  .stock-bell {
    position: relative;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 68px;
    height: 68px;
    border-radius: 20px;
    border: 3px solid #ef4444;
    background: rgba(239,68,68,0.12);
    transition: all 0.2s;
    animation: glow 2s ease-in-out infinite;
    flex-shrink: 0;
  }
  .stock-bell:hover {
    background: rgba(239,68,68,0.22);
    transform: scale(1.07);
  }
  .stock-bell .bell-icon {
    font-size: 2.2rem;
    animation: bell 2.2s ease-in-out infinite;
    display: block;
    line-height: 1;
  }
  .stock-bell .badge {
    position: absolute;
    top: -11px;
    right: -11px;
    min-width: 28px;
    height: 28px;
    border-radius: 14px;
    background: #ef4444;
    color: #fff;
    font-size: 0.82rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 6px;
    animation: pulse 1.6s ease-in-out infinite;
    border: 3px solid var(--badge-border, #fff);
    letter-spacing: 0;
  }

  /* ── Dropdown ── */
  .stock-dropdown {
    position: absolute;
    top: calc(100% + 12px);
    right: 0;
    width: 370px;
    max-height: 480px;
    overflow-y: auto;
    border-radius: 18px;
    z-index: 600;
    animation: fadeIn 0.18s ease;
  }
  @media (max-width: 520px) {
    .stock-dropdown { width: calc(100vw - 1.5rem); right: -0.5rem; }
  }

  /* ── Item produit ── */
  .stock-product-item {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.75rem 1rem;
    cursor: default;
    transition: background 0.12s;
  }
  .stock-product-item:hover { background: rgba(239,68,68,0.03); }

  /* ── Tabs ── */
  .billing-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    gap: 1rem;
  }

  .billing-header-text { flex: 1; min-width: 0; }

  .billing-bell-wrap {
    flex-shrink: 0;
    margin-left: auto;
  }

  .billing-tabs {
    display: flex; gap: 0.25rem; margin-bottom: 1.5rem;
    border-radius: 12px; padding: 0.3rem;
    width: 100%; overflow-x: auto; flex-wrap: nowrap;
    scrollbar-width: none; -webkit-overflow-scrolling: touch;
  }
  .billing-tabs::-webkit-scrollbar { display: none; }
  @media (max-width: 540px) {
    .billing-tabs button { padding: 0.4rem 0.65rem !important; font-size: 0.76rem !important; }
    .billing-tab-label { font-size: 0.76rem; }
    .billing-tab-icon  { font-size: 0.88rem !important; }
  }

  /* ── StatCards responsive ── */
  .stat-value { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  @media (max-width: 480px) {
    .stat-card  { padding: 0.75rem 0.8rem !important; gap: 0.55rem !important; }
    .stat-icon  { width: 36px !important; height: 36px !important; font-size: 1.05rem !important; border-radius: 10px !important; }
    .stat-value { font-size: 1.1rem !important; }
  }
  @media (max-width: 360px) {
    .stat-card  { padding: 0.6rem 0.65rem !important; gap: 0.4rem !important; }
    .stat-icon  { width: 30px !important; height: 30px !important; font-size: 0.9rem !important; border-radius: 8px !important; }
    .stat-value { font-size: 0.95rem !important; }
  }

  /* ── RecentTable : mobile cards / desktop table ── */
  .rt-table-wrap { display: none; }
  .rt-cards-wrap { display: flex; flex-direction: column; gap: 0; }
  @media (min-width: 560px) {
    .rt-table-wrap { display: block; }
    .rt-cards-wrap { display: none; }
  }

  .dashboard-kpis {
    display: grid; grid-template-columns: repeat(2,1fr);
    gap: 0.85rem; margin-bottom: 1.75rem;
  }
  @media (min-width:480px) { .dashboard-kpis { grid-template-columns: repeat(3,1fr); } }
  @media (min-width:900px) { .dashboard-kpis { grid-template-columns: repeat(6,1fr); } }
  .recent-grid { display: grid; grid-template-columns: 1fr; gap: 1.25rem; }
  @media (min-width:768px) { .recent-grid { grid-template-columns: 1fr 1fr; } }
`;

// ── Cloche stock produits facturation ─────────────────────────────────────────
function StockAlertBell({ theme, dark }: {
  theme: LayoutContext["theme"]; dark: boolean;
}) {
  const [open,    setOpen]    = useState(false);
  const [data,    setData]    = useState<{ alertes: ProductAlert[]; ruptures: number; faibles: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    productsService.getStockAlerts()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const total    = data?.total    ?? 0;
  const ruptures = data?.alertes.filter(a => a.stock_status === "rupture") ?? [];
  const faibles  = data?.alertes.filter(a => a.stock_status === "faible")  ?? [];

  const fmtQty = (q: number) => new Intl.NumberFormat("fr-FR").format(q);

  // N'affiche rien si tout est OK et que le chargement est terminé
  if (!loading && total === 0) return null;

  return (
    <div ref={ref} className="stock-bell-wrap">
      {/* ── Bouton cloche ── */}
      <div className="stock-bell"
        style={{ "--badge-border": dark ? "#0d1117" : "#ffffff" } as React.CSSProperties}
        onClick={() => setOpen(o => !o)}
        title={loading ? "Vérification des stocks…" : `${total} produit(s) en alerte`}>
        {loading
          ? <div style={{ width: 28, height: 28, border: "3px solid rgba(239,68,68,0.25)", borderTopColor: "#ef4444", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          : <span className="bell-icon">🔔</span>
        }
        {!loading && total > 0 && (
          <span className="badge">{total > 99 ? "99+" : total}</span>
        )}
      </div>

      {/* ── Dropdown ── */}
      {open && (
        <div className="stock-dropdown"
          style={{ background: theme.popupBg, border: "2px solid rgba(239,68,68,0.35)", boxShadow: dark ? "0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(239,68,68,0.2)" : "0 12px 40px rgba(239,68,68,0.15), 0 4px 16px rgba(0,0,0,0.12)" }}>

          {/* Header */}
          <div style={{ padding: "1rem 1.1rem 0.75rem", borderBottom: `1px solid rgba(239,68,68,0.2)`, background: "rgba(239,68,68,0.07)", borderRadius: "18px 18px 0 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 800, color: "#ef4444", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  🔔 Alertes stock — Produits
                </div>
                <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: "0.25rem" }}>
                  Produits du catalogue de facturation
                </div>
              </div>
              <button onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.2rem", lineHeight: 1, padding: "2px 4px" }}>
                ✕
              </button>
            </div>
            {/* Compteurs */}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.65rem" }}>
              {ruptures.length > 0 && (
                <span style={{ padding: "3px 10px", borderRadius: RADIUS.full, background: "rgba(239,68,68,0.15)", color: "#ef4444", fontSize: "0.75rem", fontWeight: 700, border: "1px solid rgba(239,68,68,0.3)" }}>
                  🔴 {ruptures.length} rupture{ruptures.length > 1 ? "s" : ""}
                </span>
              )}
              {faibles.length > 0 && (
                <span style={{ padding: "3px 10px", borderRadius: RADIUS.full, background: "rgba(245,158,11,0.12)", color: "#f59e0b", fontSize: "0.75rem", fontWeight: 700, border: "1px solid rgba(245,158,11,0.3)" }}>
                  🟡 {faibles.length} stock faible
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "2.5rem", textAlign: "center" }}>
              <div style={{ width: 28, height: 28, border: "3px solid rgba(239,68,68,0.2)", borderTopColor: "#ef4444", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 0.75rem" }} />
              <div style={{ fontSize: "0.82rem", color: theme.textMuted }}>Chargement des stocks…</div>
            </div>
          ) : total === 0 ? (
            <div style={{ padding: "2.5rem", textAlign: "center", color: theme.textMuted }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✅</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: theme.textPrimary }}>Tous les stocks sont suffisants</div>
            </div>
          ) : (
            <>
              {/* ── Section ruptures ── */}
              {ruptures.length > 0 && (
                <>
                  <div style={{ padding: "0.45rem 1rem", background: "rgba(239,68,68,0.07)", fontSize: "0.66rem", fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span>🔴</span> Rupture de stock ({ruptures.length})
                  </div>
                  {ruptures.map((prod, i) => (
                    <div key={prod.id} className="stock-product-item"
                      style={{ borderBottom: i < ruptures.length - 1 || faibles.length > 0 ? `1px solid ${theme.border}` : "none" }}>

                      {/* Image ou icône */}
                      <div style={{ width: 44, height: 44, borderRadius: "11px", background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        {prod.image_path
                          ? <img src={`/media/${prod.image_path}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ fontSize: "1.3rem" }}>📦</span>}
                      </div>

                      {/* Infos */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: theme.textPrimary, fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {prod.name}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {prod.supplier && <span style={{ marginRight: "0.4rem" }}>🏭 {prod.supplier}</span>}
                          <span>Seuil : {fmtQty(prod.alert_quantity)}</span>
                        </div>
                      </div>

                      {/* Quantité + badge */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "1rem", fontWeight: 800, color: "#ef4444", lineHeight: 1 }}>
                          {fmtQty(prod.quantity)}
                        </div>
                        <span style={{ fontSize: "0.6rem", fontWeight: 800, padding: "2px 6px", borderRadius: RADIUS.full, background: "#ef4444", color: "#fff", whiteSpace: "nowrap", marginTop: 3, display: "inline-block" }}>
                          RUPTURE
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* ── Section stock faible ── */}
              {faibles.length > 0 && (
                <>
                  <div style={{ padding: "0.45rem 1rem", background: "rgba(245,158,11,0.06)", fontSize: "0.66rem", fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span>🟡</span> Stock faible ({faibles.length})
                  </div>
                  {faibles.map((prod, i) => (
                    <div key={prod.id} className="stock-product-item"
                      style={{ borderBottom: i < faibles.length - 1 ? `1px solid ${theme.border}` : "none" }}>

                      <div style={{ width: 44, height: 44, borderRadius: "11px", background: "rgba(245,158,11,0.08)", border: "1.5px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        {prod.image_path
                          ? <img src={`/media/${prod.image_path}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ fontSize: "1.3rem" }}>📦</span>}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: theme.textPrimary, fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {prod.name}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 2 }}>
                          {prod.supplier && <span style={{ marginRight: "0.4rem" }}>🏭 {prod.supplier}</span>}
                          Seuil : {fmtQty(prod.alert_quantity)}
                        </div>
                      </div>

                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "1rem", fontWeight: 800, color: "#f59e0b", lineHeight: 1 }}>
                          {fmtQty(prod.quantity)}
                        </div>
                        <span style={{ fontSize: "0.6rem", fontWeight: 800, padding: "2px 6px", borderRadius: RADIUS.full, background: "rgba(245,158,11,0.18)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.4)", whiteSpace: "nowrap", marginTop: 3, display: "inline-block" }}>
                          FAIBLE
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Footer */}
              <div style={{ padding: "0.7rem 1rem", borderTop: `1px solid ${theme.border}`, background: "rgba(239,68,68,0.04)", borderRadius: "0 0 18px 18px", textAlign: "center" }}>
                <span style={{ fontSize: "0.75rem", color: theme.textMuted }}>
                  💡 Pensez à réapprovisionner avant de créer une facture
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon, onClick, theme }: {
  label: string; value: string | number; color: string;
  icon: string; onClick?: () => void; theme: LayoutContext["theme"];
}) {
  const [hov, setHov] = useState(false);
  return (
    <div className="stat-card" onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov && onClick ? theme.cardBgHover : theme.cardBg, border: `1px solid ${hov && onClick ? color + "55" : theme.border}`, borderRadius: "14px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.85rem", cursor: onClick ? "pointer" : "default", transition: "all 0.18s", transform: hov && onClick ? "translateY(-1px)" : "none" }}>
      <div className="stat-icon" style={{ width: 46, height: 46, borderRadius: "12px", background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: "0.72rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        <div className="stat-value" style={{ fontSize: "1.45rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1 }}>{value}</div>
      </div>
    </div>
  );
}

// ── Recent table ──────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft:     { bg: "rgba(148,163,184,0.12)", text: "#94a3b8" },
  confirmed: { bg: "rgba(6,182,212,0.12)",   text: "#06b6d4" },
  sent:      { bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  paid:      { bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  converted: { bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  overdue:   { bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
  cancelled: { bg: "rgba(100,116,139,0.12)", text: "#64748b" },
};

function RecentTable({ title, rows, theme, color }: {
  title: string;
  rows: { id: number; number: string | null; client: string; date: string; amount: number; status: string; status_display: string }[];
  theme: LayoutContext["theme"];
  color: string;
}) {
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
  return (
    <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
      <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
        <h3 style={{ fontFamily: FONTS.display, fontSize: "0.95rem", fontWeight: 700, color: theme.textPrimary }}>{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", color: theme.textMuted, fontSize: "0.875rem" }}>Aucun élément récent</div>
      ) : (
        <>
          {/* ── Desktop : table ── */}
          <div className="rt-table-wrap">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", fontFamily: FONTS.body }}>
                <thead>
                  <tr>
                    {["Numéro", "Client", "Date", "Montant TTC", "Statut"].map(h => (
                      <th key={h} style={{ padding: "0.55rem 1rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${theme.border}`, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const sc = STATUS_COLORS[r.status] ?? STATUS_COLORS.draft;
                    return (
                      <tr key={r.id} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${theme.border}` : "none" }}
                        onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "0.65rem 1rem", fontWeight: 600, color }}>{r.number ?? `#${r.id}`}</td>
                        <td style={{ padding: "0.65rem 1rem", color: theme.textSecondary, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.client}</td>
                        <td style={{ padding: "0.65rem 1rem", color: theme.textMuted, whiteSpace: "nowrap" }}>{new Date(r.date).toLocaleDateString("fr-FR")}</td>
                        <td style={{ padding: "0.65rem 1rem", fontWeight: 600, color: theme.textPrimary, whiteSpace: "nowrap" }}>{fmt(r.amount)} F</td>
                        <td style={{ padding: "0.65rem 1rem" }}>
                          <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "2px 7px", borderRadius: RADIUS.full, background: sc.bg, color: sc.text, whiteSpace: "nowrap" }}>{r.status_display}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Mobile : cards ── */}
          <div className="rt-cards-wrap">
            {rows.map((r, i) => {
              const sc = STATUS_COLORS[r.status] ?? STATUS_COLORS.draft;
              return (
                <div key={r.id} style={{ padding: "0.75rem 1rem", borderBottom: i < rows.length - 1 ? `1px solid ${theme.border}` : "none", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.85rem", color }}>{r.number ?? `#${r.id}`}</span>
                      <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "2px 6px", borderRadius: RADIUS.full, background: sc.bg, color: sc.text, whiteSpace: "nowrap" }}>{r.status_display}</span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: theme.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.client}</div>
                    <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: "0.15rem" }}>{new Date(r.date).toLocaleDateString("fr-FR")}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: theme.textPrimary, whiteSpace: "nowrap", flexShrink: 0 }}>{fmt(r.amount)} F</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── BillingPage ───────────────────────────────────────────────────────────────
export default function BillingPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const swal            = useSwal();
  const [tab,     setTab]     = useState<TabKey>("dashboard");
  const [dash,    setDash]    = useState<BillingDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tab !== "dashboard") return;
    setLoading(true);
    billingService.getDashboard()
      .then(setDash)
      .catch(() => swal.serverError())
      .finally(() => setLoading(false));
  }, [tab]);

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

  return (
    <div style={{ fontFamily: FONTS.body }}>
      <style>{CSS}</style>

      {/* ── En-tête + Cloche ── */}
      <div className="billing-header">
        <div className="billing-header-text">
          <h1 style={{ fontFamily: FONTS.display, fontSize: "1.5rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>
            Facturation
          </h1>
          <p style={{ fontSize: "0.85rem", color: theme.textMuted, marginTop: 3 }}>
            Clients, produits, factures et proformas NETSYSTEME & SSE
          </p>
        </div>
        <div className="billing-bell-wrap">
          <StockAlertBell theme={theme} dark={dark} />
        </div>
      </div>

      {/* ── Onglets ── */}
      <div className="billing-tabs"
        style={{ background: theme.cardBg, border: `1px solid ${theme.border}` }}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", borderRadius: RADIUS.md, border: "none", background: active ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : "transparent", color: active ? "#fff" : theme.textMuted, fontSize: "0.85rem", fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.15s", fontFamily: FONTS.body, whiteSpace: "nowrap" }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = theme.navHoverBg; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              <span className="billing-tab-icon" style={{ fontSize: "1rem" }}>{t.icon}</span>
              <span className="billing-tab-label">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Dashboard ── */}
      {tab === "dashboard" && (
        loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <div style={{ width: 34, height: 34, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : dash ? (
          <div>
            <div className="dashboard-kpis">
              <StatCard label="Clients"       value={dash.total_clients}                      color={PALETTE.primary} icon="👥" onClick={() => setTab("clients")}   theme={theme} />
              <StatCard label="Factures"      value={dash.total_invoices}                     color={PALETTE.info}    icon="📄" onClick={() => setTab("invoices")}  theme={theme} />
              <StatCard label="Proformas"     value={dash.total_proformas}                    color="#8b5cf6"         icon="📋" onClick={() => setTab("proformas")} theme={theme} />
              <StatCard label="Produits"      value={dash.total_products}                     color={PALETTE.success} icon="📦" onClick={() => setTab("products")}  theme={theme} />
              <StatCard label="Alertes stock" value={dash.low_stock}                          color={PALETTE.warning} icon="⚠️"                                     theme={theme} />
              <StatCard label="CA Total"      value={`${fmt(dash.montant_total_factures)} F`} color={PALETTE.warning} icon="💰"                                     theme={theme} />
            </div>
            <div className="recent-grid">
              <RecentTable title="Factures récentes" color={PALETTE.info} theme={theme}
                rows={dash.recent_invoices.map(inv => ({
                  id: inv.id, number: inv.invoice_number,
                  client: inv.billing_client_detail?.display_name ?? "—",
                  date: inv.date, amount: inv.total_ttc,
                  status: inv.status, status_display: inv.status_display,
                }))}
              />
              <RecentTable title="Proformas récents" color="#8b5cf6" theme={theme}
                rows={dash.recent_proformas.map(p => ({
                  id: p.id, number: p.proforma_number,
                  client: p.billing_client_detail?.display_name ?? "—",
                  date: p.date, amount: p.total_ttc,
                  status: p.status, status_display: p.status_display,
                }))}
              />
            </div>
          </div>
        ) : null
      )}

      {tab === "invoices"  && <InvoicesTab  dark={dark} theme={theme} />}
      {tab === "proformas" && <ProformasTab dark={dark} theme={theme} />}
      {tab === "clients"   && <ClientsTab   dark={dark} theme={theme} />}
      {tab === "products"  && <ProductsTab  dark={dark} theme={theme} />}
    </div>
  );
}