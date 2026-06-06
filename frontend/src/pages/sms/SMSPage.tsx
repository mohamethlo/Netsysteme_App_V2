import React, { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import { smsService, type SMSHistoryEntry, type SMSStats } from "../../services/smsService";
import { useSwal } from "../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../theme";
import QuickSendModal from "./components/QuickSendPanel";
import TemplatesModal from "./components/TemplatesPanel";
import NoteDeServicePanel from "./components/NoteDeServicePanel";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

const CSS = `
  @keyframes sms-spin { to { transform: rotate(360deg); } }

  .sms-header {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  @media (min-width: 480px) {
    .sms-header { flex-direction: row; justify-content: space-between; align-items: flex-start; }
  }

  .sms-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

  .sms-kpis {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.65rem;
    margin-bottom: 1.5rem;
  }
  @media (min-width: 480px) { .sms-kpis { grid-template-columns: repeat(3, 1fr); } }
  @media (min-width: 768px) { .sms-kpis { grid-template-columns: repeat(5, 1fr); gap: 0.85rem; } }

  .sms-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
    align-items: center;
  }
  .sms-filter-search { position: relative; flex: 1 1 160px; min-width: 140px; }
  .sms-filter-select { flex: 1 1 120px; min-width: 110px; }
  .sms-filter-reset  { flex: 0 0 auto; }
  .sms-count         { flex: 0 0 auto; margin-left: auto; font-size: 0.78rem; white-space: nowrap; }

  .sms-table-wrap { display: none; }
  .sms-cards-wrap { display: flex; flex-direction: column; gap: 0.6rem; }
  @media (min-width: 700px) {
    .sms-table-wrap { display: block; }
    .sms-cards-wrap { display: none; }
  }
`;

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    success: { bg: "rgba(16,185,129,0.12)", color: "#10b981", label: "✅ Réussi"      },
    failed:  { bg: "rgba(239,68,68,0.1)",   color: "#ef4444", label: "❌ Échoué"     },
    pending: { bg: "rgba(245,158,11,0.1)",   color: "#f59e0b", label: "⏳ En attente" },
  };
  const c = cfg[status] ?? cfg.pending;
  return (
    <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

function DomainBadge({ domain }: { domain: string }) {
  const isSse = domain === "SSE";
  return (
    <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: RADIUS.full, background: isSse ? "rgba(16,185,129,0.12)" : "rgba(6,182,212,0.1)", color: isSse ? "#10b981" : PALETTE.primary }}>
      {isSse ? "🟢" : "🔷"} {domain}
    </span>
  );
}

