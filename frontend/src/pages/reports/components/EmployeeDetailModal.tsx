// src/pages/reports/components/EmployeeDetailModal.tsx
import { type LayoutContext } from "../../../layouts/MainLayout";
import { type EmployeeReport, type AttendanceDetail } from "../../../services/reportsService";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark: boolean; theme: LayoutContext["theme"];
  data: EmployeeReport; year: number; month: number;
  onClose: () => void; onExportPdf: () => void;
}

const MONTHS_FR = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                   "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const STATUS_CFG = {
  excellent:    { label: "EXCELLENT",    bg: "rgba(40,167,69,0.12)",  text: "#28a745" },
  bon:          { label: "BON",          bg: "rgba(23,162,184,0.12)", text: "#17a2b8" },
  moyen:        { label: "MOYEN",        bg: "rgba(255,193,7,0.12)",  text: "#e0a800" },
  problematique:{ label: "PROBLÉMATIQUE",bg: "rgba(220,53,69,0.12)",  text: "#dc3545" },
};

export default function EmployeeDetailModal({ dark, theme, data, year, month, onClose, onExportPdf }: Props) {
  const sc = STATUS_CFG[data.status] ?? STATUS_CFG.problematique;

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.45rem 0", borderBottom: `1px solid ${theme.border}` }}>
      <span style={{ fontSize: "0.78rem", color: theme.textMuted, minWidth: 140 }}>{label}</span>
      <span style={{ fontSize: "0.875rem", color: theme.textPrimary, fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", overflowY: "auto" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 780, maxHeight: "94vh", overflowY: "auto", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg,rgba(52,152,219,0.08),rgba(44,62,80,0.04))", borderRadius: "18px 18px 0 0" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1.1rem", fontWeight: 700, color: theme.textPrimary, marginBottom: 3 }}>
              {data.employee.name}
            </h2>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: theme.border, color: theme.textMuted }}>{data.employee.role}</span>
              <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: sc.bg, color: sc.text }}>{sc.label}</span>
              <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>{MONTHS_FR[month]} {year}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
        </div>

        <div style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
          {/* Infos employé */}
          <div>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>👤 Informations</div>
            <Row label="Email"     value={data.employee.email} />
            <Row label="Téléphone" value={data.employee.telephone} />
            <Row label="Rôle"      value={data.employee.role} />
          </div>
          {/* Stats */}
          <div>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>📊 Statistiques</div>
            <Row label="Heures totales" value={<strong style={{ color: "#3498db" }}>{data.total_hours}h</strong>} />
            <Row label="Jours présents" value={<span style={{ color: "#28a745", fontWeight: 700 }}>{data.days_present} / {data.working_days}</span>} />
            <Row label="Jours absents"  value={<span style={{ color: "#dc3545", fontWeight: 700 }}>{data.days_absent}</span>} />
            <Row label="Retards"        value={`${data.days_late} (${data.justified_lates} just. / ${data.unjustified_lates} non just.)`} />
            <Row label="Taux de présence" value={
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ width: 80, height: 16, borderRadius: 8, background: theme.border, overflow: "hidden" }}>
                  <div style={{ width: `${data.attendance_rate}%`, height: "100%", background: data.attendance_rate >= 95 ? "#28a745" : data.attendance_rate >= 85 ? "#17a2b8" : data.attendance_rate >= 70 ? "#ffc107" : "#dc3545" }} />
                </div>
                <strong>{data.attendance_rate}%</strong>
              </div>
            } />
          </div>
        </div>

        {/* Détails quotidiens */}
        <div style={{ padding: "0 1.5rem 1.5rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>📋 Détail des pointages quotidiens</div>
          {data.attendance_details.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: theme.textMuted }}>Aucun pointage enregistré ce mois</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {["Date", "Jour", "Entrée", "Sortie", "Heures", "Lieu", "Statut", "Note"].map(h => (
                      <th key={h} style={{ padding: "0.55rem 0.65rem", textAlign: "left", fontSize: "0.65rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.attendance_details.map((a: AttendanceDetail, i: number) => {
                    const isPresent = a.check_in !== "—";
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${theme.border}`, background: a.is_late ? (dark ? "rgba(255,193,7,0.04)" : "rgba(255,193,7,0.03)") : !isPresent ? (dark ? "rgba(220,53,69,0.04)" : "rgba(220,53,69,0.03)") : "transparent" }}>
                        <td style={{ padding: "0.5rem 0.65rem", fontWeight: 500, color: theme.textPrimary, whiteSpace: "nowrap" }}>{a.date}</td>
                        <td style={{ padding: "0.5rem 0.65rem", color: theme.textMuted }}>{a.day_name.slice(0, 3)}</td>
                        <td style={{ padding: "0.5rem 0.65rem", color: isPresent ? "#28a745" : theme.textMuted, fontWeight: 500 }}>{a.check_in}</td>
                        <td style={{ padding: "0.5rem 0.65rem", color: theme.textSecondary }}>{a.check_out}</td>
                        <td style={{ padding: "0.5rem 0.65rem", fontWeight: 600, color: "#3498db" }}>{a.total_hours}</td>
                        <td style={{ padding: "0.5rem 0.65rem", color: theme.textMuted, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.location}</td>
                        <td style={{ padding: "0.5rem 0.65rem" }}>
                          <span style={{ fontSize: "0.67rem", fontWeight: 600, padding: "1px 6px", borderRadius: RADIUS.full,
                            background: a.is_late ? "rgba(255,193,7,0.12)" : !isPresent ? "rgba(220,53,69,0.1)" : "rgba(40,167,69,0.12)",
                            color:      a.is_late ? "#e0a800"              : !isPresent ? "#dc3545"              : "#28a745" }}>
                            {a.is_late ? "RETARD" : isPresent ? "PRÉSENT" : "ABSENT"}
                          </span>
                        </td>
                        <td style={{ padding: "0.5rem 0.65rem", color: theme.textMuted, fontSize: "0.72rem", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.notes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "0.85rem 1.5rem", borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button onClick={onClose} style={{ padding: "0.55rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
            Fermer
          </button>
          <button onClick={onExportPdf}
            style={{ padding: "0.55rem 1.25rem", borderRadius: RADIUS.md, border: "none", background: "linear-gradient(135deg,#e74c3c,#c0392b)", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
            📄 Télécharger PDF
          </button>
        </div>
      </div>
    </div>
  );
}