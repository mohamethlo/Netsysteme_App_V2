import { useState, useEffect, useCallback } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { invoicesService, type Invoice, type InvoiceDashboard } from "../../../services/invoicesService";
import { billingClientsService, type BillingClient } from "../../../services/billingClientsService";
import { productsService, type ProductSelect } from "../../../services/productsService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";
import InvoiceFormModal   from "../../invoices/components/InvoiceFormModal";
import InvoiceDetailModal from "../../invoices/components/InvoiceDetailModal";

interface TabProps { dark: boolean; theme: LayoutContext["theme"]; }

const STATUS_CFG = {
  draft:     { label: "Brouillon",  bg: "rgba(148,163,184,0.12)", text: "#94a3b8" },
  confirmed: { label: "Confirmée",  bg: "rgba(6,182,212,0.12)",   text: "#06b6d4" },
  sent:      { label: "Envoyée",    bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  paid:      { label: "Payée",      bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  overdue:   { label: "En retard",  bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
  cancelled: { label: "Annulée",    bg: "rgba(100,116,139,0.12)", text: "#64748b" },
} as const;

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr), now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}
function currentMonthLabel(): string {
  return new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.draft;
  return (
    <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: cfg.bg, color: cfg.text, whiteSpace: "nowrap" }}>
      {cfg.label}
    </span>
  );
}

