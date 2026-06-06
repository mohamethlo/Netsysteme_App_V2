// src/pages/assignments/components/ReportPanel.tsx
import { useState, useEffect, useCallback } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { assignmentsService, type DailyReport, type DailyReportEntry } from "../../../services/assignmentsService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props { dark: boolean; theme: LayoutContext["theme"]; }

const today = () => new Date().toISOString().split("T")[0];

const STATUS_CFG = {
  assigned:  { label: "📍 Affecté",    bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  available: { label: "⏳ Disponible", bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
  absent:    { label: "❌ Absent",      bg: "rgba(239,68,68,0.1)",    text: "#ef4444" },
};

export default function ReportPanel({ dark, theme }: Props) {
  const swal = useSwal();
  const [date,    setDate]    = useState(today());
  const [report,  setReport]  = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [showHist, setShowHist] = useState<DailyReportEntry | null>(null);
  const [histData, setHistData] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setReport(await assignmentsService.getDailyReport(date)); }
    catch { swal.serverError(); } finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const openHistory = async (entry: DailyReportEntry) => {
    setShowHist(entry); setHistData(null);
    try { setHistData(await assignmentsService.getHistory(entry.technician.id, date)); }
    catch { setHistData({ error: true }); }
  };

  const filtered = report?.daily_data.filter(d =>
    !search || d.technician.name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const inp: React.CSSProperties = { padding: "0.52rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.82rem", fontFamily: FONTS.body, outline: "none" };

  return (
    <div>
      {/* Sélecteur date */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "flex-end", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", padding: "1rem 1.25rem" }}>
        <div>
          <label style={{ fontSize: "0.7rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", display: "block", marginBottom: 3 }}>Date du rapport</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} max={today()} style={{ ...inp, width: 160 }} />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={{ fontSize: "0.7rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", display: "block", marginBottom: 3 }}>Recherche</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom technicien…" style={{ ...inp, width: "100%" }} />
        </div>
        <button onClick={load} style={{ padding: "0.52rem 1rem", borderRadius: RADIUS.md, border: `1px solid ${PALETTE.primary}44`, background: "transparent", color: PALETTE.primary, fontSize: "0.82rem", cursor: "pointer", fontFamily: FONTS.body }}>
          🔄 Actualiser
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <div style={{ width: 32, height: 32, border: `3px solid rgba(59,130,246,0.2)`, borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : report ? (
        <>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
            {[
              { label: "Techniciens", value: report.total_technicians, icon: "👷", color: "#3b82f6" },
              { label: "Présents",    value: report.present_count,     icon: "✅", color: "#10b981" },
              { label: "Absents",     value: report.absent_count,      icon: "❌", color: "#ef4444" },
              { label: "Taux",        value: `${report.presence_rate}%`,icon: "📊", color: "#8b5cf6" },
              { label: "Total heures",value: `${report.total_hours}h`, icon: "⏱️", color: "#f59e0b" },
              { label: "Moy./tech.",  value: `${report.avg_hours}h`,   icon: "📈", color: "#06b6d4" },
            ].map(k => (
              <div key={k.label} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div style={{ width: 36, height: 36, borderRadius: "9px", background: k.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>{k.icon}</div>
                <div>
                  <div style={{ fontSize: "0.65rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{k.label}</div>
                  <div style={{ fontSize: "1.15rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1.1 }}>{k.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Alerte date future */}
          {report.is_future_date && (
            <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", marginBottom: "1rem", fontSize: "0.85rem" }}>
              ⚠️ Date future — aucune donnée de présence disponible.
            </div>
          )}

          {/* Tableau */}
          <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ padding: "0.85rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 600, color: theme.textPrimary, fontSize: "0.9rem" }}>
                Détail par technicien
                <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: theme.textMuted, fontWeight: 400 }}>(présents en haut)</span>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {["Technicien", "Lieu affecté", "Lieu de pointage", "Statut", "Heures", "Actions"].map(h => (
                      <th key={h} style={{ padding: "0.7rem 1rem", textAlign: "left", fontSize: "0.67rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => {
                    const sc = STATUS_CFG[row.technician.assignment_status] ?? STATUS_CFG.absent;
                    return (
                      <tr key={row.technician.id}
                        style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${theme.border}` : "none", opacity: row.status === "absent" ? 0.6 : 1 }}
                        onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "0.85rem 1rem", fontWeight: 600, color: theme.textPrimary }}>{row.technician.name}</td>
                        <td style={{ padding: "0.85rem 1rem" }}>
                          <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: sc.bg, color: sc.text }}>{sc.label.split(" ").slice(1).join(" ") || row.technician.assigned_location}</span>
                          {row.assignments_count > 0 && (
                            <span style={{ marginLeft: 5, fontSize: "0.68rem", padding: "1px 6px", borderRadius: RADIUS.full, background: "rgba(6,182,212,0.1)", color: "#06b6d4" }}>{row.assignments_count} aff.</span>
                          )}
                        </td>
                        <td style={{ padding: "0.85rem 1rem", fontSize: "0.8rem", color: theme.textSecondary }}>
                          {row.pointage_location !== "---"
                            ? <span style={{ color: PALETTE.primary }}>📍 {row.pointage_location}</span>
                            : <span style={{ color: theme.textMuted }}>—</span>}
                        </td>
                        <td style={{ padding: "0.85rem 1rem" }}>
                          <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: row.status === "present" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.1)", color: row.status === "present" ? "#10b981" : "#ef4444" }}>
                            {row.status === "present" ? "✅ Présent" : "❌ Absent"}
                          </span>
                        </td>
                        <td style={{ padding: "0.85rem 1rem" }}>
                          {row.hours_worked > 0
                            ? <strong style={{ color: "#3b82f6" }}>{row.hours_worked}h</strong>
                            : <span style={{ color: theme.textMuted }}>—</span>}
                        </td>
                        <td style={{ padding: "0.85rem 1rem" }}>
                          {row.status === "present" && (
                            <button onClick={() => openHistory(row)}
                              style={{ padding: "0.38rem 0.65rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, fontSize: "0.75rem", cursor: "pointer", fontFamily: FONTS.body }}>
                              🕐 Historique
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {/* Modal historique */}
      {showHist && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          onClick={e => e.target === e.currentTarget && setShowHist(null)}>
          <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: theme.textPrimary }}>
                🕐 Historique — {showHist.technician.name}
              </h2>
              <button onClick={() => setShowHist(null)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
            </div>
            <div style={{ padding: "1.25rem 1.5rem" }}>
              {!histData ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
                  <div style={{ width: 26, height: 26, border: "3px solid rgba(59,130,246,0.2)", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                </div>
              ) : histData.error ? (
                <div style={{ color: "#ef4444", textAlign: "center" }}>Erreur de chargement</div>
              ) : histData.assignments.length === 0 ? (
                <div style={{ textAlign: "center", color: theme.textMuted }}>Aucune affectation ce jour</div>
              ) : (
                <>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", marginBottom: "0.75rem" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                        {["Zone", "Début", "Fin", "Durée"].map(h => (
                          <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.67rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {histData.assignments.map((a: any, i: number) => (
                        <tr key={a.id} style={{ borderBottom: i < histData.assignments.length - 1 ? `1px solid ${theme.border}` : "none" }}>
                          <td style={{ padding: "0.55rem 0.75rem", fontWeight: 600, color: theme.textPrimary }}>{a.location}</td>
                          <td style={{ padding: "0.55rem 0.75rem", color: theme.textSecondary }}>{a.assigned_at}</td>
                          <td style={{ padding: "0.55rem 0.75rem", color: theme.textSecondary }}>{a.unassigned_at}</td>
                          <td style={{ padding: "0.55rem 0.75rem" }}>
                            <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: "rgba(59,130,246,0.12)", color: "#3b82f6" }}>{a.duration_hours}h</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ padding: "0.65rem 0.85rem", borderRadius: RADIUS.md, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", fontSize: "0.85rem", color: "#3b82f6", fontWeight: 600 }}>
                    Total : {histData.total_hours}h ({histData.total_minutes} min)
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}