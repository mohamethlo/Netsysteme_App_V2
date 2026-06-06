// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/dashboard/TechDashboardPage.tsx
//  Dashboard dédié au Responsable Technique
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import { useAuthStore } from "../../store/authStore";
import api from "../../services/api";
import { PALETTE, RADIUS, FONTS } from "../../theme";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

interface RTStats {
  chantiers_total:           number;
  chantiers_en_cours:        number;
  chantiers_termines:        number;
  chantiers_en_attente:      number;
  techniciens_total:         number;
  techniciens_actifs:        number;
  techniciens_list:          { id: number; nom: string; site: string | null }[];
  interventions_planifiees:  number;
  interventions_en_cours:    number;
  interventions_terminees:   number;
  interventions_aujourd_hui: number;
  devis_en_attente:          number;
  devis_assignes:            number;
  devis_completes:           number;
  reservations_en_attente:   number;
  reservations_approuvees:   number;
  reservations_en_cours:     number;
  affectations_aujourd_hui:  number;
  chantiers_recents: { id: number; nom: string; statut: string; date: string }[];
  reservations_recentes: { id: number; outil: string; technicien: string; statut: string; date_debut: string }[];
}

const fmtDate = (s: string) => new Date(s).toLocaleDateString("fr-FR");

const STATUT_CH_COLOR: Record<string, string> = {
  en_attente: "#f59e0b",
  en_cours:   "#0077b6",
  termine:    "#10b981",
  suspendu:   "#cc2222",
};
const STATUT_CH_LABEL: Record<string, string> = {
  en_attente: "En attente",
  en_cours:   "En cours",
  termine:    "Terminé",
  suspendu:   "Suspendu",
};

const CSS = `
  @keyframes td-spin { to { transform: rotate(360deg); } }
  @keyframes td-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .td-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
  @media (min-width: 640px) { .td-grid { grid-template-columns: repeat(4, 1fr); gap: 1rem; } }
  .td-grid-2 { display: grid; grid-template-columns: 1fr; gap: 1rem; margin-top: 1.25rem; }
  @media (min-width: 900px) { .td-grid-2 { grid-template-columns: 1fr 1fr; } }
  .td-grid-3 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-top: 1.25rem; }
  @media (min-width: 640px) { .td-grid-3 { grid-template-columns: repeat(3, 1fr); } }
  .td-charts { display: grid; grid-template-columns: 1fr; gap: 1rem; margin-top: 1.25rem; }
  @media (min-width: 640px) { .td-charts { grid-template-columns: 1fr 1fr; } }
  @media (min-width: 1100px) { .td-charts { grid-template-columns: 1fr 1fr 1fr 1fr; } }
  .td-anim { animation: td-fade 0.35s ease both; }
`;

