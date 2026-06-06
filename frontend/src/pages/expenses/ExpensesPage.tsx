// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/expenses/ExpensesPage.tsx
//  Page dépenses — onglets Dakar | Mbour (admin) ou vue site unique
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import { expensesService, type Expense, type SiteDashboard, type Site } from "../../services/expensesService";
import { useAuthStore } from "../../store/authStore";
import { useSwal } from "../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../theme";
import ExpenseFormModal   from "./components/ExpenseFormModal";
import ExpenseDetailModal from "./components/ExpenseDetailModal";
import ApproModal         from "./components/ApproModal";
import TrashModal         from "./components/TrashModal";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  en_attente: { label: "En attente", bg: "rgba(245,158,11,0.12)", text: "#f59e0b" },
  approuve:   { label: "Approuvé",   bg: "rgba(16,185,129,0.12)", text: "#10b981" },
  rejete:     { label: "Rejeté",     bg: "rgba(239,68,68,0.12)",  text: "#ef4444" },
};

function StatusBadge({ statut }: { statut: string }) {
  const s = STATUS_CFG[statut] ?? STATUS_CFG.en_attente;
  return <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: s.bg, color: s.text }}>{s.label}</span>;
}

function KpiCard({ label, value, color, icon, theme }: { label: string; value: number; color: string; icon: string; theme: any }) {
  return (
    <div style={{ background: theme.cardBg, border: `1px solid ${color}33`, borderRadius: "14px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.85rem" }}>
      <div style={{ width: 44, height: 44, borderRadius: "12px", background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: "1.35rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1 }}>{fmt(value)} F</div>
      </div>
    </div>
  );
}

// ── Mini graphique barres ────────────────────────────────────────────────────
function MiniBarChart({ appro, depenses, theme }: { appro: number[]; depenses: number[]; theme: any }) {
  const max = Math.max(...appro, ...depenses, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 60, padding: "0 4px" }}>
      {appro.map((a, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <div style={{ width: "100%", background: PALETTE.primary + "99", borderRadius: "2px 2px 0 0", height: `${(a / max) * 50}px`, minHeight: a > 0 ? 2 : 0 }} />
          <div style={{ width: "100%", background: "#ef4444aa", borderRadius: "2px 2px 0 0", height: `${(depenses[i] / max) * 50}px`, minHeight: depenses[i] > 0 ? 2 : 0 }} />
          <div style={{ fontSize: "0.45rem", color: theme.textMuted }}>{MONTHS[i]}</div>
        </div>
      ))}
    </div>
  );
}

