// src/pages/reports/components/StatusCharts.tsx
// Utilise recharts (déjà dans les dépendances du projet) — pas d'import dynamique
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { type EmployeeReport } from "../../../services/reportsService";
import { FONTS } from "../../../theme";

interface Props {
  dark: boolean;
  theme: LayoutContext["theme"];
  reportData: EmployeeReport[];
}

const STATUS_COLORS: Record<string, string> = {
  excellent:    "#28a745",
  bon:          "#17a2b8",
  moyen:        "#ffc107",
  problematique:"#dc3545",
};

const STATUS_LABELS: Record<string, string> = {
  excellent:    "Excellent",
  bon:          "Bon",
  moyen:        "Moyen",
  problematique:"Problématique",
};

export default function StatusCharts({ dark, theme, reportData }: Props) {
  if (!reportData.length) return null;

  // ── Données donut statuts ───────────────────────────────────────────────────
  const counts: Record<string, number> = {
    excellent: 0, bon: 0, moyen: 0, problematique: 0,
  };
  reportData.forEach(r => {
    if (r.status in counts) counts[r.status]++;
  });
  const donutData = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: STATUS_LABELS[key], value, color: STATUS_COLORS[key] }));

  // ── Données bar top 5 heures ──────────────────────────────────────────────
  const top5 = [...reportData]
    .sort((a, b) => b.total_hours - a.total_hours)
    .slice(0, 5)
    .map(r => ({
      name:  r.employee.prenom || r.employee.name.split(" ")[0],
      heures: r.total_hours,
    }));

  const card = (title: string, children: React.ReactNode) => (
    <div style={{
      background: theme.cardBg, border: `1px solid ${theme.border}`,
      borderRadius: "14px", overflow: "hidden", flex: 1,
    }}>
      <div style={{
        padding: "0.85rem 1.25rem", borderBottom: `1px solid ${theme.border}`,
        fontWeight: 600, color: theme.textPrimary, fontSize: "0.875rem",
        fontFamily: FONTS.body,
      }}>{title}</div>
      <div style={{ padding: "1.25rem" }}>{children}</div>
    </div>
  );

  const tickColor = dark ? "#9ca3af" : "#6b7280";
  const gridColor = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  return (
    <div style={{ display: "flex", gap: "1.25rem", marginTop: "0.5rem", flexWrap: "wrap" }}>

      {/* ── Donut statuts ── */}
      {card("📊 Répartition des statuts",
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={donutData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={95}
              paddingAngle={3}
              label={({ name, value }) => `${name} (${value})`}
              labelLine={false}
            >
              {donutData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: theme.popupBg, border: `1px solid ${theme.border}`,
                borderRadius: 8, fontSize: "0.8rem", fontFamily: FONTS.body,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "0.78rem", fontFamily: FONTS.body, color: tickColor }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}

      {/* ── Bar top 5 ── */}
      {card("🏆 Top 5 — Heures travaillées",
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={top5} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: tickColor, fontFamily: FONTS.body }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: tickColor, fontFamily: FONTS.body }}
              tickFormatter={(v) => `${v}h`}
            />
            <Tooltip
              formatter={(v: number) => [`${v}h`, "Heures"]}
              contentStyle={{
                background: theme.popupBg, border: `1px solid ${theme.border}`,
                borderRadius: 8, fontSize: "0.8rem", fontFamily: FONTS.body,
              }}
            />
            <Bar dataKey="heures" fill="#3498db" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}