function StatCard({ label, value, color, icon, sub, onClick, theme }: {
  label: string; value: string | number; color: string;
  icon: string; sub?: string; onClick?: () => void; theme: LayoutContext["theme"];
}) {
  const [hov, setHov] = useState(false);
  return (
    <div className="inv-sc-card" onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov && onClick ? theme.cardBgHover : theme.cardBg, border: `1px solid ${hov && onClick ? color + "44" : theme.border}`, borderRadius: "14px", padding: "0.9rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem", cursor: onClick ? "pointer" : "default", transition: "all 0.18s", transform: hov && onClick ? "translateY(-1px)" : "none" }}>
      <div className="inv-sc-icon" style={{ width: 42, height: 42, borderRadius: "11px", background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: "0.68rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        <div className="inv-sc-val" style={{ fontSize: "1.3rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: "0.68rem", color: theme.textMuted, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

const CSS = `
  @keyframes inv-spin { to { transform: rotate(360deg); } }

  /* ── Grille stats : 1 col (xs) → 2 col (mobile) → 4 col (desktop) ── */
  .inv-stats {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.55rem;
    margin-bottom: 1.25rem;
  }
  @media (min-width: 400px) {
    .inv-stats { grid-template-columns: repeat(2, 1fr); gap: 0.65rem; }
  }
  @media (min-width: 640px) {
    .inv-stats { grid-template-columns: repeat(4, 1fr); gap: 0.85rem; margin-bottom: 1.5rem; }
  }

  /* ── StatCard responsive ── */
  @media (max-width: 399px) {
    /* 1 col : carte horizontale large, valeur toujours lisible */
    .inv-sc-card { padding: 0.75rem 1rem !important; }
    .inv-sc-icon { width: 38px !important; height: 38px !important; font-size: 1.1rem !important; border-radius: 10px !important; }
    .inv-sc-val  { font-size: 1.2rem !important; }
  }
  @media (min-width: 400px) and (max-width: 639px) {
    /* 2 col : compact mais lisible */
    .inv-sc-card { padding: 0.7rem 0.75rem !important; gap: 0.5rem !important; }
    .inv-sc-icon { width: 34px !important; height: 34px !important; font-size: 1rem !important; border-radius: 9px !important; }
    .inv-sc-val  { font-size: 1rem !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  }

  .inv-header {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }
  @media (min-width: 480px) {
    .inv-header {
      flex-direction: row;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
    }
  }

  .inv-toolbar {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    margin-bottom: 1rem;
  }
  @media (min-width: 640px) {
    .inv-toolbar { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 0.65rem; }
  }

  .inv-search { position: relative; width: 100%; }
  @media (min-width: 640px) {
    .inv-search { flex: 1 1 180px; min-width: 150px; }
  }

  .inv-filters { display: grid; grid-template-columns: 1fr 1fr; gap: 0.55rem; }
  @media (min-width: 640px) { .inv-filters { display: contents; } }

  .inv-new-btn { width: 100%; justify-content: center; }
  @media (min-width: 480px) { .inv-new-btn { width: fit-content; } }

  .inv-count { font-size: 0.78rem; text-align: right; }
  @media (min-width: 640px) { .inv-count { margin-left: auto; } }

  .inv-table-wrap { display: none; }
  .inv-cards-wrap { display: flex; flex-direction: column; gap: 0.65rem; }
  @media (min-width: 640px) {
    .inv-table-wrap { display: block; }
    .inv-cards-wrap { display: none; }
  }
`;

export default function InvoicesTab({ dark, theme }: TabProps) {
  const swal = useSwal();

  const [invoices,    setInvoices]    = useState<Invoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [dashboard,   setDashboard]   = useState<InvoiceDashboard | null>(null);
  const [clients,     setClients]     = useState<BillingClient[]>([]);
  const [products,    setProducts]    = useState<ProductSelect[]>([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);

  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("");
  const [domaineFilter, setDomaineFilter] = useState("");
  const [page,          setPage]          = useState(1);
  const PAGE_SIZE = 12;

  const [showForm,   setShowForm]   = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editing,    setEditing]    = useState<Invoice | null>(null);
  const [selected,   setSelected]   = useState<Invoice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
      if (search)        params.search  = search;
      if (statusFilter)  params.status  = statusFilter;
      if (domaineFilter) params.domaine = domaineFilter;

      const [invRes, dashRes, cliRes, prodRes, allRes] = await Promise.all([
        invoicesService.getAll(params),
        invoicesService.getDashboard(),
        billingClientsService.getAll(),
        productsService.getSelect(),
        invoicesService.getAll({ page_size: 500 }),
      ]);

      setInvoices(invRes.results);
      setTotal(invRes.count);
      setDashboard(dashRes);
      setClients(Array.isArray(cliRes) ? cliRes : (cliRes as any).results ?? []);
      setProducts(Array.isArray(prodRes) ? prodRes : []);
      setAllInvoices(Array.isArray(allRes.results) ? allRes.results : []);
    } catch { swal.serverError(); }
    finally { setLoading(false); }
  }, [page, search, statusFilter, domaineFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusFilter, domaineFilter]);

  const handleDelete = async (inv: Invoice) => {
    const ok = await swal.confirmDelete(inv.invoice_number ?? `Facture #${inv.id}`);
    if (!ok) return;
    try { await invoicesService.delete(inv.id); swal.deleted("La facture"); load(); }
    catch { swal.serverError(); }
  };

  // Calculs mois courant
  const invoicesMoisCourant      = allInvoices.filter(inv => isThisMonth(inv.date));
  const montantMoisCourant       = invoicesMoisCourant.reduce((s, inv) => s + inv.total_ttc, 0);
  const montantEnAttenteMois     = invoicesMoisCourant
    .filter(inv => ["draft", "confirmed", "sent"].includes(inv.status))
    .reduce((s, inv) => s + inv.total_ttc, 0);

  const totalPages  = Math.ceil(total / PAGE_SIZE);
  const monthLabel  = currentMonthLabel();

  return (
    <div style={{ fontFamily: FONTS.body }}>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <div className="inv-header">
        <div>
          <h2 style={{ fontFamily: FONTS.display, fontSize: "1.15rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.01em" }}>Factures</h2>
          <p style={{ fontSize: "0.8rem", color: theme.textMuted, marginTop: 2 }}>Créez et gérez vos factures NETSYSTEME et SSE</p>
        </div>
        <button className="inv-new-btn"
          onClick={() => { setEditing(null); setShowForm(true); }}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.6rem 1.1rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap" }}>
          + Nouvelle facture
        </button>
      </div>

      {/* ── Stats (4 cartes) ── */}
      {dashboard && (
        <div className="inv-stats">
          <StatCard
            label="Montant ce mois"
            value={`${fmt(montantMoisCourant)} F`}
            color={PALETTE.primary} icon="📄"
            sub={`${monthLabel} · ${invoicesMoisCourant.length} facture${invoicesMoisCourant.length > 1 ? "s" : ""}`}
            theme={theme}
          />
          <StatCard
            label="Ce mois"
            value={invoicesMoisCourant.length}
            color="#06b6d4" icon="📅"
            sub={monthLabel}
            theme={theme}
          />
          <StatCard
            label="Montant total"
            value={`${fmt(dashboard.montant_total)} F`}
            color={PALETTE.warning} icon="💵"
            sub="FCFA TTC — tous mois"
            theme={theme}
          />
          <StatCard
            label="En attente ce mois"
            value={`${fmt(montantEnAttenteMois)} F`}
            color={PALETTE.danger} icon="⏳"
            sub={`Non payé — ${monthLabel}`}
            theme={theme}
          />
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="inv-toolbar">
        <div className="inv-search">
          <span style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted, pointerEvents: "none" }}>
            <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="N° facture, client…"
            style={{ width: "100%", padding: "0.58rem 0.75rem 0.58rem 2.2rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", outline: "none", fontFamily: FONTS.body, boxSizing: "border-box" }} />
        </div>
        <div className="inv-filters">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: "0.58rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, cursor: "pointer", width: "100%" }}>
            <option value="">Tous statuts</option>
            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={domaineFilter} onChange={e => setDomaineFilter(e.target.value)}
            style={{ padding: "0.58rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, cursor: "pointer", width: "100%" }}>
            <option value="">Tous domaines</option>
            <option value="NETSYSTEME">NETSYSTEME</option>
            <option value="SSE">SSE</option>
          </select>
        </div>
        <span className="inv-count" style={{ color: theme.textMuted }}>{total} facture{total > 1 ? "s" : ""}</span>
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <div style={{ width: 34, height: 34, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "inv-spin 0.8s linear infinite" }} />
        </div>
      ) : invoices.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📄</div>
          <div style={{ fontWeight: 600, color: theme.textPrimary, marginBottom: "0.4rem" }}>
            {search || statusFilter || domaineFilter ? "Aucun résultat" : "Aucune facture"}
          </div>
          <div style={{ fontSize: "0.875rem", color: theme.textMuted, marginBottom: "1.25rem" }}>
            {search || statusFilter || domaineFilter ? "Modifiez vos filtres" : "Créez votre première facture"}
          </div>
          {!search && !statusFilter && !domaineFilter && (
            <button onClick={() => setShowForm(true)}
              style={{ padding: "0.65rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
              + Créer une facture
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Tableau ≥ 640px */}
          <div className="inv-table-wrap" style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {["Numéro", "Client", "Domaine", "Date", "Échéance", "Montant TTC", "Statut", "Actions"].map(h => (
                      <th key={h} style={{ padding: "0.7rem 0.85rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, i) => (
                    <tr key={inv.id}
                      style={{ borderBottom: i < invoices.length - 1 ? `1px solid ${theme.border}` : "none", transition: "background 0.12s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "0.8rem 0.85rem" }}>
                        <button onClick={() => { setSelected(inv); setShowDetail(true); }}
                          style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: PALETTE.primary, fontSize: "0.875rem", fontFamily: FONTS.body, padding: 0 }}>
                          {inv.invoice_number ?? `#${inv.id}`}
                        </button>
                      </td>
                      <td style={{ padding: "0.8rem 0.85rem", color: theme.textSecondary, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {inv.billing_client_detail?.display_name ?? "—"}
                      </td>
                      <td style={{ padding: "0.8rem 0.85rem" }}>
                        {inv.domaine && (
                          <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "2px 6px", borderRadius: RADIUS.full, background: inv.domaine === "SSE" ? "rgba(139,92,246,0.12)" : "rgba(6,182,212,0.1)", color: inv.domaine === "SSE" ? "#8b5cf6" : PALETTE.primary }}>
                            {inv.domaine}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.8rem 0.85rem", color: theme.textMuted, whiteSpace: "nowrap", fontSize: "0.82rem" }}>
                        {new Date(inv.date).toLocaleDateString("fr-FR")}
                      </td>
                      <td style={{ padding: "0.8rem 0.85rem", color: theme.textMuted, whiteSpace: "nowrap", fontSize: "0.82rem" }}>
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td style={{ padding: "0.8rem 0.85rem" }}>
                        <div style={{ fontWeight: 700, color: theme.textPrimary, whiteSpace: "nowrap" }}>{fmt(inv.total_ttc)} F</div>
                        {inv.remaining_balance > 0 && inv.remaining_balance < inv.total_ttc && (
                          <div style={{ fontSize: "0.7rem", color: "#f59e0b" }}>Reste : {fmt(inv.remaining_balance)} F</div>
                        )}
                      </td>
                      <td style={{ padding: "0.8rem 0.85rem" }}><StatusBadge status={inv.status} /></td>
                      <td style={{ padding: "0.8rem 0.85rem" }}>
                        <div style={{ display: "flex", gap: "0.25rem" }}>
                          {[
                            { icon: "👁",  color: PALETTE.primary, title: "Voir",      action: () => { setSelected(inv); setShowDetail(true); } },
                            { icon: "✏️", color: "#3b82f6",        title: "Modifier",  action: () => { setEditing(inv);  setShowForm(true);   } },
                            { icon: "🗑",  color: "#ef4444",        title: "Supprimer", action: () => handleDelete(inv) },
                          ].map(btn => (
                            <button key={btn.icon} onClick={btn.action} title={btn.title}
                              style={{ width: 28, height: 28, borderRadius: RADIUS.md, border: `1px solid ${btn.color}33`, background: "transparent", color: btn.color, cursor: "pointer", fontSize: "0.78rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
                              onMouseEnter={e => (e.currentTarget.style.background = btn.color + "18")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >{btn.icon}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cartes mobiles < 640px */}
          <div className="inv-cards-wrap">
            {invoices.map(inv => {
              const actions = [
                { icon: "👁",  label: "Voir",      color: PALETTE.primary, action: () => { setSelected(inv); setShowDetail(true); } },
                { icon: "✏️", label: "Modifier",  color: "#3b82f6",        action: () => { setEditing(inv);  setShowForm(true);   } },
                { icon: "🗑",  label: "Supprimer", color: "#ef4444",        action: () => handleDelete(inv) },
              ];
              return (
                <div key={inv.id} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
                  {/* Numéro + statut */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", borderBottom: `1px solid ${theme.border}`, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
                    <button onClick={() => { setSelected(inv); setShowDetail(true); }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: PALETTE.primary, fontSize: "1rem", fontFamily: FONTS.body, padding: 0 }}>
                      {inv.invoice_number ?? `#${inv.id}`}
                    </button>
                    <StatusBadge status={inv.status} />
                  </div>
                  {/* Corps */}
                  <div style={{ padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.9rem", color: theme.textSecondary, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                        {inv.billing_client_detail?.display_name ?? "—"}
                      </span>
                      {inv.domaine && (
                        <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "2px 6px", borderRadius: RADIUS.full, background: inv.domaine === "SSE" ? "rgba(139,92,246,0.12)" : "rgba(6,182,212,0.1)", color: inv.domaine === "SSE" ? "#8b5cf6" : PALETTE.primary, flexShrink: 0 }}>
                          {inv.domaine}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>
                        📅 {new Date(inv.date).toLocaleDateString("fr-FR")}
                      </span>
                      {inv.due_date && (
                        <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>
                          ⏱ {new Date(inv.due_date).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: theme.textPrimary }}>
                        {fmt(inv.total_ttc)} F
                      </div>
                      {inv.remaining_balance > 0 && inv.remaining_balance < inv.total_ttc && (
                        <div style={{ fontSize: "0.75rem", color: "#f59e0b" }}>Reste : {fmt(inv.remaining_balance)} F</div>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div style={{ display: "flex", borderTop: `1px solid ${theme.border}` }}>
                    {actions.map((btn, bi) => (
                      <button key={btn.icon} onClick={btn.action}
                        style={{ flex: 1, padding: "0.65rem 0.25rem", border: "none", borderRight: bi < actions.length - 1 ? `1px solid ${theme.border}` : "none", background: "transparent", color: btn.color, fontSize: "0.72rem", cursor: "pointer", fontFamily: FONTS.body, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem", transition: "background 0.15s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = btn.color + "12")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <span style={{ fontSize: "1.05rem" }}>{btn.icon}</span>
                        <span>{btn.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", marginTop: "0.75rem", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px" }}>
          <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>{page} / {totalPages} — {total} résultat{total > 1 ? "s" : ""}</span>
          <div style={{ display: "flex", gap: "0.3rem" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: "0.35rem 0.65rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, fontFamily: FONTS.body, fontSize: "0.8rem" }}>←</button>
            {[...Array(Math.min(totalPages, 5))].map((_, i) => {
              const p = i + 1;
              return <button key={p} onClick={() => setPage(p)} style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid ${p === page ? PALETTE.primary : theme.border}`, background: p === page ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : "transparent", color: p === page ? "#fff" : theme.textMuted, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body }}>{p}</button>;
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ padding: "0.35rem 0.65rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontFamily: FONTS.body, fontSize: "0.8rem" }}>→</button>
          </div>
        </div>
      )}

      {showForm && (
        <InvoiceFormModal dark={dark} theme={theme} invoice={editing} clients={clients} products={products}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }} />
      )}
      {showDetail && selected && (
        <InvoiceDetailModal dark={dark} theme={theme} invoice={selected}
          onClose={() => { setShowDetail(false); setSelected(null); }}
          onEdit={() => { setShowDetail(false); setEditing(selected); setShowForm(true); }}
          onRefresh={load} />
      )}
    </div>
  );
}