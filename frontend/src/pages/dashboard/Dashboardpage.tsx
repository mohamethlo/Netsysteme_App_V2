// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/dashboard/DashboardPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, AreaChart, Area, ResponsiveContainer,
} from "recharts";
import { useAuthStore } from "../../store/authStore";
import { type LayoutContext } from "../../layouts/MainLayout";
import { FONTS, PALETTE, MODULE_COLORS } from "../../theme";
import api from "../../services/api";

// ── Types ─────────────────────────────────────────────────────────────────────
interface RecentActivity { type: string; title: string; sub: string; time: string|null; dot: string; }
interface PerfCommercial { id:number; name:string; appels:number; joints:number; taux_succes:number; inst_mois:number; inst_total:number; conversions:number; }
interface PerfTechnicien  { id:number; name:string; interv_total:number; interv_terminees:number; interv_mois:number; taux_completion:number; inst_total:number; inst_mois:number; }
interface ChartDay  { date:string; joints:number; non_joints:number; }
interface ChartMois { mois:string; installations:number; interventions:number; }
interface PieItem   { name:string; value:number; }

interface DashStats {
  clients_total:number; prospects_total:number;
  interventions_total:number; interventions_planifiees:number; interventions_en_cours:number; interventions_terminees:number; interventions_urgentes:number; interventions_aujourd_hui:number;
  installations_total:number; installations_en_attente:number; installations_en_cours:number; installations_terminees:number;
  montant_total_installations:number; montant_restant_total:number; montant_avance_total:number;
  factures_total:number; factures_draft:number; montant_factures_total:number; montant_en_attente:number;
  presences_aujourd_hui:number; retards_aujourd_hui:number; techniciens_actifs:number; stock_alertes:number;
  recent_activity:RecentActivity[];
  appels_7j:ChartDay[]; appels_resultat:PieItem[]; hist_6mois:ChartMois[];
  perf_commerciaux:PerfCommercial[]; perf_techniciens:PerfTechnicien[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt  = (n:number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtK = (n:number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}k` : `${n}`;

function relTime(iso:string|null) {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1)  return "à l'instant";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h/24)}j`;
}

function useCountUp(target:number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) { setV(0); return; }
    let cur = 0;
    const step = Math.max(1, Math.ceil(target/40));
    const id = setInterval(() => { cur = Math.min(cur+step, target); setV(cur); if (cur>=target) clearInterval(id); }, 22);
    return () => clearInterval(id);
  }, [target]);
  return v;
}

function useBreakpoint() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn, { passive: true });
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { xs: w < 480, sm: w < 640, md: w < 1024, w };
}

// ── Chart colors ──────────────────────────────────────────────────────────────
const C = [PALETTE.primary, PALETTE.success, PALETTE.warning, PALETTE.danger, PALETTE.purple, PALETTE.info];

// ── Recharts custom tooltip ───────────────────────────────────────────────────
function ChartTip({ active, payload, label, theme, dark }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: dark ? "#1c2333" : "#fff", border: `1px solid ${theme.border}`, borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.78rem", fontFamily: FONTS.body, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
      {label && <p style={{ color: theme.textMuted, marginBottom: 4, fontWeight: 600 }}>{label}</p>}
      {payload.map((e:any, i:number) => (
        <p key={i} style={{ color: e.color, margin: "2px 0" }}>{e.name} : <b>{e.value}</b></p>
      ))}
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon, onClick, theme }: {
  label:string; value:number|string; sub?:string; color:string; icon:string; onClick?:()=>void; theme:LayoutContext["theme"];
}) {
  const [hov, setHov] = useState(false);
  const n = typeof value === "number" ? value : 0;
  const c = useCountUp(n);
  const display = typeof value === "string" ? value : fmt(c);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? theme.cardBgHover : theme.cardBg, border: `1px solid ${hov ? color+"44" : theme.border}`, borderRadius: 14, padding: "1rem 1.1rem", cursor: onClick ? "pointer" : "default", transition: "all 0.2s", transform: hov && onClick ? "translateY(-2px)" : "none", position: "relative", overflow: "hidden", fontFamily: FONTS.body }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: color, borderRadius: "14px 0 0 14px" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.6rem" }}>
        <span style={{ fontSize: "0.7rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
        <span style={{ fontSize: "1.15rem" }}>{icon}</span>
      </div>
      <div style={{ fontSize: "1.7rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1, marginBottom: "0.3rem" }}>{display}</div>
      {sub && <div style={{ fontSize: "0.72rem", color: theme.textMuted }}>{sub}</div>}
    </div>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
function ProgressBar({ label, value, max, color, theme }: { label:string; value:number; max:number; color:string; theme:LayoutContext["theme"] }) {
  const pct = max > 0 ? Math.round((value/max)*100) : 0;
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
        <span style={{ fontSize: "0.78rem", color: theme.textSecondary }}>{label}</span>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: theme.textPrimary }}>{value} <span style={{ color: theme.textMuted }}>/ {max}</span></span>
      </div>
      <div style={{ height: 5, borderRadius: 4, background: theme.border }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 1s ease" }} />
      </div>
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ children, theme, style={} }: { children:React.ReactNode; theme:LayoutContext["theme"]; style?:React.CSSProperties }) {
  return <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "1.1rem 1.25rem", ...style }}>{children}</div>;
}

