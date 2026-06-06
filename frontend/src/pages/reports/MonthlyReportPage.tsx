// src/pages/reports/MonthlyReportPage.tsx
import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import { reportsService, type MonthlyReport, type EmployeeReport } from "../../services/reportsService";
import { FONTS, PALETTE, RADIUS } from "../../theme";
import EmployeeDetailModal from "./components/EmployeeDetailModal";
import StatusCharts        from "./components/StatusCharts";

const MONTHS_FR = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                   "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const STATUS_CFG = {
  excellent:    { label: "EXCELLENT",    bg: "rgba(40,167,69,0.12)",  text: "#28a745" },
  bon:          { label: "BON",          bg: "rgba(23,162,184,0.12)", text: "#17a2b8" },
  moyen:        { label: "MOYEN",        bg: "rgba(255,193,7,0.12)",  text: "#e0a800" },
  problematique:{ label: "PROBLÉMATIQUE",bg: "rgba(220,53,69,0.12)",  text: "#dc3545" },
} as const;

const RANK_ICONS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function ProgressBar({ rate, theme }: { rate: number; theme: any }) {
  const color = rate >= 95 ? "#28a745" : rate >= 85 ? "#17a2b8" : rate >= 70 ? "#ffc107" : "#dc3545";
  return (
    <div style={{ width: 100, height: 18, borderRadius: 9, background: theme.border, overflow: "hidden", position: "relative" }}>
      <div style={{ width: `${Math.min(rate, 100)}%`, height: "100%", background: color, transition: "width 0.5s ease" }} />
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", fontWeight: 700, color: rate > 40 ? "#fff" : theme.textPrimary }}>
        {rate}%
      </span>
    </div>
  );
}