export default function SMSPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const swal = useSwal();

  const [stats,    setStats]    = useState<SMSStats | null>(null);
  const [history,  setHistory]  = useState<SMSHistoryEntry[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [statusF,  setStatusF]  = useState("");
  const [domainF,  setDomainF]  = useState("");
  const [periodF,  setPeriodF]  = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selected, setSelected] = useState<SMSHistoryEntry | null>(null);

  const [showQuick,     setShowQuick]     = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showNoteRH,    setShowNoteRH]    = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (search)  params.search        = search;
      if (statusF) params.status        = statusF;
      if (domainF) params.sender_domain = domainF;
      if (periodF) params.period        = periodF;

      const [paginated, s] = await Promise.all([
        smsService.getHistory(params),
        smsService.getStats(),
      ]);

      // getHistory retourne PaginatedSMS { count, results: [...] }
      setHistory(paginated.results ?? []);
      setTotal(paginated.count ?? 0);
      setStats(s);
    } catch (err) {
      console.error("Erreur chargement SMS:", err);
      swal.serverError();
    } finally {
      setLoading(false);
    }
  }, [search, statusF, domainF, periodF]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!await swal.confirm({ title: "Supprimer ce SMS ?", icon: "warning", confirmText: "Supprimer" })) return;
    try { await smsService.delete(id); load(); }
    catch { swal.serverError(); }
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.55rem 0.75rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };

  return (
    <div style={{ fontFamily: FONTS.body }}>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <div className="sms-header">
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontSize: "1.4rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>
            📱 Messagerie SMS
          </h1>
          <p style={{ fontSize: "0.82rem", color: theme.textMuted, marginTop: 3 }}>
            Envoi via Orange API (NETSYSTEME & SSE)
          </p>
        </div>
        <div className="sms-actions">
          <button onClick={() => setShowNoteRH(true)}
            style={{ padding: "0.58rem 1rem", borderRadius: RADIUS.md, border: "none", background: "linear-gradient(135deg,#7c3aed,#5b21b6)", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap" }}>
            📢 Note de service
          </button>
          <button onClick={() => setShowQuick(true)}
            style={{ padding: "0.58rem 1rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
            ⚡ Envoi rapide
          </button>
          <button onClick={() => setShowTemplates(true)}
            style={{ padding: "0.58rem 1rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.82rem", cursor: "pointer", fontFamily: FONTS.body }}>
            📋 Templates
          </button>
          <button onClick={() => smsService.exportCsv({ status: statusF, period: periodF, search })}
            style={{ padding: "0.58rem 1rem", borderRadius: RADIUS.md, border: "1px solid rgba(16,185,129,0.4)", background: "transparent", color: "#10b981", fontSize: "0.82rem", cursor: "pointer", fontFamily: FONTS.body }}>
            ⬇ CSV
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      {stats && (
        <div className="sms-kpis">
          {[
            { label: "Total",       value: stats.total,              color: PALETTE.primary, icon: "📊" },
            { label: "Réussis",     value: stats.success,            color: "#10b981",       icon: "✅" },
            { label: "Échecs",      value: stats.failed,             color: "#ef4444",       icon: "❌" },
            { label: "Aujourd'hui", value: stats.today,              color: "#3b82f6",       icon: "📅" },
            { label: "Taux succès", value: `${stats.success_rate}%`, color: "#8b5cf6",       icon: "⭐" },
          ].map(s => (
            <div key={s.label} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: "10px", background: s.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>
                {s.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.65rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.label}
                </div>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1 }}>
                  {typeof s.value === "number" ? fmt(s.value) : s.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filtres ── */}
      <div className="sms-filters">
        <div className="sms-filter-search">
          <span style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted, pointerEvents: "none" }}>
            🔍
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
            style={{ ...inp, paddingLeft: "2.2rem" }} />
        </div>

        <select className="sms-filter-select" value={statusF} onChange={e => setStatusF(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
          <option value="">Tous statuts</option>
          <option value="success">✅ Réussi</option>
          <option value="failed">❌ Échoué</option>
          <option value="pending">⏳ En attente</option>
        </select>

        <select className="sms-filter-select" value={domainF} onChange={e => setDomainF(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
          <option value="">Tous domaines</option>
          <option value="NETSYSTEME">NETSYSTEME</option>
          <option value="SSE">SSE</option>
        </select>

        <select className="sms-filter-select" value={periodF} onChange={e => setPeriodF(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
          <option value="">Toute période</option>
          <option value="today">Aujourd'hui</option>
          <option value="week">Cette semaine</option>
          <option value="month">Ce mois</option>
        </select>

        <button className="sms-filter-reset"
          onClick={() => { setSearch(""); setStatusF(""); setDomainF(""); setPeriodF(""); }}
          style={{ padding: "0.55rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap" }}>
          ✕ Reset
        </button>

        <span className="sms-count" style={{ color: theme.textMuted }}>
          {total} SMS
        </span>
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "sms-spin 0.8s linear infinite" }} />
        </div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", color: theme.textMuted }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📭</div>
          <div style={{ marginBottom: "1rem" }}>Aucun SMS dans l'historique</div>
          <button onClick={() => setShowQuick(true)}
            style={{ padding: "0.6rem 1.25rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
            ⚡ Envoyer le premier SMS
          </button>
        </div>
      ) : (
        <>
          {/* ── Tableau desktop (≥ 700px) ── */}
          <div className="sms-table-wrap" style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {["Date & Heure", "Destinataire", "Numéro", "Domaine", "Message", "Statut", ""].map(h => (
                      <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(s => (
                    // ── React.Fragment avec key pour éviter le warning ──────
                    <React.Fragment key={s.id}>
                      <tr
                        style={{ borderBottom: `1px solid ${theme.border}`, cursor: "pointer", transition: "background 0.12s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                      >
                        <td style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 600, color: theme.textPrimary, fontSize: "0.82rem" }}>
                            {s.sent_at_str ?? new Date(s.sent_at).toLocaleDateString("fr-FR")}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: theme.textMuted }}>
                            {new Date(s.sent_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td style={{ padding: "0.85rem 1rem", color: theme.textSecondary }}>
                          {s.recipient_name ?? "—"}
                        </td>
                        <td style={{ padding: "0.85rem 1rem" }}>
                          <a href={`tel:${s.phone}`} onClick={e => e.stopPropagation()}
                            style={{ color: PALETTE.primary, textDecoration: "none", fontSize: "0.82rem", fontWeight: 500 }}>
                            📞 {s.phone}
                          </a>
                        </td>
                        <td style={{ padding: "0.85rem 1rem" }}>
                          <DomainBadge domain={s.sender_domain} />
                        </td>
                        <td style={{ padding: "0.85rem 1rem", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: theme.textSecondary, fontSize: "0.8rem" }}>
                          {s.message.slice(0, 80)}{s.message.length > 80 ? "…" : ""}
                        </td>
                        <td style={{ padding: "0.85rem 1rem" }}>
                          <StatusBadge status={s.status} />
                        </td>
                        <td style={{ padding: "0.85rem 1rem" }}>
                          <button onClick={e => handleDelete(s.id, e)}
                            style={{ width: 26, height: 26, borderRadius: RADIUS.md, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "0.72rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >🗑</button>
                        </td>
                      </tr>

                      {/* Ligne expandée */}
                      {expanded === s.id && (
                        <tr style={{ borderBottom: `1px solid ${theme.border}`, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)" }}>
                          <td colSpan={7} style={{ padding: "1rem 1.25rem" }}>
                            <div style={{ fontSize: "0.82rem", color: theme.textSecondary, lineHeight: 1.7 }}>
                              <strong style={{ color: theme.textPrimary }}>Message complet :</strong>
                              <div style={{ marginTop: "0.35rem", padding: "0.6rem 0.85rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}`, whiteSpace: "pre-wrap" }}>
                                {s.message}
                              </div>
                              {s.error_message && (
                                <div style={{ marginTop: "0.5rem", color: "#ef4444" }}>⚠️ {s.error_message}</div>
                              )}
                              <div style={{ marginTop: "0.5rem", color: theme.textMuted, fontSize: "0.72rem" }}>
                                Par : {s.sent_by_name} · Fournisseur : {s.provider}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Cartes mobiles (< 700px) ── */}
          <div className="sms-cards-wrap">
            {history.map(s => (
              <div key={s.id} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
                {/* Haut */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.65rem 1rem", borderBottom: `1px solid ${theme.border}`, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                    <DomainBadge domain={s.sender_domain} />
                    <StatusBadge status={s.status} />
                  </div>
                  <button onClick={e => handleDelete(s.id, e)}
                    style={{ width: 26, height: 26, borderRadius: RADIUS.md, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "0.72rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    🗑
                  </button>
                </div>

                {/* Corps */}
                <div style={{ padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.4rem", cursor: "pointer" }}
                  onClick={() => setSelected(s)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.9rem", fontWeight: 600, color: theme.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.recipient_name ?? "—"}
                    </span>
                    <span style={{ fontSize: "0.72rem", color: theme.textMuted, flexShrink: 0 }}>
                      {s.sent_at_str ?? new Date(s.sent_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <a href={`tel:${s.phone}`} onClick={e => e.stopPropagation()}
                    style={{ fontSize: "0.82rem", color: PALETTE.primary, textDecoration: "none", fontWeight: 500 }}>
                    📞 {s.phone}
                  </a>
                  <div style={{ fontSize: "0.82rem", color: theme.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.message.slice(0, 90)}{s.message.length > 90 ? "…" : ""}
                  </div>
                </div>

                {/* Voir détail */}
                <div style={{ borderTop: `1px solid ${theme.border}` }}>
                  <button onClick={() => setSelected(s)}
                    style={{ width: "100%", padding: "0.5rem", border: "none", background: "transparent", color: PALETTE.primary, fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body }}>
                    Voir le message complet →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Modal détail SMS (bottom-sheet) ── */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px 18px 0 0", width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: dark ? "0 -8px 40px rgba(0,0,0,0.6)" : "0 -4px 24px rgba(0,0,0,0.12)", fontFamily: FONTS.body }}>
            <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: theme.textPrimary }}>
                📨 Détail SMS #{selected.id}
              </h2>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
            </div>
            <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              {([
                ["Date",         selected.sent_at_str ?? new Date(selected.sent_at).toLocaleString("fr-FR")],
                ["Destinataire", selected.recipient_name ?? "—"],
                ["Numéro",       selected.phone],
                ["Domaine",      selected.sender_domain],
                ["Statut",       selected.status],
                ["Envoyé par",   selected.sent_by_name ?? "—"],
                ["Fournisseur",  selected.provider ?? "—"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.42rem 0", borderBottom: `1px solid ${theme.border}` }}>
                  <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>{k}</span>
                  <span style={{ fontSize: "0.85rem", color: theme.textPrimary, fontWeight: 500, textAlign: "right", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {v}
                  </span>
                </div>
              ))}

              <div style={{ marginTop: "0.5rem" }}>
                <div style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.4rem" }}>
                  Message
                </div>
                <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}`, fontSize: "0.875rem", color: theme.textPrimary, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {selected.message}
                </div>
              </div>

              {selected.error_message && (
                <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "0.82rem" }}>
                  ⚠️ {selected.error_message}
                </div>
              )}

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  onClick={async () => {
                    if (!await swal.confirm({ title: "Supprimer ce SMS ?", icon: "warning", confirmText: "Supprimer" })) return;
                    try { await smsService.delete(selected.id); setSelected(null); load(); }
                    catch { swal.serverError(); }
                  }}
                  style={{ flex: 1, padding: "0.65rem", borderRadius: RADIUS.md, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#ef4444", fontSize: "0.82rem", cursor: "pointer", fontFamily: FONTS.body }}>
                  🗑 Supprimer
                </button>
                <button onClick={() => setSelected(null)}
                  style={{ flex: 2, padding: "0.7rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNoteRH && (
        <NoteDeServicePanel dark={dark} theme={theme}
          onClose={() => setShowNoteRH(false)}
          onSent={() => { setShowNoteRH(false); load(); }} />
      )}
      {showQuick && (
        <QuickSendModal dark={dark} theme={theme}
          onClose={() => setShowQuick(false)}
          onSent={() => { setShowQuick(false); load(); }} />
      )}
      {showTemplates && (
        <TemplatesModal dark={dark} theme={theme}
          onClose={() => setShowTemplates(false)} />
      )}
    </div>
  );
}