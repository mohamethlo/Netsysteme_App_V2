// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/proformas/ProformasPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import { proformasService, type Proforma, type ProformaDashboard } from "../../services/proformasService";
import { billingClientsService, type BillingClient } from "../../services/billingClientsService";
import { productsService, type ProductSelect } from "../../services/productsService";
import { useSwal } from "../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../theme";
import ProformaFormModal   from "./components/ProformaFormModal";
import ProformaDetailModal from "./components/ProformaDetailModal";

// ── Constantes ────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  draft:     { label: "Brouillon", bg: "rgba(148,163,184,0.12)", text: "#94a3b8" },
  sent:      { label: "Envoyé",    bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  converted: { label: "Converti",  bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  cancelled: { label: "Annulé",    bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
} as const;

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

function countThisMonth(proformas: Proforma[]): number {
  const now = new Date();
  return proformas.filter(p => {
    const d = new Date(p.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
}

function currentMonthLabel(): string {
  return new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon, sub, onClick, theme }: {
  label: string; value: string | number; color: string;
  icon: string; sub?: string; onClick?: () => void;
  theme: LayoutContext["theme"];
}) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov && onClick ? theme.cardBgHover : theme.cardBg,
        border: `1px solid ${hov && onClick ? color + "44" : theme.border}`,
        borderRadius: "14px", padding: "0.9rem 1rem",
        display: "flex", alignItems: "center", gap: "0.75rem",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.18s",
        transform: hov && onClick ? "translateY(-1px)" : "none",
      }}>
      <div style={{ width: 42, height: 42, borderRadius: "11px", background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "0.68rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        <div style={{ fontSize: "1.3rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: "0.68rem", color: theme.textMuted, marginTop: 2 }}>{sub}</div>}
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

// ── ProformasPage ─────────────────────────────────────────────────────────────
export default function ProformasPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const swal = useSwal();

  const [proformas,    setProformas]    = useState<Proforma[]>([]);
  const [allProformas, setAllProformas] = useState<Proforma[]>([]);
  const [dashboard,    setDashboard]    = useState<ProformaDashboard | null>(null);
  const [clients,      setClients]      = useState<BillingClient[]>([]);
  const [products,     setProducts]     = useState<ProductSelect[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);

  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("");
  const [domaineFilter, setDomaineFilter] = useState("");
  const [page,          setPage]          = useState(1);
  const PAGE_SIZE = 12;

  const [showForm,   setShowForm]   = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editing,    setEditing]    = useState<Proforma | null>(null);
  const [selected,   setSelected]   = useState<Proforma | null>(null);

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
      if (search)        params.search  = search;
      if (statusFilter)  params.status  = statusFilter;
      if (domaineFilter) params.domaine = domaineFilter;

      const [profRes, dashRes, cliRes, prodRes, allRes] = await Promise.all([
        proformasService.getAll(params),
        proformasService.getDashboard(),
        billingClientsService.getAll(),
        productsService.getSelect(),
        proformasService.getAll({ page_size: 500 }),
      ]);

      setProformas(profRes.results);
      setTotal(profRes.count);
      setDashboard(dashRes);
      setClients(Array.isArray(cliRes) ? cliRes : (cliRes as any).results ?? []);
      setProducts(Array.isArray(prodRes) ? prodRes : []);
      setAllProformas(Array.isArray(allRes.results) ? allRes.results : []);
    } catch {
      swal.serverError();
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, domaineFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusFilter, domaineFilter]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleDelete = async (p: Proforma) => {
    const ok = await swal.confirmDelete(p.proforma_number ?? `Proforma #${p.id}`);
    if (!ok) return;
    try { await proformasService.delete(p.id); swal.deleted("Le proforma"); load(); }
    catch { swal.serverError(); }
  };

  const handleDuplicateInline = async (p: Proforma) => {
    const ok = await swal.confirm({ title: `Dupliquer "${p.proforma_number}" ?`, confirmText: "Dupliquer", icon: "question" });
    if (!ok) return;
    try { await proformasService.duplicate(p.id); swal.success("Proforma dupliqué !"); load(); }
    catch { swal.serverError(); }
  };

  const handleSaved = () => { setShowForm(false); setEditing(null); load(); };
  const totalPages  = Math.ceil(total / PAGE_SIZE);
  const thisMonth   = countThisMonth(allProformas);

  // ── CSS injecté (media queries impossibles en inline) ──────────────────────
  const css = `
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Stats : 2 colonnes sur mobile, 4 sur desktop */
    .pf-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.65rem;
      margin-bottom: 1.25rem;
    }
    @media (min-width: 640px) {
      .pf-stats {
        grid-template-columns: repeat(4, 1fr);
        gap: 0.85rem;
        margin-bottom: 1.5rem;
      }
    }

    /* Toolbar : colonne sur mobile, ligne sur desktop */
    .pf-toolbar {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      margin-bottom: 1rem;
    }
    @media (min-width: 640px) {
      .pf-toolbar {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.65rem;
      }
    }

    .pf-search {
      position: relative;
      width: 100%;
    }
    @media (min-width: 640px) {
      .pf-search { flex: 1 1 180px; min-width: 150px; }
    }

    .pf-filters {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.55rem;
    }
    @media (min-width: 640px) {
      .pf-filters { display: contents; }
    }

    .pf-count {
      font-size: 0.78rem;
      text-align: right;
    }
    @media (min-width: 640px) {
      .pf-count { margin-left: auto; }
    }

    /* Tableau desktop / cartes mobile */
    .pf-table-wrap { display: none; }
    .pf-cards-wrap { display: flex; flex-direction: column; gap: 0.65rem; }

    @media (min-width: 640px) {
      .pf-table-wrap { display: block; }
      .pf-cards-wrap { display: none; }
    }

    /* Header page */
    .pf-header {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }
    @media (min-width: 480px) {
      .pf-header {
        flex-direction: row;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1.5rem;
      }
    }

    /* Pagination */
    .pf-pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      margin-top: 0.75rem;
      border-radius: 14px;
      border: 1px solid;
    }
  `;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: FONTS.body }}>
      <style>{css}</style>

      {/* ── Header ── */}
      <div className="pf-header">
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontSize: "1.4rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>
            Proformas
          </h1>
          <p style={{ fontSize: "0.82rem", color: theme.textMuted, marginTop: 3 }}>
            Créez et gérez vos devis avant de les convertir en factures
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "0.6rem 1.1rem", borderRadius: RADIUS.md, border: "none", background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, boxShadow: "0 0 20px rgba(139,92,246,0.22)", whiteSpace: "nowrap", width: "fit-content" }}>
          + Nouveau proforma
        </button>
      </div>

      {/* ── Alerte expire bientôt ── */}
      {dashboard && dashboard.expire_bientot > 0 && (
        <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>⏰</span>
          <span style={{ fontSize: "0.85rem", color: theme.textPrimary }}>
            <strong>{dashboard.expire_bientot}</strong> proforma{dashboard.expire_bientot > 1 ? "s expirent" : " expire"} dans les 7 prochains jours.
          </span>
        </div>
      )}

      {/* ── Stats (4 cartes) ── */}
      {dashboard && (
        <div className="pf-stats">
          <StatCard
            label="Total"
            value={dashboard.total_proformas}
            color="#8b5cf6" icon="📋" theme={theme}
            onClick={() => setStatusFilter("")}
          />
          <StatCard
            label={`Ce mois`}
            value={thisMonth}
            color="#06b6d4" icon="📅"
            sub={currentMonthLabel()}
            theme={theme}
          />
          <StatCard
            label="Montant total"
            value={`${fmt(dashboard.montant_total)} F`}
            color={PALETTE.warning} icon="💰" sub="FCFA TTC" theme={theme}
          />
          <StatCard
            label="En attente"
            value={`${fmt(dashboard.montant_en_attente)} F`}
            color={PALETTE.danger} icon="⏳" sub="Non convertis" theme={theme}
          />
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="pf-toolbar">
        {/* Search */}
        <div className="pf-search">
          <span style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted, pointerEvents: "none" }}>
            <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="N° proforma, client…"
            style={{ width: "100%", padding: "0.58rem 0.75rem 0.58rem 2.2rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", outline: "none", fontFamily: FONTS.body, boxSizing: "border-box" }}
          />
        </div>

        {/* Statut + Domaine : grille 2 cols sur mobile, inline sur desktop */}
        <div className="pf-filters">
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

        <span className="pf-count" style={{ color: theme.textMuted }}>
          {total} proforma{total > 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <div style={{ width: 34, height: 34, border: "3px solid rgba(139,92,246,0.25)", borderTopColor: "#8b5cf6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : proformas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📋</div>
          <div style={{ fontWeight: 600, color: theme.textPrimary, marginBottom: "0.4rem" }}>
            {search || statusFilter || domaineFilter ? "Aucun résultat" : "Aucun proforma"}
          </div>
          <div style={{ fontSize: "0.875rem", color: theme.textMuted, marginBottom: "1.25rem" }}>
            {search || statusFilter || domaineFilter ? "Modifiez vos filtres" : "Créez votre premier proforma"}
          </div>
          {!search && !statusFilter && !domaineFilter && (
            <button onClick={() => setShowForm(true)}
              style={{ padding: "0.65rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
              + Créer un proforma
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── Tableau (≥ 640px) ── */}
          <div className="pf-table-wrap" style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {["Numéro", "Client", "Domaine", "Date", "Validité", "Montant TTC", "Statut", "Actions"].map(h => (
                      <th key={h} style={{ padding: "0.7rem 0.85rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {proformas.map((p, i) => {
                    const isExpired   = p.valid_until && new Date(p.valid_until) < new Date() && !p.converted_to_invoice;
                    const expiresSoon = p.valid_until && !isExpired && !p.converted_to_invoice && (() => {
                      const diff = (new Date(p.valid_until!).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                      return diff <= 7;
                    })();
                    return (
                      <tr key={p.id}
                        style={{ borderBottom: i < proformas.length - 1 ? `1px solid ${theme.border}` : "none", transition: "background 0.12s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "0.8rem 0.85rem" }}>
                          <button onClick={() => { setSelected(p); setShowDetail(true); }}
                            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "#8b5cf6", fontSize: "0.875rem", fontFamily: FONTS.body, padding: 0 }}>
                            {p.proforma_number ?? `#${p.id}`}
                          </button>
                        </td>
                        <td style={{ padding: "0.8rem 0.85rem", color: theme.textSecondary, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.billing_client_detail?.display_name ?? "—"}
                        </td>
                        <td style={{ padding: "0.8rem 0.85rem" }}>
                          {p.domaine && (
                            <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "2px 6px", borderRadius: RADIUS.full, background: p.domaine === "SSE" ? "rgba(139,92,246,0.12)" : "rgba(6,182,212,0.1)", color: p.domaine === "SSE" ? "#8b5cf6" : PALETTE.primary }}>
                              {p.domaine}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "0.8rem 0.85rem", color: theme.textMuted, whiteSpace: "nowrap", fontSize: "0.82rem" }}>
                          {new Date(p.date).toLocaleDateString("fr-FR")}
                        </td>
                        <td style={{ padding: "0.8rem 0.85rem", whiteSpace: "nowrap", fontSize: "0.82rem" }}>
                          {p.valid_until ? (
                            <span style={{ color: isExpired ? "#ef4444" : expiresSoon ? "#f59e0b" : theme.textMuted, fontWeight: isExpired || expiresSoon ? 600 : 400 }}>
                              {new Date(p.valid_until).toLocaleDateString("fr-FR")}
                              {isExpired && " ⚠"}{expiresSoon && " ⏰"}
                            </span>
                          ) : "—"}
                        </td>
                        <td style={{ padding: "0.8rem 0.85rem", fontWeight: 700, color: theme.textPrimary, whiteSpace: "nowrap" }}>
                          {fmt(p.total_ttc)} F
                        </td>
                        <td style={{ padding: "0.8rem 0.85rem" }}>
                          <StatusBadge status={p.status} />
                        </td>
                        <td style={{ padding: "0.8rem 0.85rem" }}>
                          <div style={{ display: "flex", gap: "0.25rem" }}>
                            {[
                              { icon: "👁",  color: "#8b5cf6", title: "Voir",      action: () => { setSelected(p); setShowDetail(true); } },
                              ...(!p.converted_to_invoice ? [
                                { icon: "✏️", color: "#3b82f6", title: "Modifier",  action: () => { setEditing(p); setShowForm(true); } },
                                { icon: "📋", color: "#06b6d4", title: "Dupliquer", action: () => handleDuplicateInline(p) },
                              ] : []),
                              { icon: "🗑",  color: "#ef4444", title: "Supprimer", action: () => handleDelete(p) },
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Cartes mobiles (< 640px) ── */}
          <div className="pf-cards-wrap">
            {proformas.map(p => {
              const isExpired   = p.valid_until && new Date(p.valid_until) < new Date() && !p.converted_to_invoice;
              const expiresSoon = p.valid_until && !isExpired && !p.converted_to_invoice && (() => {
                const diff = (new Date(p.valid_until!).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                return diff <= 7;
              })();
              const actions = [
                { icon: "👁",  label: "Voir",      color: "#8b5cf6", action: () => { setSelected(p); setShowDetail(true); } },
                ...(!p.converted_to_invoice ? [
                  { icon: "✏️", label: "Modifier",  color: "#3b82f6", action: () => { setEditing(p); setShowForm(true); } },
                  { icon: "📋", label: "Dupliquer", color: "#06b6d4", action: () => handleDuplicateInline(p) },
                ] : []),
                { icon: "🗑",  label: "Supprimer", color: "#ef4444", action: () => handleDelete(p) },
              ];
              return (
                <div key={p.id} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
                  {/* Barre haut : numéro + statut */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", borderBottom: `1px solid ${theme.border}`, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
                    <button onClick={() => { setSelected(p); setShowDetail(true); }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "#8b5cf6", fontSize: "1rem", fontFamily: FONTS.body, padding: 0 }}>
                      {p.proforma_number ?? `#${p.id}`}
                    </button>
                    <StatusBadge status={p.status} />
                  </div>

                  {/* Corps */}
                  <div style={{ padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {/* Client + Domaine */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.9rem", color: theme.textSecondary, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                        {p.billing_client_detail?.display_name ?? "—"}
                      </span>
                      {p.domaine && (
                        <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "2px 6px", borderRadius: RADIUS.full, background: p.domaine === "SSE" ? "rgba(139,92,246,0.12)" : "rgba(6,182,212,0.1)", color: p.domaine === "SSE" ? "#8b5cf6" : PALETTE.primary, flexShrink: 0 }}>
                          {p.domaine}
                        </span>
                      )}
                    </div>

                    {/* Dates */}
                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>
                        📅 {new Date(p.date).toLocaleDateString("fr-FR")}
                      </span>
                      {p.valid_until && (
                        <span style={{ fontSize: "0.8rem", color: isExpired ? "#ef4444" : expiresSoon ? "#f59e0b" : theme.textMuted, fontWeight: isExpired || expiresSoon ? 600 : 400 }}>
                          ⏱ {new Date(p.valid_until).toLocaleDateString("fr-FR")}
                          {isExpired && " ⚠"}{expiresSoon && " ⏰"}
                        </span>
                      )}
                    </div>

                    {/* Montant */}
                    <div style={{ fontSize: "1.15rem", fontWeight: 700, color: theme.textPrimary }}>
                      {fmt(p.total_ttc)} F
                    </div>
                  </div>

                  {/* Barre actions */}
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

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", marginTop: "0.75rem", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px" }}>
          <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>
            {page} / {totalPages} — {total} résultat{total > 1 ? "s" : ""}
          </span>
          <div style={{ display: "flex", gap: "0.3rem" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: "0.35rem 0.65rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, fontFamily: FONTS.body, fontSize: "0.8rem" }}>←</button>
            {[...Array(Math.min(totalPages, 5))].map((_, i) => {
              const p = i + 1;
              return (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid ${p === page ? "#8b5cf6" : theme.border}`, background: p === page ? "linear-gradient(135deg,#8b5cf6,#6d28d9)" : "transparent", color: p === page ? "#fff" : theme.textMuted, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body }}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ padding: "0.35rem 0.65rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontFamily: FONTS.body, fontSize: "0.8rem" }}>→</button>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showForm && (
        <ProformaFormModal dark={dark} theme={theme} proforma={editing} clients={clients} products={products}
          onClose={() => { setShowForm(false); setEditing(null); }} onSaved={handleSaved} />
      )}
      {showDetail && selected && (
        <ProformaDetailModal dark={dark} theme={theme} proforma={selected}
          onClose={() => { setShowDetail(false); setSelected(null); }}
          onEdit={() => { setShowDetail(false); setEditing(selected); setShowForm(true); }}
          onRefresh={load} />
      )}
    </div>
  );
}