function SectionTitle({ title, sub, theme }: { title:string; sub?:string; theme:LayoutContext["theme"] }) {
  return (
    <div style={{ marginBottom: "0.9rem" }}>
      <h2 style={{ fontFamily: FONTS.display, fontSize: "0.95rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.01em" }}>{title}</h2>
      {sub && <p style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

// ── Activity item ─────────────────────────────────────────────────────────────
function ActivityItem({ title, sub, time, dot, theme }: { title:string; sub:string; time:string|null; dot:string; theme:LayoutContext["theme"] }) {
  const color = (MODULE_COLORS as Record<string,string>)[dot] ?? PALETTE.primary;
  return (
    <div style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start", padding: "0.6rem 0", borderBottom: `1px solid ${theme.border}` }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, marginTop: 6, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 500, color: theme.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 2 }}>{sub}</div>
      </div>
      <span style={{ fontSize: "0.68rem", color: theme.textMuted, flexShrink: 0 }}>{relTime(time)}</span>
    </div>
  );
}

// ── QuickAction ───────────────────────────────────────────────────────────────
function QuickAction({ label, icon, color, to, theme, disabled }: { label:string; icon:string; color:string; to:string; theme:LayoutContext["theme"]; disabled?:boolean }) {
  const nav = useNavigate();
  const [hov, setHov] = useState(false);
  return (
    <button onClick={() => !disabled && nav(to)} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem", padding: "0.8rem 0.5rem", borderRadius: 12, background: hov && !disabled ? theme.cardBgHover : theme.cardBg, border: `1px solid ${hov && !disabled ? color+"55" : theme.border}`, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1, transition: "all 0.18s", transform: hov && !disabled ? "translateY(-2px)" : "none", fontFamily: FONTS.body }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: color+"18", border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>{icon}</div>
      <span style={{ fontSize: "0.7rem", fontWeight: 500, color: theme.textSecondary, textAlign: "center", lineHeight: 1.3 }}>{label}</span>
    </button>
  );
}

// ── Performance card (commercial or technicien) ───────────────────────────────
function PerfCard({ name, lines, mainPct, pctLabel, pctColor, dark, theme }: {
  name:string; lines:{label:string; value:string|number; color:string}[];
  mainPct:number; pctLabel:string; pctColor:string; dark:boolean; theme:LayoutContext["theme"];
}) {
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);
  return (
    <div style={{ background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)", borderRadius: 12, padding: "0.9rem 1rem", border: `1px solid ${theme.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.75rem" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 700, color: "#fff", flexShrink: 0 }}>{initials || "?"}</div>
        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: theme.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginBottom: "0.65rem" }}>
        {lines.map((l, i) => (
          <div key={i}>
            <div style={{ fontSize: "0.62rem", color: theme.textMuted, marginBottom: 2 }}>{l.label}</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: l.color }}>{l.value}</div>
          </div>
        ))}
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: "0.68rem", color: theme.textMuted }}>{pctLabel}</span>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: pctColor }}>{mainPct}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 4, background: theme.border }}>
          <div style={{ height: "100%", width: `${Math.min(mainPct,100)}%`, background: pctColor, borderRadius: 4, transition: "width 1s ease" }} />
        </div>
      </div>
    </div>
  );
}

