// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/invoices/InvoicesPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import { invoicesService, type Invoice, type InvoiceDashboard } from "../../services/invoicesService";
import { billingClientsService, type BillingClient } from "../../services/billingClientsService";
import { productsService, type ProductSelect } from "../../services/productsService";
import { useSwal } from "../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../theme";
import InvoiceFormModal   from "./components/InvoiceFormModal";
import InvoiceDetailModal from "./components/InvoiceDetailModal";

// ── Constantes ────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  draft:     { label: "Brouillon",  bg: "rgba(148,163,184,0.12)", text: "#94a3b8" },
  confirmed: { label: "Confirmée",  bg: "rgba(6,182,212,0.12)",   text: "#06b6d4" },
  sent:      { label: "Envoyée",    bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  paid:      { label: "Payée",      bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  overdue:   { label: "En retard",  bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
  cancelled: { label: "Annulée",    bg: "rgba(100,116,139,0.12)", text: "#64748b" },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

const CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }

  .inv-header {
    display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.75rem;
  }
  @media (min-width: 480px) {
    .inv-header { flex-direction: row; justify-content: space-between; align-items: flex-start; }
  }

  .inv-table-wrap { display: none; }
  .inv-cards-wrap { display: flex; flex-direction: column; }
  @media (min-width: 640px) {
    .inv-table-wrap { display: block; }
    .inv-cards-wrap { display: none; }
  }
`;

function StatCard({ label, value, color, icon, sub, onClick, theme }: {
  label: string; value: string | number; color: string;
  icon: string; sub?: string; onClick?: () => void; theme: LayoutContext["theme"];
}) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov && onClick ? theme.cardBgHover : theme.cardBg, border: `1px solid ${hov && onClick ? color + "44" : theme.border}`, borderRadius: "14px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.85rem", cursor: onClick ? "pointer" : "default", transition: "all 0.18s", transform: hov && onClick ? "translateY(-1px)" : "none" }}>
      <div style={{ width: 46, height: 46, borderRadius: "12px", background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: "0.72rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: "1.45rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.draft;
  return (
    <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: cfg.bg, color: cfg.text, whiteSpace: "nowrap" }}>
      {cfg.label}
    </span>
  );
}

// ── InvoicesPage ──────────────────────────────────────────────────────────────
export default function InvoicesPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const swal = useSwal();

  // ── Data ───────────────────────────────────────────────────────────────────
  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [dashboard, setDashboard] = useState<InvoiceDashboard | null>(null);
  const [clients,   setClients]   = useState<BillingClient[]>([]);
  const [products,  setProducts]  = useState<ProductSelect[]>([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [domaineFilter, setDomaineFilter] = useState("");
  const [page,         setPage]         = useState(1);
  const PAGE_SIZE = 12;

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [showForm,   setShowForm]   = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editing,    setEditing]    = useState<Invoice | null>(null);
  const [selected,   setSelected]   = useState<Invoice | null>(null);

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
      if (search)        params.search  = search;
      if (statusFilter)  params.status  = statusFilter;
      if (domaineFilter) params.domaine = domaineFilter;

      const [invRes, dashRes, cliRes, prodRes] = await Promise.all([
        invoicesService.getAll(params),
        invoicesService.getDashboard(),
        billingClientsService.getAll(),
        productsService.getSelect(),
      ]);

      setInvoices(invRes.results);
      setTotal(invRes.count);
      setDashboard(dashRes);
      setClients(Array.isArray(cliRes) ? cliRes : (cliRes as any).results ?? []);
      setProducts(Array.isArray(prodRes) ? prodRes : []);
    } catch {
      swal.serverError();
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, domaineFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusFilter, domaineFilter]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleDelete = async (inv: Invoice) => {
    const ok = await swal.confirmDelete(inv.invoice_number ?? `Facture #${inv.id}`);
    if (!ok) return;
    try { await invoicesService.delete(inv.id); swal.deleted("La facture"); load(); }
    catch { swal.serverError(); }
  };

  const handleSaved = () => { setShowForm(false); setEditing(null); load(); };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ fontFamily: FONTS.body }}>
      <style>{CSS}</style>

      {/* ── Page header ── */}
      <div className="inv-header">
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontSize: "1.5rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>
            Facturation
          </h1>
          <p style={{ fontSize: "0.85rem", color: theme.textMuted, marginTop: 3 }}>
            Créez et gérez vos factures NETSYSTEME et SSE
          </p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.62rem 1.25rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, boxShadow: `0 0 20px ${PALETTE.primary}22`, whiteSpace: "nowrap" }}>
          + Nouvelle facture
        </button>
      </div>

      {/* ── Stats ── */}
      {dashboard && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "0.85rem", marginBottom: "1.75rem" }}>
          <StatCard label="Total factures"   value={dashboard.total_factures}                color={PALETTE.primary} icon="📄" theme={theme} onClick={() => setStatusFilter("")} />
          <StatCard label="Brouillons"       value={dashboard.brouillons}                    color="#94a3b8"         icon="📝" theme={theme} onClick={() => setStatusFilter("draft")} />
          <StatCard label="Confirmées"       value={dashboard.confirmees}                    color="#06b6d4"         icon="✅" theme={theme} onClick={() => setStatusFilter("confirmed")} />
          <StatCard label="Payées"           value={dashboard.payees}                        color="#10b981"         icon="💰" theme={theme} onClick={() => setStatusFilter("paid")} />
          <StatCard label="Montant total"    value={`${fmt(dashboard.montant_total)} F`}     color={PALETTE.warning} icon="💵" sub="FCFA TTC" theme={theme} />
          <StatCard label="En attente"       value={`${fmt(dashboard.montant_en_attente)} F`} color={PALETTE.danger} icon="⏳" sub="Non payé" theme={theme} />
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted, pointerEvents: "none" }}>
            <svg width={15} height={15} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="N° facture, client…"
            style={{ width: "100%", paddingLeft: "2.4rem", padding: "0.58rem 0.85rem 0.58rem 2.4rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", outline: "none", fontFamily: FONTS.body }} />
        </div>

        {/* Statut */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: "0.58rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, cursor: "pointer" }}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        {/* Domaine */}
        <select value={domaineFilter} onChange={e => setDomaineFilter(e.target.value)}
          style={{ padding: "0.58rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, cursor: "pointer" }}>
          <option value="">Tous les domaines</option>
          <option value="NETSYSTEME">NETSYSTEME</option>
          <option value="SSE">SSE</option>
        </select>

        <span style={{ fontSize: "0.8rem", color: theme.textMuted, marginLeft: "auto" }}>
          {total} facture{total > 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table ── */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <div style={{ width: 34, height: 34, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
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
          {/* ── Table (≥640px) ── */}
          <div className="inv-table-wrap" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  {["Numéro", "Client", "Domaine", "Date", "Échéance", "Montant TTC", "Statut", "Actions"].map(h => (
                    <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.7rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
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
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <button onClick={() => { setSelected(inv); setShowDetail(true); }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: PALETTE.primary, fontSize: "0.875rem", fontFamily: FONTS.body, padding: 0, textDecoration: "none" }}>
                        {inv.invoice_number ?? `#${inv.id}`}
                      </button>
                    </td>
                    <td style={{ padding: "0.85rem 1rem", color: theme.textSecondary, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {inv.billing_client_detail?.display_name ?? "—"}
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      {inv.domaine && (
                        <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 7px", borderRadius: RADIUS.full, background: inv.domaine === "SSE" ? "rgba(139,92,246,0.12)" : "rgba(6,182,212,0.1)", color: inv.domaine === "SSE" ? "#8b5cf6" : PALETTE.primary }}>
                          {inv.domaine}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", color: theme.textMuted, whiteSpace: "nowrap" }}>
                      {new Date(inv.date).toLocaleDateString("fr-FR")}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", color: theme.textMuted, whiteSpace: "nowrap" }}>
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <div style={{ fontWeight: 700, color: theme.textPrimary }}>{fmt(inv.total_ttc)} F</div>
                      {inv.remaining_balance > 0 && inv.remaining_balance < inv.total_ttc && (
                        <div style={{ fontSize: "0.72rem", color: "#f59e0b" }}>Reste : {fmt(inv.remaining_balance)} F</div>
                      )}
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        {[
                          { icon: "👁",  color: PALETTE.primary, title: "Voir",      action: () => { setSelected(inv); setShowDetail(true); } },
                          { icon: "✏️", color: "#3b82f6",        title: "Modifier",  action: () => { setEditing(inv);  setShowForm(true);    } },
                          { icon: "🗑",  color: "#ef4444",        title: "Supprimer", action: () => handleDelete(inv) },
                        ].map(btn => (
                          <button key={btn.icon} onClick={btn.action} title={btn.title}
                            style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid ${btn.color}33`, background: "transparent", color: btn.color, cursor: "pointer", fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
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
          {/* ── Cartes mobiles (<640px) ── */}
          <div className="inv-cards-wrap">
            {invoices.map((inv, i) => (
              <div key={inv.id} style={{ padding: "0.85rem 1rem", borderBottom: i < invoices.length - 1 ? `1px solid ${theme.border}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.35rem" }}>
                  <button onClick={() => { setSelected(inv); setShowDetail(true); }}
                    style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: PALETTE.primary, fontSize: "0.875rem", fontFamily: FONTS.body, padding: 0 }}>
                    {inv.invoice_number ?? `#${inv.id}`}
                  </button>
                  <StatusBadge status={inv.status} />
                </div>
                <div style={{ fontSize: "0.82rem", color: theme.textSecondary, marginBottom: "0.25rem" }}>
                  {inv.billing_client_detail?.display_name ?? "—"}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "0.75rem", color: theme.textMuted }}>
                    {new Date(inv.date).toLocaleDateString("fr-FR")}
                  </div>
                  <div style={{ fontWeight: 700, color: theme.textPrimary, fontSize: "0.875rem" }}>{fmt(inv.total_ttc)} F</div>
                </div>
                <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.5rem" }}>
                  {[
                    { icon: "👁",  color: PALETTE.primary, title: "Voir",      action: () => { setSelected(inv); setShowDetail(true); } },
                    { icon: "✏️", color: "#3b82f6",        title: "Modifier",  action: () => { setEditing(inv);  setShowForm(true);    } },
                    { icon: "🗑",  color: "#ef4444",        title: "Supprimer", action: () => handleDelete(inv) },
                  ].map(btn => (
                    <button key={btn.icon} onClick={btn.action} title={btn.title}
                      style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid ${btn.color}33`, background: "transparent", color: btn.color, cursor: "pointer", fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                      onMouseEnter={e => (e.currentTarget.style.background = btn.color + "18")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >{btn.icon}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1.25rem", borderTop: `1px solid ${theme.border}` }}>
            <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>
              Page {page} / {totalPages} — {total} résultat{total > 1 ? "s" : ""}
            </span>
            <div style={{ display: "flex", gap: "0.35rem" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: "0.38rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, fontFamily: FONTS.body, fontSize: "0.8rem" }}>← Préc.</button>
              {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                const p = i + 1;
                return <button key={p} onClick={() => setPage(p)} style={{ width: 32, height: 32, borderRadius: RADIUS.md, border: `1px solid ${p === page ? PALETTE.primary : theme.border}`, background: p === page ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : "transparent", color: p === page ? "#fff" : theme.textMuted, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body }}>{p}</button>;
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: "0.38rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontFamily: FONTS.body, fontSize: "0.8rem" }}>Suiv. →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showForm && (
        <InvoiceFormModal dark={dark} theme={theme} invoice={editing} clients={clients} products={products}
          onClose={() => { setShowForm(false); setEditing(null); }} onSaved={handleSaved} />
      )}
      {showDetail && selected && (
        <InvoiceDetailModal dark={dark} theme={theme} invoice={selected}
          onClose={() => { setShowDetail(false); setSelected(null); }}
          onEdit={() => { setShowDetail(false); setEditing(selected); setShowForm(true); }}
          onRefresh={load} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}