import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import {
  interventionsService,
  type Intervention,
  type InterventionDashboard,
  type Technicien,
} from "../../services/interventionsService";
import { useSwal } from "../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../theme";
import { useAuthStore } from "../../store/authStore";
import InterventionFormModal   from "./components/InterventionFormModal";
import InterventionDetailModal from "./components/InterventionDetailModal";


// ── Config statuts ────────────────────────────────────────────────────────────
const STATUT_CFG = {
  planifiee: { label: "Planifiée", bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  en_cours:  { label: "En cours",  bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
  terminee:  { label: "Terminée",  bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  annulee:   { label: "Annulée",   bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
} as const;

const PRIORITE_CFG = {
  basse:   { label: "Basse",   bg: "rgba(148,163,184,0.12)", text: "#94a3b8" },
  normale: { label: "Normale", bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  haute:   { label: "Haute",   bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
  urgente: { label: "Urgente", bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
} as const;

// ── CSS responsive ────────────────────────────────────────────────────────────
const CSS = `
  @keyframes int-spin { to { transform: rotate(360deg); } }

  .int-header {
    display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;
  }
  @media (min-width: 480px) {
    .int-header { flex-direction: row; justify-content: space-between; align-items: flex-start; }
  }

  .int-stats {
    display: grid; grid-template-columns: repeat(2,1fr); gap: 0.65rem; margin-bottom: 1.5rem;
  }
  @media (min-width: 480px) { .int-stats { grid-template-columns: repeat(3,1fr); } }
  @media (min-width: 900px) { .int-stats { grid-template-columns: repeat(6,1fr); gap: 0.85rem; } }

  .int-filters {
    display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; align-items: center;
  }
  .int-search  { position: relative; flex: 1 1 180px; min-width: 150px; }
  .int-select  { flex: 1 1 130px; min-width: 110px; }
  .int-reset   { flex: 0 0 auto; }
  .int-count   { flex: 0 0 auto; margin-left: auto; font-size: 0.78rem; white-space: nowrap; }

  .int-table-wrap { display: none; }
  .int-cards-wrap { display: flex; flex-direction: column; gap: 0.6rem; }
  @media (min-width: 768px) {
    .int-table-wrap { display: block; }
    .int-cards-wrap { display: none; }
  }
`;

function StatutBadge({ statut }: { statut: string }) {
  const cfg = STATUT_CFG[statut as keyof typeof STATUT_CFG] ?? STATUT_CFG.planifiee;
  return <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: cfg.bg, color: cfg.text, whiteSpace: "nowrap" }}>{cfg.label}</span>;
}

function PrioriteBadge({ priorite }: { priorite: string }) {
  const cfg = PRIORITE_CFG[priorite as keyof typeof PRIORITE_CFG] ?? PRIORITE_CFG.normale;
  return <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: cfg.bg, color: cfg.text, whiteSpace: "nowrap" }}>{cfg.label}</span>;
}

function StatCard({ label, value, color, icon, onClick, theme }: {
  label: string; value: number | string; color: string; icon: string;
  onClick?: () => void; theme: LayoutContext["theme"];
}) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov && onClick ? theme.cardBgHover : theme.cardBg, border: `1px solid ${hov && onClick ? color + "44" : theme.border}`, borderRadius: "14px", padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "0.65rem", cursor: onClick ? "pointer" : "default", transition: "all 0.18s", transform: hov && onClick ? "translateY(-1px)" : "none" }}>
      <div style={{ width: 38, height: 38, borderRadius: "10px", background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "0.65rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        <div style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1 }}>{value}</div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function InterventionsPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const swal = useSwal();
  const { user } = useAuthStore();

  const userRole      = (user as any)?.role ?? "";
  const isCommercial  = ["commercial", "Commercial"].includes(userRole);
  const isRT          = ["Responsable Technique", "responsable_technique"].includes(userRole);
  const isAdmin       = !!(user as any)?.is_staff || ["Administrateur", "Dev_administration", "administration"].includes(userRole);
  const canCreate     = isCommercial || isAdmin;
  const canDelete     = isAdmin;

  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [dashboard,     setDashboard]     = useState<InterventionDashboard | null>(null);
  const [technicians,   setTechnicians]   = useState<Technicien[]>([]);
  const [responsables,  setResponsables]  = useState<Technicien[]>([]);
  const [total,         setTotal]         = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [assignModal,   setAssignModal]   = useState<Intervention | null>(null);
  const [assignTechId,  setAssignTechId]  = useState("");

  const [search,   setSearch]   = useState("");
  const [statutF,  setStatutF]  = useState("");
  const [prioriteF,setPrioriteF]= useState("");
  const [typeF,    setTypeF]    = useState("");
  const [dateF,    setDateF]    = useState("");
  const [page,     setPage]     = useState(1);
  const PAGE_SIZE = 15;

  const [showForm,   setShowForm]   = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editing,    setEditing]    = useState<Intervention | null>(null);
  const [selected,   setSelected]   = useState<Intervention | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: PAGE_SIZE };
      if (search)    params.search            = search;
      if (statutF)   params.statut            = statutF;
      if (prioriteF) params.priorite          = prioriteF;
      if (typeF)     params.type_intervention = typeF;
      if (dateF)     params.date              = dateF;

      const [res, dash, techs, rts] = await Promise.all([
        interventionsService.getAll(params),
        interventionsService.getDashboard(),
        interventionsService.getTechnicians(),
        interventionsService.getResponsables(),
      ]);

      setInterventions(res.results);
      setTotal(res.count);
      setDashboard(dash);
      setTechnicians(techs);
      setResponsables(rts);
    } catch { swal.serverError(); }
    finally   { setLoading(false); }
  }, [page, search, statutF, prioriteF, typeF, dateF]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statutF, prioriteF, typeF, dateF]);

  const handleDelete = async (inv: Intervention) => {
    if (!await swal.confirmDelete(`Intervention #${inv.id}`)) return;
    try { await interventionsService.delete(inv.id); swal.deleted("L'intervention"); load(); }
    catch { swal.serverError(); }
  };

  const handleAssignTechnicien = async () => {
    if (!assignModal || !assignTechId) return;
    try {
      await interventionsService.assignerTechnicien(assignModal.id, parseInt(assignTechId));
      swal.saved("Technicien assigné");
      setAssignModal(null);
      setAssignTechId("");
      load();
    } catch { swal.serverError(); }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.55rem 0.75rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };

  const TYPE_OPTIONS = [
    "Installation", "Maintenance", "Installation Vidéo surveillance filaire",
    "Installation Vidéo surveillance sans-fil", "Installation Téléphonique",
    "Installation Sécurité Incendie", "Réseau informatique", "Entretien parc",
    "Installation logiciel", "MAJ version logiciel", "Dépannage",
    "Centrale téléphonique", "Formation initiale", "Autres",
  ];

  return (
    <div style={{ fontFamily: FONTS.body }}>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <div className="int-header">
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontSize: "1.4rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>
            🔧 Interventions
          </h1>
          <p style={{ fontSize: "0.82rem", color: theme.textMuted, marginTop: 3 }}>
            Gestion et suivi des interventions terrain
          </p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.6rem 1.1rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap" }}>
            + Nouvelle intervention
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      {dashboard && (
        <div className="int-stats">
          <StatCard label="Total"        value={dashboard.total}       color={PALETTE.primary} icon="📋" theme={theme} onClick={() => { setStatutF(""); setPage(1); }} />
          <StatCard label="Planifiées"   value={dashboard.planifiees}  color="#3b82f6"         icon="📅" theme={theme} onClick={() => { setStatutF("planifiee"); setPage(1); }} />
          <StatCard label="En cours"     value={dashboard.en_cours}    color="#f59e0b"         icon="⚡" theme={theme} onClick={() => { setStatutF("en_cours");  setPage(1); }} />
          <StatCard label="Terminées"    value={dashboard.terminees}   color="#10b981"         icon="✅" theme={theme} onClick={() => { setStatutF("terminee");  setPage(1); }} />
          <StatCard label="Urgentes"     value={dashboard.urgentes}    color="#ef4444"         icon="🚨" theme={theme} onClick={() => { setPrioriteF("urgente"); setPage(1); }} />
          <StatCard label="Aujourd'hui"  value={dashboard.aujourd_hui} color="#8b5cf6"         icon="🗓" theme={theme} onClick={() => { setDateF("today");       setPage(1); }} />
        </div>
      )}

      {/* ── Filtres ── */}
      <div className="int-filters">
        <div className="int-search">
          <span style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted, pointerEvents: "none" }}>
            <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Client, description…"
            style={{ ...inp, paddingLeft: "2.2rem" }} />
        </div>

        <select className="int-select" value={statutF} onChange={e => setStatutF(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
          <option value="">Tous statuts</option>
          {Object.entries(STATUT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <select className="int-select" value={prioriteF} onChange={e => setPrioriteF(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
          <option value="">Toutes priorités</option>
          {Object.entries(PRIORITE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <select className="int-select" value={typeF} onChange={e => setTypeF(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
          <option value="">Tous types</option>
          {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select className="int-select" value={dateF} onChange={e => setDateF(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
          <option value="">Toute période</option>
          <option value="today">Aujourd'hui</option>
          <option value="week">Cette semaine</option>
          <option value="month">Ce mois</option>
        </select>

        <button className="int-reset"
          onClick={() => { setSearch(""); setStatutF(""); setPrioriteF(""); setTypeF(""); setDateF(""); }}
          style={{ padding: "0.55rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap" }}>
          ✕ Reset
        </button>

        <span className="int-count" style={{ color: theme.textMuted }}>{total} intervention{total > 1 ? "s" : ""}</span>
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <div style={{ width: 34, height: 34, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "int-spin 0.8s linear infinite" }} />
        </div>
      ) : interventions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🔧</div>
          <div style={{ fontWeight: 600, color: theme.textPrimary, marginBottom: "0.4rem" }}>
            {search || statutF || prioriteF || typeF ? "Aucun résultat" : "Aucune intervention"}
          </div>
          <div style={{ fontSize: "0.875rem", color: theme.textMuted, marginBottom: "1.25rem" }}>
            {search || statutF || prioriteF || typeF ? "Modifiez vos filtres" : "Créez votre première intervention"}
          </div>
          {!search && !statutF && !prioriteF && !typeF && canCreate && (
            <button onClick={() => setShowForm(true)}
              style={{ padding: "0.65rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
              + Créer une intervention
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── Tableau desktop ── */}
          <div className="int-table-wrap" style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {["Date prévue", "Client", "Responsable", "Technicien", "Type", "Priorité", "Statut", "Actions"].map(h => (
                      <th key={h} style={{ padding: "0.7rem 0.85rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {interventions.map((inv, i) => (
                    <tr key={inv.id}
                      style={{ borderBottom: i < interventions.length - 1 ? `1px solid ${theme.border}` : "none", transition: "background 0.12s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "0.8rem 0.85rem", whiteSpace: "nowrap" }}>
                        <button onClick={() => { setSelected(inv); setShowDetail(true); }}
                          style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: PALETTE.primary, fontSize: "0.875rem", fontFamily: FONTS.body, padding: 0, textAlign: "left" }}>
                          {new Date(inv.date_prevue).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                        </button>
                        <div style={{ fontSize: "0.72rem", color: theme.textMuted }}>
                          {new Date(inv.date_prevue).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td style={{ padding: "0.8rem 0.85rem" }}>
                        <div style={{ fontWeight: 500, color: theme.textPrimary, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {inv.client_nom ?? inv.client_libre_nom ?? "—"}
                        </div>
                        {inv.description && (
                          <div style={{ fontSize: "0.72rem", color: theme.textMuted, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {inv.description.slice(0, 50)}{inv.description.length > 50 ? "…" : ""}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "0.8rem 0.85rem", color: theme.textSecondary, whiteSpace: "nowrap" }}>
                        {inv.responsable_nom || <span style={{ color: theme.textMuted, fontStyle: "italic" }}>—</span>}
                      </td>
                      <td style={{ padding: "0.8rem 0.85rem", color: theme.textSecondary, whiteSpace: "nowrap" }}>
                        {inv.technicien_nom ?? <span style={{ color: theme.textMuted, fontStyle: "italic" }}>Non assigné</span>}
                      </td>
                      <td style={{ padding: "0.8rem 0.85rem", color: theme.textSecondary, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.82rem" }}>
                        {inv.type_intervention ?? "—"}
                      </td>
                      <td style={{ padding: "0.8rem 0.85rem" }}><PrioriteBadge priorite={inv.priorite} /></td>
                      <td style={{ padding: "0.8rem 0.85rem" }}><StatutBadge statut={inv.statut} /></td>
                      <td style={{ padding: "0.8rem 0.85rem" }}>
                        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                          <button onClick={() => { setSelected(inv); setShowDetail(true); }} title="Voir"
                            style={{ width: 28, height: 28, borderRadius: RADIUS.md, border: `1px solid ${PALETTE.primary}33`, background: "transparent", color: PALETTE.primary, cursor: "pointer", fontSize: "0.78rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={e => (e.currentTarget.style.background = PALETTE.primary + "18")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >👁</button>
                          {/* RT : assigner technicien */}
                          {(isRT || isAdmin) && inv.statut !== "terminee" && (
                            <button onClick={() => { setAssignModal(inv); setAssignTechId(inv.technicien?.toString() ?? ""); }} title="Assigner technicien"
                              style={{ width: 28, height: 28, borderRadius: RADIUS.md, border: "1px solid rgba(139,92,246,0.33)", background: "transparent", color: "#8b5cf6", cursor: "pointer", fontSize: "0.78rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "rgba(139,92,246,0.1)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >👤</button>
                          )}
                          {(isCommercial || isAdmin) && inv.statut !== "terminee" && (
                            <button onClick={() => { setEditing(inv); setShowForm(true); }} title="Modifier"
                              style={{ width: 28, height: 28, borderRadius: RADIUS.md, border: "1px solid rgba(59,130,246,0.33)", background: "transparent", color: "#3b82f6", cursor: "pointer", fontSize: "0.78rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "rgba(59,130,246,0.1)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >✏️</button>
                          )}
                          {inv.statut === "terminee" && (
                            <button onClick={() => interventionsService.downloadPdf(inv.id, inv.client_nom ?? inv.client_libre_nom)} title="PDF"
                              style={{ width: 28, height: 28, borderRadius: RADIUS.md, border: "1px solid rgba(16,185,129,0.33)", background: "transparent", color: "#10b981", cursor: "pointer", fontSize: "0.78rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "rgba(16,185,129,0.1)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >📄</button>
                          )}
                          {canDelete && (
                            <button onClick={() => handleDelete(inv)} title="Supprimer"
                              style={{ width: 28, height: 28, borderRadius: RADIUS.md, border: "1px solid rgba(239,68,68,0.33)", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "0.78rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >🗑</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Cartes mobiles ── */}
          <div className="int-cards-wrap">
            {interventions.map(inv => (
              <div key={inv.id} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
                {/* Haut */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.65rem 1rem", borderBottom: `1px solid ${theme.border}`, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    <StatutBadge statut={inv.statut} />
                    <PrioriteBadge priorite={inv.priorite} />
                  </div>
                  <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>
                    {new Date(inv.date_prevue).toLocaleDateString("fr-FR")}
                  </span>
                </div>

                {/* Corps */}
                <div style={{ padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.4rem", cursor: "pointer" }}
                  onClick={() => { setSelected(inv); setShowDetail(true); }}>
                  <div style={{ fontWeight: 600, color: theme.textPrimary, fontSize: "0.95rem" }}>
                    {inv.client_nom ?? inv.client_libre_nom ?? "Client inconnu"}
                  </div>
                  {inv.description && (
                    <div style={{ fontSize: "0.82rem", color: theme.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {inv.description.slice(0, 80)}{inv.description.length > 80 ? "…" : ""}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.78rem", color: theme.textMuted }}>
                    {inv.responsable_nom && <span>🧑‍💼 RT: {inv.responsable_nom}</span>}
                    {inv.technicien_nom  && <span>👤 {inv.technicien_nom}</span>}
                    {inv.type_intervention && <span>🔧 {inv.type_intervention}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", borderTop: `1px solid ${theme.border}` }}>
                  {[
                    { icon: "👁",  label: "Voir",     color: PALETTE.primary, action: () => { setSelected(inv); setShowDetail(true); } },
                    ...((isRT || isAdmin) && inv.statut !== "terminee" ? [
                      { icon: "👤", label: "Assigner", color: "#8b5cf6", action: () => { setAssignModal(inv); setAssignTechId(inv.technicien?.toString() ?? ""); } },
                    ] : []),
                    ...((isCommercial || isAdmin) && inv.statut !== "terminee" ? [
                      { icon: "✏️", label: "Modifier", color: "#3b82f6", action: () => { setEditing(inv); setShowForm(true); } },
                    ] : []),
                    ...(inv.statut === "terminee" ? [
                      { icon: "📄", label: "PDF",      color: "#10b981", action: () => interventionsService.downloadPdf(inv.id, inv.client_nom ?? inv.client_libre_nom) },
                    ] : []),
                    ...(canDelete ? [
                      { icon: "🗑",  label: "Supprimer", color: "#ef4444", action: () => handleDelete(inv) },
                    ] : []),
                  ].map((btn, bi, arr) => (
                    <button key={btn.icon} onClick={btn.action}
                      style={{ flex: 1, padding: "0.6rem 0.25rem", border: "none", borderRight: bi < arr.length - 1 ? `1px solid ${theme.border}` : "none", background: "transparent", color: btn.color, fontSize: "0.72rem", cursor: "pointer", fontFamily: FONTS.body, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" }}
                      onMouseEnter={e => (e.currentTarget.style.background = btn.color + "12")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ fontSize: "1rem" }}>{btn.icon}</span>
                      <span>{btn.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", marginTop: "0.75rem", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px" }}>
          <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>{page}/{totalPages} — {total} résultat{total > 1 ? "s" : ""}</span>
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

      {/* ── Modals ── */}
      {showForm && (
        <InterventionFormModal
          dark={dark} theme={theme}
          intervention={editing}
          technicians={technicians}
          responsables={responsables}
          userRole={userRole}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}

      {/* Assign technicien modal (RT) */}
      {assignModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: 16, padding: "1.5rem", width: "100%", maxWidth: 420, fontFamily: FONTS.body }}>
            <h3 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: theme.textPrimary, marginBottom: "0.25rem" }}>Assigner un technicien</h3>
            <p style={{ fontSize: "0.8rem", color: theme.textMuted, marginBottom: "1rem" }}>
              Intervention #{assignModal.id} — {assignModal.client_nom ?? assignModal.client_libre_nom ?? "Client inconnu"}
            </p>
            <select value={assignTechId} onChange={e => setAssignTechId(e.target.value)}
              style={{ width: "100%", padding: "0.6rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, outline: "none", marginBottom: "1rem" }}>
              <option value="">— Sélectionner un technicien —</option>
              {technicians.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
            </select>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button onClick={() => { setAssignModal(null); setAssignTechId(""); }}
                style={{ padding: "0.6rem 1.1rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
                Annuler
              </button>
              <button onClick={handleAssignTechnicien} disabled={!assignTechId}
                style={{ padding: "0.6rem 1.25rem", borderRadius: RADIUS.md, border: "none", background: !assignTechId ? `${PALETTE.primary}55` : `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: assignTechId ? "pointer" : "not-allowed", fontFamily: FONTS.body }}>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
      {showDetail && selected && (
        <InterventionDetailModal
          dark={dark} theme={theme}
          intervention={selected}
          onClose={() => { setShowDetail(false); setSelected(null); }}
          onEdit={() => { setShowDetail(false); setEditing(selected); setShowForm(true); }}
          onRefresh={load}
        />
      )}
    </div>
  );
}