export default function MonthlyReportPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const now = new Date();

  const [year,     setYear]     = useState(now.getFullYear());
  const [month,    setMonth]    = useState(now.getMonth() + 1);
  const [report,   setReport]   = useState<MonthlyReport | null>(null);
  const [loading,  setLoading]  = useState(false);   // ← false par défaut, pas true
  const [error,    setError]    = useState<string | null>(null);
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<EmployeeReport | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reportsService.getMonthly(year, month);
      setReport(data);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail ?? err?.response?.data?.error ?? "";

      if (status === 401) {
        // Ne pas laisser l'intercepteur global déconnecter — on affiche juste le message
        setError("Session expirée. Veuillez vous reconnecter.");
      } else if (status === 403) {
        setError("Accès refusé. Ce rapport est réservé aux administrateurs.");
      } else if (status === 404) {
        setError("Endpoint introuvable. Vérifiez que /api/reports/ est bien enregistré dans urls.py.");
      } else {
        setError(`Erreur lors du chargement du rapport.${detail ? " " + detail : ""}`);
      }
      console.error("MonthlyReport error:", status, detail, err);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  // Chargement uniquement sur action utilisateur (bouton Générer), PAS au montage
  // → évite la déconnexion automatique si l'endpoint n'existe pas encore
  // Commentez le useEffect ci-dessous et décommentez l'autre si vous voulez le chargement auto
  useEffect(() => {
    // Chargement auto uniquement si l'URL est déjà configurée
    load();
  }, [load]);

  const filtered = (report?.report_data ?? []).filter(r =>
    !search ||
    r.employee.name.toLowerCase().includes(search.toLowerCase()) ||
    r.employee.role.toLowerCase().includes(search.toLowerCase())
  );

  const inp: React.CSSProperties = {
    padding: "0.52rem 0.75rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.82rem",
    fontFamily: FONTS.body, outline: "none",
  };

  return (
    <div style={{ fontFamily: FONTS.body }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#2c3e50,#3498db)", borderRadius: "16px", padding: "1.75rem 2rem", marginBottom: "1.5rem", color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: "-1.5rem", top: "-1.5rem", fontSize: "9rem", opacity: 0.07, pointerEvents: "none" }}>📊</div>
        <h1 style={{ fontFamily: FONTS.display, fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>
          Rapports Mensuels de Pointage
        </h1>
        <p style={{ fontSize: "0.875rem", opacity: 0.8, margin: 0 }}>
          {report
            ? `${report.month_name} ${report.year} — ${report.total_employees} employé(s)`
            : "Sélectionnez un mois et cliquez sur Générer"}
        </p>
      </div>

      {/* Barre de contrôle */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "flex-end", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", padding: "1rem 1.25rem" }}>
        <div>
          <label style={{ fontSize: "0.7rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", display: "block", marginBottom: 3 }}>Mois</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ ...inp, width: 145, cursor: "pointer" }}>
            {MONTHS_FR.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.7rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", display: "block", marginBottom: 3 }}>Année</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...inp, width: 100, cursor: "pointer" }}>
            {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={load} disabled={loading}
          style={{ padding: "0.55rem 1.25rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: FONTS.body, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Chargement…" : "🔍 Générer"}
        </button>
        {report && (
          <>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: "0.7rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", display: "block", marginBottom: 3 }}>Recherche</label>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom ou rôle…" style={{ ...inp, width: "100%" }} />
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={() => reportsService.exportPdf(year, month)}
                style={{ padding: "0.55rem 0.9rem", borderRadius: RADIUS.md, border: "1px solid rgba(220,53,69,0.4)", background: "transparent", color: "#dc3545", fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body }}>
                📄 PDF
              </button>
              <button onClick={() => reportsService.exportExcel(year, month)}
                style={{ padding: "0.55rem 0.9rem", borderRadius: RADIUS.md, border: "1px solid rgba(40,167,69,0.4)", background: "transparent", color: "#28a745", fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body }}>
                📊 Excel
              </button>
            </div>
          </>
        )}
      </div>

      {/* Message d'erreur — ne déconnecte PAS */}
      {error && (
        <div style={{ padding: "1rem 1.25rem", borderRadius: "12px", background: "rgba(220,53,69,0.06)", border: "1px solid rgba(220,53,69,0.3)", color: "#dc3545", marginBottom: "1.25rem", fontSize: "0.875rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <span style={{ fontSize: "1.2rem" }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Impossible de charger le rapport</div>
            <div style={{ fontSize: "0.82rem" }}>{error}</div>
            {error.includes("urls.py") && (
              <code style={{ display: "block", marginTop: "0.5rem", padding: "0.5rem 0.75rem", background: "rgba(220,53,69,0.08)", borderRadius: 6, fontSize: "0.78rem" }}>
                # config/urls.py{"\n"}
                path("api/reports/", include("apps.attendance.urls_reports")),
              </code>
            )}
          </div>
        </div>
      )}

      {/* Chargement */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <div style={{ width: 36, height: 36, border: `3px solid rgba(52,152,219,0.2)`, borderTopColor: "#3498db", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      )}

      {/* Contenu */}
      {!loading && report && (
        <>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
            {[
              { label: "Employés actifs",    value: report.total_employees,   icon: "👥", color: "#3498db" },
              { label: "Moy. heures/employé",value: `${report.avg_hours}h`,   icon: "⏱️", color: "#27ae60" },
              { label: "Total absences",     value: report.total_absences,    icon: "❌", color: "#dc3545" },
              { label: "Total retards",      value: report.total_lates,       icon: "⚠️", color: "#f39c12" },
              { label: "Jours ouvrables moy",value: report.avg_working_days,  icon: "📅", color: "#8e44ad" },
            ].map(k => (
              <div key={k.label} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: "10px", background: k.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>{k.icon}</div>
                <div>
                  <div style={{ fontSize: "0.65rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{k.label}</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1.1 }}>{k.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Tableau */}
          <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden", marginBottom: "1.5rem" }}>
            <div style={{ padding: "0.85rem 1.25rem", borderBottom: `1px solid ${theme.border}` }}>
              <span style={{ fontWeight: 600, color: theme.textPrimary, fontSize: "0.9rem" }}>
                Classement par ordre de mérite
                <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: theme.textMuted, fontWeight: 400 }}>
                  ({filtered.length} employé(s))
                </span>
              </span>
            </div>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: theme.textMuted }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>👥</div>
                <div>Aucun employé trouvé</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                      {["#", "Employé", "Rôle", "Heures", "Présent", "Absent", "Retards", "Just.", "Non just.", "Taux", "Statut", ""].map((h, i) => (
                        <th key={i} style={{ padding: "0.7rem 0.75rem", textAlign: "left", fontSize: "0.65rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => {
                      const rank  = (report.report_data.indexOf(row)) + 1;
                      const sc    = STATUS_CFG[row.status] ?? STATUS_CFG.problematique;
                      const isTop3 = rank <= 3;
                      return (
                        <tr key={row.employee.id}
                          style={{ borderBottom: `1px solid ${theme.border}`, background: isTop3 ? (dark ? "rgba(40,167,69,0.05)" : "rgba(40,167,69,0.04)") : "transparent" }}
                          onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                          onMouseLeave={e => (e.currentTarget.style.background = isTop3 ? (dark ? "rgba(40,167,69,0.05)" : "rgba(40,167,69,0.04)") : "transparent")}
                        >
                          <td style={{ padding: "0.75rem 0.75rem", fontWeight: 700, fontSize: "1rem" }}>
                            {RANK_ICONS[rank] ?? <span style={{ color: theme.textMuted, fontSize: "0.82rem" }}>{rank}</span>}
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", fontWeight: 600, color: theme.textPrimary, whiteSpace: "nowrap" }}>{row.employee.name}</td>
                          <td style={{ padding: "0.75rem 0.75rem" }}>
                            <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "1px 7px", borderRadius: RADIUS.full, background: theme.border, color: theme.textSecondary }}>{row.employee.role}</span>
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", fontWeight: 700, color: "#3498db" }}>{row.total_hours}h</td>
                          <td style={{ padding: "0.75rem 0.75rem" }}>
                            <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: "rgba(40,167,69,0.12)", color: "#28a745" }}>{row.days_present}</span>
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem" }}>
                            <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: "rgba(220,53,69,0.1)", color: "#dc3545" }}>{row.days_absent}</span>
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem" }}>
                            <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: "rgba(255,193,7,0.12)", color: "#e0a800" }}>{row.days_late}</span>
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", color: theme.textSecondary }}>{row.justified_lates}</td>
                          <td style={{ padding: "0.75rem 0.75rem" }}>
                            {row.unjustified_lates > 0
                              ? <span style={{ fontWeight: 700, color: "#dc3545" }}>{row.unjustified_lates}</span>
                              : <span style={{ color: theme.textMuted }}>0</span>}
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem" }}><ProgressBar rate={row.attendance_rate} theme={theme} /></td>
                          <td style={{ padding: "0.75rem 0.75rem" }}>
                            <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: sc.bg, color: sc.text }}>{sc.label}</span>
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem" }}>
                            <button onClick={() => setSelected(row)}
                              style={{ padding: "0.35rem 0.6rem", borderRadius: RADIUS.md, border: `1px solid ${PALETTE.primary}44`, background: "transparent", color: PALETTE.primary, fontSize: "0.75rem", cursor: "pointer", fontFamily: FONTS.body }}>
                              👁
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Graphiques */}
          <StatusCharts dark={dark} theme={theme} reportData={report.report_data} />
        </>
      )}

      {/* Modal détail */}
      {selected && (
        <EmployeeDetailModal
          dark={dark} theme={theme}
          data={selected} year={year} month={month}
          onClose={() => setSelected(null)}
          onExportPdf={() => reportsService.exportEmployeePdf(selected.employee.id, year, month)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}