// ── Vue d'un site ─────────────────────────────────────────────────────────────
function SiteView({ site, dark, theme, isAdmin }: { site: Site; dark: boolean; theme: any; isAdmin: boolean }) {
  const swal = useSwal();

  const [stats,      setStats]      = useState<SiteDashboard | null>(null);
  const [expenses,   setExpenses]   = useState<Expense[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState("");
  const [monthF,     setMonthF]     = useState("");
  const [yearF,      setYearF]      = useState("");
  const [statusF,    setStatusF]    = useState("");
  const [catF,       setCatF]       = useState("");
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [showForm,   setShowForm]   = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showAppro,  setShowAppro]  = useState(false);
  const [showTrash,  setShowTrash]  = useState(false);
  const [editing,    setEditing]    = useState<Expense | null>(null);
  const [selected,   setSelected]   = useState<Expense | null>(null);
  const PAGE = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { site, page, page_size: PAGE };
      if (search)  params.search   = search;
      if (statusF) params.statut   = statusF;
      if (catF)    params.categorie= catF;
      if (monthF)  params.month    = monthF;
      if (yearF)   params.year     = yearF;
      const [exps, dash, cats] = await Promise.all([
        expensesService.getAll(params),
        expensesService.getDashboard({ site, month: monthF ? Number(monthF) : undefined, year: yearF ? Number(yearF) : undefined }),
        expensesService.getCategories(),
      ]);
      setExpenses(exps.results); setTotal(exps.count);
      setStats(dash as SiteDashboard);
      setCategories(cats);
    } catch { swal.serverError(); } finally { setLoading(false); }
  }, [site, page, search, statusF, catF, monthF, yearF]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusF, catF, monthF, yearF]);

  const handleDelete = async (exp: Expense) => {
    if (!await swal.confirmDelete(`« ${exp.titre} »`)) return;
    try { await expensesService.delete(exp.id); swal.success("Dépense envoyée dans la corbeille."); load(); }
    catch { swal.serverError(); }
  };

  const handleApprove = async (exp: Expense) => {
    try { await expensesService.approve(exp.id); swal.success("Dépense approuvée."); load(); }
    catch { swal.serverError(); }
  };

  const handleReject = async (exp: Expense) => {
    const { value: notes } = await (window as any).Swal?.fire({
      title: "Raison du rejet",
      input: "textarea", inputPlaceholder: "Motif (optionnel)…",
      showCancelButton: true, confirmButtonText: "Rejeter", cancelButtonText: "Annuler",
    }) ?? { value: undefined };
    if (notes === undefined) return;
    try { await expensesService.reject(exp.id, notes); swal.success("Dépense rejetée."); load(); }
    catch { swal.serverError(); }
  };

  const totalPages = Math.ceil(total / PAGE);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2022 }, (_, i) => currentYear - i);

  const selectStyle = { padding: "0.55rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.82rem", fontFamily: FONTS.body, cursor: "pointer", minWidth: 0 } as const;

  const CSS = `
    @keyframes exp-spin { to { transform: rotate(360deg); } }
    .exp-kpis { display: grid; grid-template-columns: repeat(2,1fr); gap: 0.65rem; margin-bottom: 1.25rem; }
    @media (min-width: 640px) { .exp-kpis { grid-template-columns: repeat(4,1fr); gap: 0.85rem; } }

    .exp-toolbar { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
    @media (min-width: 640px) { .exp-toolbar { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 0.6rem; } }

    .exp-filters { display: flex; gap: 0.45rem; flex-wrap: wrap; }
    .exp-actions { display: flex; gap: 0.45rem; flex-wrap: wrap; align-items: center; }

    .exp-table-wrap { display: none; }
    .exp-mobile-list { display: flex; flex-direction: column; }
    @media (min-width: 680px) { .exp-table-wrap { display: block; } .exp-mobile-list { display: none; } }

    .exp-mobile-row {
      display: flex; align-items: flex-start; gap: 0.75rem;
      padding: 0.85rem 1rem;
    }
    .exp-mobile-row + .exp-mobile-row { border-top: 1px solid var(--exp-border); }
    .exp-mobile-row-body { flex: 1; min-width: 0; }
    .exp-mobile-row-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.35rem; flex-shrink: 0; }
  `;

  return (
    <div>
      <style>{CSS}</style>
      {/* KPIs */}
      {stats && (
        <div className="exp-kpis">
          <KpiCard label="Approvisionnement" value={stats.total_appro}    color={PALETTE.primary} icon="💰" theme={theme} />
          <KpiCard label="Dépenses"          value={stats.total_depenses} color="#ef4444"         icon="🛒" theme={theme} />
          <KpiCard label="Restant appro"     value={stats.benefice}       color="#10b981"         icon="📈" theme={theme} />
          <KpiCard label="Non approvisionné" value={stats.pertes}         color="#f59e0b"         icon="📉" theme={theme} />
        </div>
      )}

      {/* Mini graphique mensuel */}
      {stats && (
        <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: theme.textSecondary }}>Évolution mensuelle</span>
            <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.68rem", color: theme.textMuted }}>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: PALETTE.primary, marginRight: 4 }} />Appro</span>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#ef4444", marginRight: 4 }} />Dépenses</span>
            </div>
          </div>
          <MiniBarChart appro={stats.appro_mensuel} depenses={stats.depenses_mensuel} theme={theme} />
        </div>
      )}

      {/* Toolbar */}
      <div className="exp-toolbar">
        {/* Ligne 1 : recherche + filtres */}
        <div className="exp-filters" style={{ flex: 1, minWidth: 0 }}>
          {/* Recherche */}
          <div style={{ position: "relative", flex: "1 1 140px", minWidth: 120 }}>
            <span style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted, pointerEvents: "none" }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Titre, employé…"
              style={{ width: "100%", padding: "0.55rem 0.85rem 0.55rem 2.2rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.82rem", outline: "none", fontFamily: FONTS.body, boxSizing: "border-box" }} />
          </div>
          {/* Année */}
          <select value={yearF} onChange={e => setYearF(e.target.value)} style={selectStyle}>
            <option value="">Toutes années</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {/* Mois */}
          <select value={monthF} onChange={e => setMonthF(e.target.value)} style={selectStyle}>
            <option value="">Tous les mois</option>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          {/* Statut */}
          <select value={statusF} onChange={e => setStatusF(e.target.value)} style={selectStyle}>
            <option value="">Tous statuts</option>
            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {/* Catégorie */}
          <select value={catF} onChange={e => setCatF(e.target.value)} style={selectStyle}>
            <option value="">Toutes catégories</option>
            {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* Ligne 2 : compteur + actions */}
        <div className="exp-actions">
          <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>{total} dépense{total > 1 ? "s" : ""}</span>
          <button onClick={() => setShowTrash(true)}
            style={{ padding: "0.5rem 0.75rem", borderRadius: RADIUS.md, border: "1px solid rgba(239,68,68,0.35)", background: "transparent", color: "#ef4444", fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap" }}>
            🗑 Corbeille
          </button>
          {isAdmin && (
            <>
              <button onClick={() => setShowAppro(true)}
                style={{ padding: "0.5rem 0.75rem", borderRadius: RADIUS.md, border: "1px solid rgba(16,185,129,0.4)", background: "transparent", color: "#10b981", fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap" }}>
                💰 Appro
              </button>
              <button onClick={() => setShowAppro(true)}
                style={{ padding: "0.5rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap" }}>
                📋 Historique
              </button>
            </>
          )}
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            style={{ padding: "0.5rem 0.9rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap" }}>
            + Nouvelle
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : expenses.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: theme.textMuted }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>💸</div>
            <div>Aucune dépense{search || statusF || catF ? " pour ces filtres" : ""}</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  {["Date", "Titre", "Employé", "Montant", "Catégorie", "Statut", "Actions"].map(h => (
                    <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp, i) => (
                  <tr key={exp.id}
                    style={{ borderBottom: i < expenses.length - 1 ? `1px solid ${theme.border}` : "none", transition: "background 0.12s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap", color: theme.textMuted }}>{exp.date_str ?? exp.date_depense}</td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <button onClick={() => { setSelected(exp); setShowDetail(true); }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 600, color: PALETTE.primary, fontSize: "0.875rem", fontFamily: FONTS.body, padding: 0, textAlign: "left" }}>
                        {exp.titre}
                      </button>
                      {exp.description && <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 1 }}>{exp.description.slice(0, 55)}{exp.description.length > 55 ? "…" : ""}</div>}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", color: theme.textSecondary }}>{exp.user_detail?.full_name ?? "—"}</td>
                    <td style={{ padding: "0.85rem 1rem", fontWeight: 700, color: theme.textPrimary, whiteSpace: "nowrap" }}>{fmt(exp.montant)} F</td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      {exp.categorie && <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 7px", borderRadius: RADIUS.full, background: "rgba(148,163,184,0.12)", color: theme.textSecondary }}>{exp.categorie_display ?? exp.categorie}</span>}
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}><StatusBadge statut={exp.statut} /></td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        {/* Voir */}
                        <Btn icon="👁" color={PALETTE.primary} title="Voir" onClick={() => { setSelected(exp); setShowDetail(true); }} />
                        {/* Approuver/Rejeter (admin) */}
                        {isAdmin && exp.statut !== "approuve" && (
                          <Btn icon="✓" color="#10b981" title="Approuver" onClick={() => handleApprove(exp)} />
                        )}
                        {isAdmin && exp.statut === "approuve" && (
                          <Btn icon="✕" color="#ef4444" title="Rejeter" onClick={() => handleReject(exp)} />
                        )}
                        {/* Modifier */}
                        {isAdmin && (
                          <Btn icon="✏️" color="#3b82f6" title="Modifier" onClick={() => { setEditing(exp); setShowForm(true); }} />
                        )}
                        {/* Supprimer */}
                        {isAdmin && (
                          <Btn icon="🗑" color="#ef4444" title="Supprimer" onClick={() => handleDelete(exp)} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1.25rem", borderTop: `1px solid ${theme.border}` }}>
            <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>Page {page}/{totalPages} — {total} résultat{total > 1 ? "s" : ""}</span>
            <div style={{ display: "flex", gap: "0.35rem" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: "0.38rem 0.7rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, fontSize: "0.8rem", fontFamily: FONTS.body }}>←</button>
              {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                const p = i + 1;
                return <button key={p} onClick={() => setPage(p)} style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid ${p === page ? PALETTE.primary : theme.border}`, background: p === page ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : "transparent", color: p === page ? "#fff" : theme.textMuted, fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body }}>{p}</button>;
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: "0.38rem 0.7rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontSize: "0.8rem", fontFamily: FONTS.body }}>→</button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <ExpenseFormModal dark={dark} theme={theme} site={site} expense={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }} />
      )}
      {showDetail && selected && (
        <ExpenseDetailModal dark={dark} theme={theme} expense={selected} isAdmin={isAdmin}
          onClose={() => { setShowDetail(false); setSelected(null); }}
          onEdit={() => { setShowDetail(false); setEditing(selected); setShowForm(true); }}
          onRefresh={load} />
      )}
      {showAppro && (
        <ApproModal dark={dark} theme={theme} site={site}
          onClose={() => setShowAppro(false)}
          onSaved={() => { setShowAppro(false); load(); }} />
      )}
      {showTrash && (
        <TrashModal dark={dark} theme={theme}
          onClose={() => { setShowTrash(false); load(); }} />
      )}
    </div>
  );
}

function Btn({ icon, color, title, onClick }: { icon: string; color: string; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title}
      style={{ width: 28, height: 28, borderRadius: RADIUS.md, border: `1px solid ${color}33`, background: "transparent", color, cursor: "pointer", fontSize: "0.78rem", display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseEnter={e => (e.currentTarget.style.background = color + "18")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >{icon}</button>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function ExpensesPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const { user, hasPermission } = useAuthStore();
  const isAdmin  = hasPermission("all");
  const userSite = (user?.site ?? null) as Site | null;

  // Un non-admin sans site configuré voit Dakar par défaut
  const defaultSite: Site = isAdmin ? "Dakar" : (userSite ?? "Dakar");
  const [activeSite, setActiveSite] = useState<Site>(defaultSite);

  // Admin : les deux sites ; non-admin : uniquement son site
  const sites: Site[] = isAdmin ? ["Dakar", "Mbour"] : [userSite ?? "Dakar"];

  return (
    <div style={{ fontFamily: FONTS.body }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily: FONTS.display, fontSize: "1.5rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>
          Dépenses
        </h1>
        <p style={{ fontSize: "0.85rem", color: theme.textMuted, marginTop: 3 }}>
          Suivi des dépenses et approvisionnements par site
        </p>
      </div>

      {/* Onglets sites */}
      {isAdmin && (
        <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1.5rem", background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", borderRadius: "12px", padding: "4px", width: "100%", border: `1px solid ${theme.border}`, overflowX: "auto", flexWrap: "nowrap", scrollbarWidth: "none" }}>
          {sites.map(s => (
            <button key={s} onClick={() => setActiveSite(s)}
              style={{ padding: "0.52rem 1.25rem", borderRadius: "9px", border: "none", background: activeSite === s ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : "transparent", color: activeSite === s ? "#fff" : theme.textMuted, fontSize: "0.875rem", fontWeight: activeSite === s ? 700 : 500, cursor: "pointer", fontFamily: FONTS.body, transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0 }}>
              📍 {s}
            </button>
          ))}
        </div>
      )}

      <SiteView key={activeSite} site={activeSite} dark={dark} theme={theme} isAdmin={isAdmin} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}