// ── DashboardPage ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { dark, theme }         = useOutletContext<LayoutContext>();
  const { user, hasPermission } = useAuthStore();
  const navigate                = useNavigate();
  const bp                      = useBreakpoint();
  const [stats, setStats]       = useState<DashStats|null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

  const load = () => {
    setLoading(true); setError(false);
    api.get("/dashboard/stats/")
      .then(r => { setStats(r.data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const isAdmin  = hasPermission("all");

  // ── Chart axis / tooltip theme ─────────────────────────────────────────────
  const chartH    = bp.sm ? 160 : 210;
  const pieR      = bp.sm ? 55  : 70;
  const pieInner  = bp.sm ? 35  : 48;
  const tickStyle = { fontSize: 10, fill: theme.textMuted };
  const tipStyle  = { contentStyle: { background: dark ? "#1c2333":"#fff", border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: "0.78rem", fontFamily: FONTS.body }, labelStyle: { color: theme.textMuted }, itemStyle: { color: theme.textPrimary } };

  // ── Grid helpers ──────────────────────────────────────────────────────────
  const g = (cols:string, gap="1rem"):React.CSSProperties => ({ display:"grid", gridTemplateColumns:cols, gap, marginBottom:"1.25rem" });

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:300 }}>
      <div style={{ width:36, height:36, border:`3px solid ${PALETTE.primary}44`, borderTopColor:PALETTE.primary, borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (error || !stats) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:300, flexDirection:"column", gap:"0.75rem" }}>
      <span style={{ fontSize:"2rem" }}>⚠️</span>
      <p style={{ color:theme.textMuted, fontSize:"0.9rem" }}>Impossible de charger les statistiques.</p>
      <button onClick={load} style={{ padding:"0.5rem 1rem", borderRadius:8, border:`1px solid ${theme.border}`, background:"transparent", color:PALETTE.primary, cursor:"pointer", fontFamily:FONTS.body, fontSize:"0.85rem" }}>Réessayer</button>
    </div>
  );

  const s = stats;

  return (
    <div style={{ fontFamily: FONTS.body, maxWidth: "100%", overflowX: "hidden" }}>

      {/* ── Greeting ── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily:FONTS.display, fontSize:"clamp(1.2rem,4vw,1.55rem)", fontWeight:700, color:theme.textPrimary, letterSpacing:"-0.02em", lineHeight:1.3 }}>
          {greeting},{" "}
          <span style={{ background:`linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            {user?.prenom}
          </span>{" "}👋
        </h1>
        <div style={{ fontSize:"0.82rem", color:theme.textMuted, marginTop:"0.3rem", display:"flex", flexWrap:"wrap", gap:"0.6rem", alignItems:"center" }}>
          <span>{new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</span>
          {isAdmin && s.stock_alertes        > 0 && <span style={{ color:PALETTE.warning,  fontWeight:600 }}>⚠ {s.stock_alertes} alerte{s.stock_alertes>1?"s":""} stock</span>}
          {isAdmin && s.interventions_urgentes > 0 && <span style={{ color:PALETTE.danger, fontWeight:600 }}>🔴 {s.interventions_urgentes} urgente{s.interventions_urgentes>1?"s":""}</span>}
          {isAdmin && s.retards_aujourd_hui   > 0 && <span style={{ color:PALETTE.info,    fontWeight:600 }}>⏱ {s.retards_aujourd_hui} retard{s.retards_aujourd_hui>1?"s":""}</span>}
        </div>
      </div>

      {/* ── Vue non-admin : Présence uniquement ── */}
      {!isAdmin && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "1.5rem 0 2rem" }}>
          <Card theme={theme} style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
            <div style={{ fontSize: "2.8rem", marginBottom: "0.75rem" }}>⏱</div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1.1rem", fontWeight: 700, color: theme.textPrimary, marginBottom: "0.4rem" }}>
              Enregistrer votre présence
            </h2>
            <p style={{ fontSize: "0.82rem", color: theme.textMuted, marginBottom: "1.25rem", lineHeight: 1.5 }}>
              Pointez votre arrivée ou départ pour la journée du{" "}
              <strong>{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</strong>.
            </p>
            <QuickAction
              label="Présence"
              icon="⏱"
              color={MODULE_COLORS.attendance}
              to="/dashboard/attendance"
              theme={theme}
              disabled={!hasPermission("attendance")}
            />
          </Card>
        </div>
      )}

      {/* ── Contenu admin uniquement ── */}
      {isAdmin && (<>

      {/* ── Accès rapides ── */}
      <Card theme={theme} style={{ marginBottom: "1.5rem" }}>
        <SectionTitle title="Accès rapides" sub="Actions fréquentes" theme={theme} />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"0.5rem" }}>
          <QuickAction label="Intervention"  icon="🔧" color={MODULE_COLORS.interventions}  to="/dashboard/interventions"  theme={theme} disabled={!hasPermission("interventions")} />
          <QuickAction label="Client"        icon="👤" color={MODULE_COLORS.clients}        to="/dashboard/clients"        theme={theme} disabled={!hasPermission("clients")}        />
          <QuickAction label="Facture"       icon="📄" color={MODULE_COLORS.billing}        to="/dashboard/billing"        theme={theme} disabled={!hasPermission("billing")}        />
          <QuickAction label="Installation"  icon="🏠" color={MODULE_COLORS.installations}  to="/dashboard/installations"  theme={theme} disabled={!hasPermission("installations")}  />
          <QuickAction label="Présence"      icon="⏱"  color={MODULE_COLORS.attendance}     to="/dashboard/attendance"     theme={theme} disabled={!hasPermission("attendance")}     />
          <QuickAction label="Stock"         icon="📦" color={MODULE_COLORS.inventory}      to="/dashboard/inventory"      theme={theme} disabled={!hasPermission("inventory")}      />
        </div>
      </Card>

      {/* ── KPI Cards ── */}
      <SectionTitle title="Vue d'ensemble" sub="Indicateurs clés" theme={theme} />
      <div style={{ ...g(bp.xs ? "repeat(2,1fr)" : bp.sm ? "repeat(2,1fr)" : bp.md ? "repeat(3,1fr)" : "repeat(auto-fill,minmax(185px,1fr))") }}>
        {hasPermission("clients") && (
          <StatCard label="Clients" value={s.clients_total} sub={`${s.prospects_total} prospect${s.prospects_total>1?"s":""}`} color={MODULE_COLORS.clients} icon="👥" onClick={() => navigate("/dashboard/clients")} theme={theme} />
        )}
        {hasPermission("interventions") && (
          <StatCard label="Interventions" value={s.interventions_total} sub={`${s.interventions_en_cours} en cours · ${s.interventions_aujourd_hui} auj.`} color={MODULE_COLORS.interventions} icon="🔧" onClick={() => navigate("/dashboard/interventions")} theme={theme} />
        )}
        {hasPermission("installations") && (
          <StatCard label="Installations" value={s.installations_total} sub={`${s.installations_en_cours} en cours · ${s.installations_terminees} terminées`} color={MODULE_COLORS.installations} icon="🏠" onClick={() => navigate("/dashboard/installations")} theme={theme} />
        )}
        {hasPermission("billing") && (
          <StatCard label="Factures" value={s.factures_total} sub={`${s.factures_draft} brouillon${s.factures_draft>1?"s":""}`} color={MODULE_COLORS.billing} icon="📄" onClick={() => navigate("/dashboard/billing")} theme={theme} />
        )}
        {isAdmin && (
          <StatCard label="CA Factures" value={`${fmtK(s.montant_factures_total)} F`} sub="Total facturé" color={PALETTE.success} icon="💰" theme={theme} />
        )}
        {isAdmin && (
          <StatCard label="CA Installations" value={`${fmtK(s.montant_total_installations)} F`} sub={`${fmtK(s.montant_avance_total)} F perçus`} color={PALETTE.warning} icon="🏗️" theme={theme} />
        )}
        {hasPermission("attendance") && (
          <StatCard label="Présences auj." value={s.presences_aujourd_hui} sub={`${s.techniciens_actifs} technicien${s.techniciens_actifs>1?"s":""} actif${s.techniciens_actifs>1?"s":""}`} color={MODULE_COLORS.attendance} icon="⏱" onClick={() => navigate("/dashboard/attendance")} theme={theme} />
        )}
        {hasPermission("inventory") && (
          <StatCard label="Alertes stock" value={s.stock_alertes} sub={s.stock_alertes>0?"Produits sous le seuil":"Stock OK"} color={s.stock_alertes>0?PALETTE.danger:PALETTE.success} icon="📦" onClick={() => navigate("/dashboard/inventory")} theme={theme} />
        )}
      </div>

      {/* ── Charts row 1 : Appels 7j + Historique 6 mois ── */}
      {(s.appels_7j.length > 0 || s.hist_6mois.length > 0) && (
        <>
          <SectionTitle title="Graphiques" sub="Tendances et activité" theme={theme} />
          <div style={g(bp.md ? "1fr" : "1fr 1fr")}>

            {s.appels_7j.length > 0 && (
              <Card theme={theme}>
                <SectionTitle title="Appels — 7 derniers jours" sub="Joints vs non joints" theme={theme} />
                <ResponsiveContainer width="100%" height={chartH}>
                  <BarChart data={s.appels_7j} margin={{ top:4, right:4, left:-20, bottom:0 }} barSize={bp.sm?10:14}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                    <XAxis dataKey="date" tick={tickStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={tickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip {...tipStyle} cursor={{ fill: dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)" }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:"0.75rem", color:theme.textMuted }} />
                    <Bar dataKey="joints"     name="Joints"     fill={PALETTE.success} radius={[4,4,0,0]} />
                    <Bar dataKey="non_joints" name="Non joints" fill={PALETTE.danger}  radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {s.hist_6mois.length > 0 && (
              <Card theme={theme}>
                <SectionTitle title="Activité — 6 derniers mois" sub="Installations & Interventions" theme={theme} />
                <ResponsiveContainer width="100%" height={chartH}>
                  <AreaChart data={s.hist_6mois} margin={{ top:4, right:4, left:-20, bottom:0 }}>
                    <defs>
                      <linearGradient id="gradInst" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={PALETTE.primary} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={PALETTE.primary} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gradInterv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={PALETTE.warning} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={PALETTE.warning} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                    <XAxis dataKey="mois" tick={tickStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={tickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip {...tipStyle} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:"0.75rem", color:theme.textMuted }} />
                    <Area type="monotone" dataKey="installations" name="Installations" stroke={PALETTE.primary} strokeWidth={2} fill="url(#gradInst)" dot={{ r:3, fill:PALETTE.primary }} />
                    <Area type="monotone" dataKey="interventions"  name="Interventions" stroke={PALETTE.warning} strokeWidth={2} fill="url(#gradInterv)" dot={{ r:3, fill:PALETTE.warning }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>
        </>
      )}

      {/* ── Charts row 2 : Pie charts ── */}
      {(s.appels_resultat.some(x=>x.value>0) || s.interventions_total > 0) && (
        <div style={g(bp.md ? "1fr" : "1fr 1fr")}>

          {s.appels_resultat.some(x=>x.value>0) && hasPermission("clients") && (
            <Card theme={theme}>
              <SectionTitle title="Résultats des appels" sub="Taux de contact" theme={theme} />
              <ResponsiveContainer width="100%" height={chartH}>
                <PieChart>
                  <Pie data={s.appels_resultat} cx="50%" cy="50%" innerRadius={pieInner} outerRadius={pieR} dataKey="value" paddingAngle={3}
                    label={!bp.sm ? ({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%` : false}
                    labelLine={!bp.sm}>
                    {s.appels_resultat.map((_, i) => <Cell key={i} fill={[PALETTE.success, PALETTE.danger][i] ?? C[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background:dark?"#1c2333":"#fff", border:`1px solid ${theme.border}`, borderRadius:8, fontSize:"0.78rem" }} />
                  {bp.sm && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:"0.72rem" }} />}
                </PieChart>
              </ResponsiveContainer>
            </Card>
          )}

          {s.interventions_total > 0 && hasPermission("interventions") && (
            <Card theme={theme}>
              <SectionTitle title="Statuts interventions" sub="Répartition actuelle" theme={theme} />
              <ResponsiveContainer width="100%" height={chartH}>
                <PieChart>
                  <Pie
                    data={[
                      { name:"Planifiées",  value:s.interventions_planifiees },
                      { name:"En cours",    value:s.interventions_en_cours   },
                      { name:"Terminées",   value:s.interventions_terminees  },
                    ]}
                    cx="50%" cy="50%" innerRadius={pieInner} outerRadius={pieR} dataKey="value" paddingAngle={3}
                    label={!bp.sm ? ({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%` : false}
                    labelLine={!bp.sm}>
                    {[PALETTE.info, PALETTE.warning, PALETTE.success].map((c,i) => <Cell key={i} fill={c} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background:dark?"#1c2333":"#fff", border:`1px solid ${theme.border}`, borderRadius:8, fontSize:"0.78rem" }} />
                  {bp.sm && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:"0.72rem" }} />}
                </PieChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {/* ── Progression statuts ── */}
      <div style={g(bp.md ? "1fr" : "1fr 1fr")}>
        {hasPermission("interventions") && s.interventions_total > 0 && (
          <Card theme={theme}>
            <SectionTitle title="Interventions" sub="Répartition par statut" theme={theme} />
            <ProgressBar label="Planifiées" value={s.interventions_planifiees} max={s.interventions_total} color={PALETTE.info}    theme={theme} />
            <ProgressBar label="En cours"   value={s.interventions_en_cours}   max={s.interventions_total} color={PALETTE.warning} theme={theme} />
            <ProgressBar label="Terminées"  value={s.interventions_terminees}  max={s.interventions_total} color={PALETTE.success} theme={theme} />
            <button onClick={() => navigate("/dashboard/interventions")} style={{ marginTop:"0.5rem", fontSize:"0.78rem", color:PALETTE.primary, background:"none", border:"none", cursor:"pointer", padding:0, fontFamily:FONTS.body }}>
              Voir toutes les interventions →
            </button>
          </Card>
        )}
        {hasPermission("installations") && s.installations_total > 0 && (
          <Card theme={theme}>
            <SectionTitle title="Installations" sub="Répartition par statut" theme={theme} />
            <ProgressBar label="En attente" value={s.installations_en_attente} max={s.installations_total} color={PALETTE.info}    theme={theme} />
            <ProgressBar label="En cours"   value={s.installations_en_cours}   max={s.installations_total} color={PALETTE.warning} theme={theme} />
            <ProgressBar label="Terminées"  value={s.installations_terminees}  max={s.installations_total} color={PALETTE.success} theme={theme} />
            <button onClick={() => navigate("/dashboard/installations")} style={{ marginTop:"0.5rem", fontSize:"0.78rem", color:PALETTE.primary, background:"none", border:"none", cursor:"pointer", padding:0, fontFamily:FONTS.body }}>
              Voir toutes les installations →
            </button>
          </Card>
        )}
        {isAdmin && (
          <Card theme={theme}>
            <SectionTitle title="Finances" sub="Facturation & installations" theme={theme} />
            <div style={g("1fr 1fr","0.55rem")}>
              {[
                { l:"CA factures",        v:`${fmt(s.montant_factures_total)} F`,  c:PALETTE.success },
                { l:"Factures en attente",v:`${fmt(s.montant_en_attente)} F`,       c:PALETTE.warning },
                { l:"Avances reçues",     v:`${fmt(s.montant_avance_total)} F`,    c:PALETTE.info    },
                { l:"Reste à percevoir",  v:`${fmt(s.montant_restant_total)} F`,   c:PALETTE.danger  },
              ].map(it => (
                <div key={it.l} style={{ background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.025)", borderRadius:10, padding:"0.6rem 0.75rem" }}>
                  <div style={{ fontSize:"0.65rem", color:theme.textMuted, marginBottom:"0.2rem" }}>{it.l}</div>
                  <div style={{ fontSize:"0.88rem", fontWeight:700, color:it.c, fontFamily:FONTS.display }}>{it.v}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* ── Performance commerciaux ── */}
      {s.perf_commerciaux.length > 0 && (isAdmin || hasPermission("clients")) && (
        <>
          <SectionTitle title="Performance commerciaux" sub={`Ce mois · ${s.perf_commerciaux.length} agent${s.perf_commerciaux.length>1?"s":""}`} theme={theme} />
          <div style={g(bp.xs?"1fr":bp.sm?"1fr":bp.md?"repeat(2,1fr)":"repeat(3,1fr)", "0.75rem")}>
            {s.perf_commerciaux.map(p => (
              <PerfCard key={p.id} name={p.name} dark={dark} theme={theme}
                mainPct={p.taux_succes} pctLabel="Taux de contact" pctColor={p.taux_succes>=60?PALETTE.success:p.taux_succes>=40?PALETTE.warning:PALETTE.danger}
                lines={[
                  { label:"Appels",       value:p.appels,      color:theme.textPrimary },
                  { label:"Joints",       value:p.joints,      color:PALETTE.success   },
                  { label:"Installations",value:p.inst_mois,   color:PALETTE.primary   },
                  { label:"Conversions",  value:p.conversions, color:PALETTE.warning   },
                ]}
              />
            ))}
          </div>
          {/* Bar chart comparatif des appels */}
          {s.perf_commerciaux.length > 1 && !bp.sm && (
            <Card theme={theme} style={{ marginBottom:"1.25rem" }}>
              <SectionTitle title="Comparaison — Appels ce mois" theme={theme} />
              <ResponsiveContainer width="100%" height={Math.max(chartH, s.perf_commerciaux.length * 42)}>
                <BarChart data={s.perf_commerciaux} layout="vertical" margin={{ top:4, right:16, left:10, bottom:0 }} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.border} horizontal={false} />
                  <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:theme.textMuted }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip {...tipStyle} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:"0.75rem" }} />
                  <Bar dataKey="appels"    name="Appels"        fill={PALETTE.info}    radius={[0,4,4,0]} />
                  <Bar dataKey="joints"    name="Joints"        fill={PALETTE.success} radius={[0,4,4,0]} />
                  <Bar dataKey="inst_mois" name="Installations" fill={PALETTE.primary} radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}

      {/* ── Performance techniciens ── */}
      {s.perf_techniciens.length > 0 && (isAdmin || hasPermission("interventions")) && (
        <>
          <SectionTitle title="Performance techniciens" sub={`Global · ${s.perf_techniciens.length} technicien${s.perf_techniciens.length>1?"s":""}`} theme={theme} />
          <div style={g(bp.xs?"1fr":bp.sm?"1fr":bp.md?"repeat(2,1fr)":"repeat(3,1fr)", "0.75rem")}>
            {s.perf_techniciens.map(p => (
              <PerfCard key={p.id} name={p.name} dark={dark} theme={theme}
                mainPct={p.taux_completion} pctLabel="Taux de complétion" pctColor={p.taux_completion>=70?PALETTE.success:p.taux_completion>=40?PALETTE.warning:PALETTE.danger}
                lines={[
                  { label:"Interv. total",    value:p.interv_total,     color:theme.textPrimary },
                  { label:"Terminées",         value:p.interv_terminees, color:PALETTE.success   },
                  { label:"Ce mois",           value:p.interv_mois,      color:PALETTE.primary   },
                  { label:"Installations",     value:p.inst_total,       color:PALETTE.warning   },
                ]}
              />
            ))}
          </div>
          {/* Bar chart comparatif techniciens */}
          {s.perf_techniciens.length > 1 && !bp.sm && (
            <Card theme={theme} style={{ marginBottom:"1.25rem" }}>
              <SectionTitle title="Comparaison — Interventions par technicien" theme={theme} />
              <ResponsiveContainer width="100%" height={Math.max(chartH, s.perf_techniciens.length * 42)}>
                <BarChart data={s.perf_techniciens} layout="vertical" margin={{ top:4, right:16, left:10, bottom:0 }} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.border} horizontal={false} />
                  <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:theme.textMuted }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip {...tipStyle} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:"0.75rem" }} />
                  <Bar dataKey="interv_total"     name="Total"      fill={PALETTE.info}    radius={[0,4,4,0]} />
                  <Bar dataKey="interv_terminees" name="Terminées"  fill={PALETTE.success} radius={[0,4,4,0]} />
                  <Bar dataKey="inst_total"       name="Installations" fill={PALETTE.primary} radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}

      {/* ── Activité récente ── */}
      <Card theme={theme}>
        <SectionTitle title="Activité récente" theme={theme} />
        {s.recent_activity.length === 0
          ? <p style={{ fontSize:"0.85rem", color:theme.textMuted, padding:"0.5rem 0" }}>Aucune activité récente.</p>
          : s.recent_activity.map((a,i) => <ActivityItem key={i} title={a.title} sub={a.sub} time={a.time} dot={a.dot} theme={theme} />)
        }
      </Card>

      </>)}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