interface KpiCardProps {
  label: string; value: number; sub?: string; color: string; theme: LayoutContext["theme"];
}
function KpiCard({ label, value, sub, color, theme }: KpiCardProps) {
  return (
    <div className="td-anim" style={{
      background: theme.cardBg, border: `1px solid ${theme.border}`,
      borderRadius: RADIUS.lg, padding: "1rem 1.25rem",
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: "1.8rem", fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "0.78rem", fontWeight: 600, color: theme.textPrimary, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: "0.7rem", color: theme.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children, theme }: { title: string; children: React.ReactNode; theme: LayoutContext["theme"] }) {
  return (
    <div className="td-anim" style={{
      background: theme.cardBg, border: `1px solid ${theme.border}`,
      borderRadius: RADIUS.lg, padding: "1rem 1.25rem",
    }}>
      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.85rem" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

const TOOLTIP_STYLE = (dark: boolean) => ({
  backgroundColor: dark ? "#1e293b" : "#fff",
  border: `1px solid ${dark ? "#334155" : "#e2e8f0"}`,
  borderRadius: 8,
  fontSize: "0.78rem",
});

export default function TechDashboardPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const { user } = useAuthStore();
  const [stats,   setStats]   = useState<RTStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<RTStats>("/dashboard/stats-rt/")
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const card: React.CSSProperties = {
    background: theme.cardBg, border: `1px solid ${theme.border}`,
    borderRadius: RADIUS.lg, padding: "1rem 1.25rem",
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: "0.85rem", fontWeight: 700, color: theme.textPrimary,
    marginBottom: "0.85rem", display: "flex", justifyContent: "space-between" as const, alignItems: "center",
  };
  const linkStyle: React.CSSProperties = {
    fontSize: "0.72rem", color: PALETTE.primary, fontWeight: 600, textDecoration: "none",
  };

  return (
    <>
      <style>{CSS}</style>

      {/* En-tête */}
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: theme.textPrimary }}>
          Tableau de bord — Responsable Technique
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: theme.textMuted }}>
          Bonjour {user?.prenom} · Vue d'ensemble de vos équipes et chantiers
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: `4px solid ${theme.border}`, borderTopColor: PALETTE.primary, animation: "td-spin 0.8s linear infinite" }} />
        </div>
      ) : !stats ? (
        <div style={{ textAlign: "center" as const, padding: "4rem", color: theme.textMuted }}>Impossible de charger les données.</div>
      ) : (
        <>
          {/* ── KPI principaux ── */}
          <div className="td-grid">
            <KpiCard label="Chantiers en cours"       value={stats.chantiers_en_cours}        color={PALETTE.primary} theme={theme} />
            <KpiCard label="Interventions du jour"    value={stats.interventions_aujourd_hui}  color="#f59e0b"         theme={theme} />
            <KpiCard label="Interventions planifiées" value={stats.interventions_planifiees}   color="#0077b6"         theme={theme} />
            <KpiCard label="Réservations en attente"  value={stats.reservations_en_attente}    color="#7c3aed"         theme={theme} />
          </div>

          {/* ── Graphes ── */}
          <div className="td-charts">

            {/* Donut — Chantiers par statut */}
            <ChartCard title="Chantiers par statut" theme={theme}>
              {(() => {
                const data = [
                  { name: "En cours",    value: stats.chantiers_en_cours,   color: "#0077b6" },
                  { name: "En attente",  value: stats.chantiers_en_attente, color: "#f59e0b" },
                  { name: "Terminés",    value: stats.chantiers_termines,   color: "#10b981" },
                ].filter(d => d.value > 0);
                if (!data.length) return <div style={{ fontSize: "0.82rem", color: theme.textMuted, textAlign: "center", padding: "2rem 0" }}>Aucune donnée</div>;
                return (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                        {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE(dark)} formatter={(v: any, n: any) => [v, n]} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: "0.72rem", color: theme.textSecondary }} />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })()}
            </ChartCard>

            {/* Barres — Interventions */}
            <ChartCard title="Interventions" theme={theme}>
              {(() => {
                const data = [
                  { name: "Planif.",  value: stats.interventions_planifiees,  fill: "#0077b6" },
                  { name: "En cours", value: stats.interventions_en_cours,    fill: "#f59e0b" },
                  { name: "Terminées",value: stats.interventions_terminees,   fill: "#10b981" },
                  { name: "Auj.",     value: stats.interventions_aujourd_hui, fill: PALETTE.primary },
                ];
                return (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barSize={22}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#334155" : "#f1f5f9"} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: theme.textMuted }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: theme.textMuted }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE(dark)} cursor={{ fill: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }} />
                      <Bar dataKey="value" name="Interventions" radius={[4, 4, 0, 0]}>
                        {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </ChartCard>

            {/* Donut — Réservations outils */}
            <ChartCard title="Réservations outils" theme={theme}>
              {(() => {
                const data = [
                  { name: "En attente",  value: stats.reservations_en_attente,  color: "#f59e0b" },
                  { name: "Approuvées",  value: stats.reservations_approuvees,  color: "#10b981" },
                  { name: "En cours",    value: stats.reservations_en_cours,    color: "#0077b6" },
                ].filter(d => d.value > 0);
                if (!data.length) return <div style={{ fontSize: "0.82rem", color: theme.textMuted, textAlign: "center", padding: "2rem 0" }}>Aucune donnée</div>;
                return (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                        {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE(dark)} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: "0.72rem", color: theme.textSecondary }} />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })()}
            </ChartCard>

            {/* Barres — Devis */}
            <ChartCard title="Devis" theme={theme}>
              {(() => {
                const data = [
                  { name: "En attente", value: stats.devis_en_attente, fill: "#f59e0b" },
                  { name: "Assignés",   value: stats.devis_assignes,   fill: "#0077b6" },
                  { name: "Complétés",  value: stats.devis_completes,  fill: "#10b981" },
                ];
                return (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#334155" : "#f1f5f9"} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: theme.textMuted }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: theme.textMuted }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE(dark)} cursor={{ fill: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }} />
                      <Bar dataKey="value" name="Devis" radius={[4, 4, 0, 0]}>
                        {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </ChartCard>
          </div>

          {/* ── Grille infos détaillées ── */}
          <div className="td-grid-2">
            {/* Chantiers récents */}
            <div style={card}>
              <div style={sectionTitle}>
                <span>Chantiers récents</span>
                <Link to="/dashboard/chantiers" style={linkStyle}>Voir tout →</Link>
              </div>
              {stats.chantiers_recents.length === 0 ? (
                <div style={{ fontSize: "0.82rem", color: theme.textMuted }}>Aucun chantier.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.6rem" }}>
                  {stats.chantiers_recents.map(c => (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: `1px solid ${theme.border}` }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", color: theme.textPrimary }}>{c.nom}</div>
                        <div style={{ fontSize: "0.72rem", color: theme.textMuted }}>Début : {fmtDate(c.date)}</div>
                      </div>
                      <span style={{
                        fontSize: "0.68rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full,
                        background: `${STATUT_CH_COLOR[c.statut]}20`,
                        color: STATUT_CH_COLOR[c.statut] ?? "#888",
                      }}>
                        {STATUT_CH_LABEL[c.statut] ?? c.statut}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Réservations outils récentes */}
            <div style={card}>
              <div style={sectionTitle}>
                <span>Réservations outils récentes</span>
                <Link to="/dashboard/outillage" style={linkStyle}>Voir tout →</Link>
              </div>
              {stats.reservations_recentes.length === 0 ? (
                <div style={{ fontSize: "0.82rem", color: theme.textMuted }}>Aucune réservation.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.6rem" }}>
                  {stats.reservations_recentes.map(r => (
                    <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: `1px solid ${theme.border}` }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", color: theme.textPrimary }}>{r.outil}</div>
                        <div style={{ fontSize: "0.72rem", color: theme.textMuted }}>{r.technicien} · {fmtDate(r.date_debut)}</div>
                      </div>
                      <span style={{
                        fontSize: "0.68rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full,
                        background: r.statut === "en_attente" ? "rgba(245,158,11,0.12)"
                          : r.statut === "approuvee" ? "rgba(16,185,129,0.12)"
                          : "rgba(107,114,128,0.12)",
                        color: r.statut === "en_attente" ? "#f59e0b"
                          : r.statut === "approuvee" ? "#10b981"
                          : "#6b7280",
                      }}>
                        {r.statut === "en_attente" ? "En attente" : r.statut === "approuvee" ? "Approuvée" : r.statut}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Techniciens */}
            <div style={card}>
              <div style={sectionTitle}>
                <span>Mes techniciens ({stats.techniciens_actifs})</span>
                <Link to="/dashboard/assignments" style={linkStyle}>Affectations →</Link>
              </div>
              {stats.techniciens_list.length === 0 ? (
                <div style={{ fontSize: "0.82rem", color: theme.textMuted }}>Aucun technicien.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.5rem" }}>
                  {stats.techniciens_list.map(t => (
                    <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0.6rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg, ${PALETTE.primary}, #0077b6)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                          {t.nom.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: "0.82rem", fontWeight: 500, color: theme.textPrimary }}>{t.nom}</span>
                      </div>
                      {t.site && (
                        <span style={{ fontSize: "0.68rem", padding: "2px 7px", borderRadius: RADIUS.full, background: "rgba(0,175,212,0.1)", color: PALETTE.primary }}>
                          {t.site}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Liens rapides */}
            <div style={card}>
              <div style={sectionTitle}><span>Accès rapide</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                {[
                  { label: "Chantiers",       path: "/dashboard/chantiers",    color: PALETTE.primary },
                  { label: "Affectations",    path: "/dashboard/assignments",  color: "#0077b6" },
                  { label: "Interventions",   path: "/dashboard/interventions",color: "#f59e0b" },
                  { label: "Devis",           path: "/dashboard/devis",        color: "#7c3aed" },
                  { label: "Outillage",       path: "/dashboard/outillage",    color: "#10b981" },
                  { label: "Pointage",        path: "/dashboard/attendance",   color: "#cc2222" },
                ].map(item => (
                  <Link key={item.path} to={item.path} style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0.65rem", borderRadius: RADIUS.md, textDecoration: "none",
                    background: `${item.color}15`, border: `1px solid ${item.color}30`,
                    color: item.color, fontSize: "0.82rem", fontWeight: 600,
                    transition: "all 0.15s",
                  }}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
