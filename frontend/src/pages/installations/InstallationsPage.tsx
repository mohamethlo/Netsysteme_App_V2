// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/installations/InstallationsPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import {
  installationsService, type Installation,
  type InstallationDashboard, type FormData,
} from "../../services/installationService";
import { pdfService } from "../../services/pdfService";
import { useSwal } from "../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../theme";
import InstallationFormModal from "./components/InstallationFormModal";
import { VersementModal }    from "./components/VersementModal";

// ── Constantes ────────────────────────────────────────────────────────────────
const STATUT_CFG = {
  en_attente: { label: "En attente",  bg: "rgba(245,158,11,0.12)", text: "#f59e0b" },
  en_cours:   { label: "En cours",    bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  termine:    { label: "Terminé",     bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  annule:     { label: "Annulé",      bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
} as const;

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

const CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Header : colonne sur mobile, ligne sur ≥480px */
  .inst-header {
    display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.75rem;
  }
  @media (min-width: 480px) {
    .inst-header { flex-direction: row; justify-content: space-between; align-items: flex-start; }
  }
  .inst-header-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }

  /* Filtres date : empilés sur mobile */
  .inst-date-range {
    display: flex; flex-direction: column; gap: 0.4rem; flex-wrap: wrap;
  }
  @media (min-width: 540px) {
    .inst-date-range { flex-direction: row; align-items: center; }
  }

  /* Tableau masqué mobile, cartes masquées desktop */
  .inst-table-wrap { display: none; }
  .inst-cards-wrap { display: flex; flex-direction: column; gap: 0; }
  @media (min-width: 700px) {
    .inst-table-wrap { display: block; }
    .inst-cards-wrap { display: none; }
  }
`;

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon, sub, onClick, theme }: {
  label: string; value: string | number; color: string;
  icon: string; sub?: string; onClick?: () => void;
  theme: LayoutContext["theme"];
}) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov && onClick ? theme.cardBgHover : theme.cardBg, border: `1px solid ${hov && onClick ? color + "44" : theme.border}`, borderRadius: "14px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.85rem", cursor: onClick ? "pointer" : "default", transition: "all 0.18s" }}>
      <div style={{ width: 46, height: 46, borderRadius: "12px", background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: "0.72rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: "1.45rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function StatusBadge({ statut }: { statut: string }) {
  const cfg = STATUT_CFG[statut as keyof typeof STATUT_CFG] ?? STATUT_CFG.en_attente;
  return <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: cfg.bg, color: cfg.text, whiteSpace: "nowrap" }}>{cfg.label}</span>;
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function InstallationsPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const swal     = useSwal();
  const navigate = useNavigate();

  const [installations, setInstallations] = useState<Installation[]>([]);
  const [dashboard,     setDashboard]     = useState<InstallationDashboard | null>(null);
  const [formData,      setFormData]      = useState<FormData | null>(null);
  const [total,         setTotal]         = useState(0);
  const [loading,       setLoading]       = useState(true);

  const [search,       setSearch]       = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [dateDebut,    setDateDebut]    = useState("");
  const [dateFin,      setDateFin]      = useState("");
  const [page,         setPage]         = useState(1);
  const PAGE_SIZE = 15;

  const [showForm,      setShowForm]      = useState(false);
  const [showVersement, setShowVersement] = useState(false);
  const [editing,       setEditing]       = useState<Installation | null>(null);
  const [versementInst, setVersementInst] = useState<Installation | null>(null);

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
      if (search)       params.search = search;
      if (statutFilter) params.statut = statutFilter;

      const [listRes, dashRes, fdRes] = await Promise.all([
        installationsService.getAll(params),
        installationsService.getDashboard(),
        formData ? Promise.resolve(formData) : installationsService.getFormData(),
      ]);

      setInstallations(listRes.results);
      setTotal(listRes.count);
      setDashboard(dashRes);
      if (!formData) setFormData(fdRes as FormData);
    } catch {
      swal.serverError();
    } finally {
      setLoading(false);
    }
  }, [page, search, statutFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statutFilter]);

  // Filtrage date côté client
  const filtered = installations.filter(inst => {
    if (!inst.date_installation) return true;
    if (dateDebut && inst.date_installation < dateDebut) return false;
    if (dateFin   && inst.date_installation > dateFin)   return false;
    return true;
  });

  // Totaux filtrés
  const sommeTotal   = filtered.reduce((s, i) => s + i.montant_total,   0);
  const sommeRestant = filtered.reduce((s, i) => s + i.montant_restant, 0);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleDelete = async (inst: Installation) => {
    if (!await swal.confirmDelete(inst.client_name)) return;
    try { await installationsService.delete(inst.id); swal.deleted("L'installation"); load(); }
    catch { swal.serverError(); }
  };

  const handleGenerateContract = async (inst: Installation) => {
    // Ouvrir l'onglet AVANT tout await (évite le popup blocker)
    const pdfTab  = window.open("", "_blank");
    const closeLoader = swal.loading("Génération du contrat PDF…");
    try {
      await installationsService.generateContract(inst.id);
      closeLoader();
      swal.success("Contrat PDF généré avec succès !");
      load();
      const clientName = inst.client_name || undefined;
      if (pdfTab) {
        pdfService.contract.viewInTab(pdfTab, inst.id, clientName);
      }
    } catch (e: any) {
      closeLoader();
      pdfTab?.close();
      swal.error("Erreur", e?.response?.data?.detail ?? "La génération a échoué.");
    }
  };

  const handleSaved = async () => {
    setShowForm(false);     setEditing(null);
    setShowVersement(false); setVersementInst(null);
    // Recharger formData aussi
    try { setFormData(await installationsService.getFormData()); } catch {}
    load();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ fontFamily: FONTS.body }}>
      <style>{CSS}</style>
      {/* ── Header ── */}
      <div className="inst-header">
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontSize: "1.5rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>
            Gestion des installations
          </h1>
          <p style={{ fontSize: "0.85rem", color: theme.textMuted, marginTop: 3 }}>
            Caméras de surveillance SSE — suivi clients et paiements
          </p>
        </div>
        <div className="inst-header-actions">
          <button onClick={() => navigate("/dashboard/payment-reminders")}
            style={{ display: "flex", alignItems: "center", gap: "0.45rem", padding: "0.62rem 1.1rem", borderRadius: RADIUS.md, border: `1px solid #f59e0b55`, background: "rgba(245,158,11,0.08)", color: "#f59e0b", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, transition: "all 0.15s", whiteSpace: "nowrap" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,158,11,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(245,158,11,0.08)")}>
            🔔 Rappels
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.62rem 1.25rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, boxShadow: `0 0 20px ${PALETTE.primary}22`, whiteSpace: "nowrap" }}>
            + Nouvelle
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      {dashboard && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))", gap: "0.85rem", marginBottom: "1.75rem" }}>
          <StatCard label="Total"          value={dashboard.total_installations}                    color={PALETTE.primary} icon="🔧" theme={theme} />
          <StatCard label="En attente"     value={dashboard.en_attente}                             color="#f59e0b"         icon="⏳" theme={theme} onClick={() => setStatutFilter("en_attente")} />
          <StatCard label="En cours"       value={dashboard.en_cours}                               color="#3b82f6"         icon="🔄" theme={theme} onClick={() => setStatutFilter("en_cours")}   />
          <StatCard label="Terminées"      value={dashboard.terminees}                              color="#10b981"         icon="✅" theme={theme} onClick={() => setStatutFilter("termine")}    />
          <StatCard label="Total CA"       value={`${fmt(dashboard.somme_total)} F`}                color={PALETTE.warning} icon="💰" sub="FCFA" theme={theme} />
          <StatCard label="Reliquats"      value={`${fmt(dashboard.somme_restant)} F`}              color={PALETTE.danger}  icon="⚠️" sub="Restant" theme={theme} />
        </div>
      )}

      {/* ── Filtres ── */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
          <svg width={15} height={15} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted, pointerEvents: "none" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, prénom, téléphone…"
            style={{ width: "100%", padding: "0.58rem 0.85rem 0.58rem 2.4rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", outline: "none", fontFamily: FONTS.body }} />
        </div>

        {/* Statut */}
        <select value={statutFilter} onChange={e => setStatutFilter(e.target.value)}
          style={{ padding: "0.58rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, cursor: "pointer" }}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        {/* Dates */}
        <div className="inst-date-range">
          <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>Du</span>
          <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
            style={{ padding: "0.52rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.85rem", fontFamily: FONTS.body }} />
          <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>au</span>
          <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
            style={{ padding: "0.52rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.85rem", fontFamily: FONTS.body }} />
          {(dateDebut || dateFin) && (
            <button onClick={() => { setDateDebut(""); setDateFin(""); }}
              style={{ padding: "0.4rem 0.65rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body }}>
              ✕ Reset
            </button>
          )}
        </div>

        <span style={{ fontSize: "0.8rem", color: theme.textMuted, marginLeft: "auto" }}>
          {filtered.length} installation{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Totaux filtrés ── */}
      {(dateDebut || dateFin) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
          {[
            { l: "Total installations (période)", v: `${fmt(sommeTotal)} F`,   c: PALETTE.primary },
            { l: "Total reliquats (période)",     v: `${fmt(sommeRestant)} F`, c: PALETTE.danger  },
          ].map(r => (
            <div key={r.l} style={{ padding: "0.85rem 1.1rem", borderRadius: RADIUS.md, background: theme.cardBg, border: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.82rem", color: theme.textMuted }}>{r.l}</span>
              <span style={{ fontSize: "1.1rem", fontWeight: 700, fontFamily: FONTS.display, color: r.c }}>{r.v}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <div style={{ width: 34, height: 34, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🔧</div>
            <div style={{ fontWeight: 600, color: theme.textPrimary, marginBottom: "0.4rem" }}>Aucune installation</div>
            <div style={{ fontSize: "0.875rem", color: theme.textMuted, marginBottom: "1.25rem" }}>
              {search || statutFilter || dateDebut || dateFin ? "Modifiez vos filtres" : "Créez votre première installation"}
            </div>
            {!search && !statutFilter && !dateDebut && !dateFin && (
              <button onClick={() => setShowForm(true)}
                style={{ padding: "0.65rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
                + Nouvelle installation
              </button>
            )}
          </div>
        ) : (
          <>
          {/* ── Table (≥700px) ── */}
          <div className="inst-table-wrap" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  {["Date", "Client", "Agent / Techniciens", "Montant total", "Avance", "Restant", "Méthode", "Statut", "Contrat", "Actions"].map(h => (
                    <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.7rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inst, i) => (
                  <tr key={inst.id}
                    style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${theme.border}` : "none", transition: "background 0.12s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Date */}
                    <td style={{ padding: "0.85rem 1rem", color: theme.textMuted, whiteSpace: "nowrap" }}>
                      {inst.date_installation
                        ? new Date(inst.date_installation).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>

                    {/* Client */}
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <div style={{ fontWeight: 600, color: theme.textPrimary }}>{inst.client_name}</div>
                      <div style={{ fontSize: "0.75rem", color: theme.textMuted }}>{inst.telephone}</div>
                    </td>

                    {/* Personnel */}
                    <td style={{ padding: "0.85rem 1rem" }}>
                      {inst.agent_commercial_detail && (
                        <div style={{ display: "inline-block", padding: "2px 8px", borderRadius: RADIUS.full, background: "rgba(6,182,212,0.1)", color: PALETTE.primary, fontSize: "0.72rem", fontWeight: 600, marginBottom: inst.techniciens_detail.length ? 4 : 0 }}>
                          👤 {inst.agent_commercial_detail.full_name}
                        </div>
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                        {inst.techniciens_detail.map(t => (
                          <span key={t.id} style={{ padding: "2px 7px", borderRadius: RADIUS.full, background: "rgba(16,185,129,0.1)", color: "#10b981", fontSize: "0.68rem", fontWeight: 600 }}>🔧 {t.full_name}</span>
                        ))}
                      </div>
                    </td>

                    {/* Montants */}
                    <td style={{ padding: "0.85rem 1rem", fontWeight: 700, color: theme.textPrimary, whiteSpace: "nowrap" }}>{fmt(inst.montant_total)} F</td>
                    <td style={{ padding: "0.85rem 1rem", color: theme.textSecondary, whiteSpace: "nowrap" }}>{fmt(inst.montant_avance)} F</td>
                    <td style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>
                      <span style={{ fontWeight: 600, color: inst.is_paid ? "#10b981" : "#ef4444" }}>{fmt(inst.montant_restant)} F</span>
                    </td>

                    {/* Méthode */}
                    <td style={{ padding: "0.85rem 1rem", color: theme.textMuted, fontSize: "0.8rem" }}>{inst.methode_display || "—"}</td>

                    {/* Statut */}
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <StatusBadge statut={inst.statut} />
                    </td>

                    {/* Contrat */}
                    <td style={{ padding: "0.85rem 1rem" }}>
                      {inst.contrat_url ? (
                        <button onClick={() => pdfService.contract.view(inst.id, inst.client_name)}
                          style={{ fontSize: "0.78rem", color: PALETTE.primary, background: "none", border: "none", cursor: "pointer", fontFamily: FONTS.body, padding: 0, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          📄 Voir
                        </button>
                      ) : (
                        <button onClick={() => handleGenerateContract(inst)}
                          style={{ fontSize: "0.75rem", color: "#8b5cf6", background: "none", border: "none", cursor: "pointer", fontFamily: FONTS.body, padding: 0 }}>
                          ⚡ Générer
                        </button>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        {[
                          { icon: "💰", color: "#10b981", title: "Versement", action: () => { setVersementInst(inst); setShowVersement(true); }, disabled: inst.is_paid },
                          { icon: "✏️", color: "#3b82f6", title: "Modifier",  action: () => { setEditing(inst);    setShowForm(true);       } },
                          { icon: "🗑",  color: "#ef4444", title: "Supprimer", action: () => handleDelete(inst) },
                        ].map(btn => (
                          <button key={btn.icon} onClick={btn.action} title={btn.title}
                            disabled={btn.disabled}
                            style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid ${btn.color}33`, background: "transparent", color: btn.color, cursor: btn.disabled ? "not-allowed" : "pointer", fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center", opacity: btn.disabled ? 0.35 : 1, transition: "background 0.15s" }}
                            onMouseEnter={e => { if (!btn.disabled) e.currentTarget.style.background = btn.color + "18"; }}
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
          {/* ── Cartes mobiles (<700px) ── */}
          <div className="inst-cards-wrap">
            {filtered.map((inst, i) => (
              <div key={inst.id} style={{ padding: "0.85rem 1rem", borderBottom: i < filtered.length - 1 ? `1px solid ${theme.border}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.4rem" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: theme.textPrimary, fontSize: "0.875rem" }}>{inst.client_name}</div>
                    <div style={{ fontSize: "0.75rem", color: theme.textMuted }}>{inst.telephone}</div>
                  </div>
                  <StatusBadge statut={inst.statut} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <div style={{ fontSize: "0.78rem", color: theme.textMuted }}>
                    {inst.date_installation ? new Date(inst.date_installation).toLocaleDateString("fr-FR") : "—"}
                  </div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: inst.is_paid ? "#10b981" : "#ef4444" }}>
                    Reste : {fmt(inst.montant_restant)} F
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.3rem" }}>
                  {[
                    { icon: "💰", color: "#10b981", title: "Versement", action: () => { setVersementInst(inst); setShowVersement(true); }, disabled: inst.is_paid },
                    { icon: "✏️", color: "#3b82f6", title: "Modifier",  action: () => { setEditing(inst); setShowForm(true); } },
                    { icon: "🗑",  color: "#ef4444", title: "Supprimer", action: () => handleDelete(inst) },
                  ].map(btn => (
                    <button key={btn.icon} onClick={btn.action} title={btn.title} disabled={btn.disabled}
                      style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid ${btn.color}33`, background: "transparent", color: btn.color, cursor: btn.disabled ? "not-allowed" : "pointer", fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center", opacity: btn.disabled ? 0.35 : 1 }}
                      onMouseEnter={e => { if (!btn.disabled) e.currentTarget.style.background = btn.color + "18"; }}
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
            <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>Page {page} / {totalPages} — {total} résultat{total > 1 ? "s" : ""}</span>
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
      {showForm && formData && (
        <InstallationFormModal dark={dark} theme={theme} installation={editing} formData={formData}
          onClose={() => { setShowForm(false); setEditing(null); }} onSaved={handleSaved} />
      )}
      {showVersement && versementInst && (
        <VersementModal dark={dark} theme={theme} installation={versementInst}
          onClose={() => { setShowVersement(false); setVersementInst(null); }} onSaved={handleSaved} />
      )}

    </div>
  );
}