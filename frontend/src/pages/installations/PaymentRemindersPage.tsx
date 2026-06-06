// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/installations/PaymentRemindersPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import {
  installationsService,
  type ReminderDashboard,
  type ReminderDashboardEntry,
  type ReminderHistory,
  type ReminderStats,
} from "../../services/installationService";
import { useSwal } from "../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../theme";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

const TYPE_CFG = {
  j_minus_5: { label: "J-5",    color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  icon: "⏰" },
  j_minus_2: { label: "J-2",    color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  icon: "⚡" },
  j_day:     { label: "Jour J", color: "#ef4444", bg: "rgba(239,68,68,0.12)",   icon: "🔔" },
} as const;

const STATUS_CFG = {
  success:  { label: "Envoyé",    color: "#10b981", bg: "rgba(16,185,129,0.12)"  },
  failed:   { label: "Échoué",    color: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
  pending:  { label: "En attente",color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  dry_run:  { label: "Simulation",color: "#8b5cf6", bg: "rgba(139,92,246,0.12)"  },
  skipped:  { label: "Ignoré",    color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
} as const;

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon, sub, theme }: {
  label: string; value: string | number; color: string;
  icon: string; sub?: string;
  theme: LayoutContext["theme"];
}) {
  return (
    <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.85rem" }}>
      <div style={{ width: 46, height: 46, borderRadius: "12px", background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: "0.72rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: "1.45rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────
function TabBtn({ label, active, count, color, icon, onClick, theme }: {
  label: string; active: boolean; count: number;
  color: string; icon: string; onClick: () => void;
  theme: LayoutContext["theme"];
}) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: "0.45rem", padding: "0.55rem 1rem", borderRadius: RADIUS.md, border: active ? `1.5px solid ${color}` : `1px solid ${theme.border}`, background: active ? color + "15" : "transparent", color: active ? color : theme.textMuted, fontWeight: active ? 700 : 400, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body, transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0 }}>
      {icon} {label}
      <span style={{ padding: "1px 7px", borderRadius: RADIUS.full, background: active ? color + "25" : theme.border, color: active ? color : theme.textMuted, fontSize: "0.72rem", fontWeight: 700 }}>{count}</span>
    </button>
  );
}

// ── Reminder table ────────────────────────────────────────────────────────────
function ReminderTable({ entries, color, theme, onSendManual, sending }: {
  entries: ReminderDashboardEntry[];
  color: string;
  theme: LayoutContext["theme"];
  onSendManual: (id: number, date: string) => void;
  sending: number | null;
}) {
  if (entries.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 2rem", color: theme.textMuted }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>✅</div>
        <div style={{ fontWeight: 600, color: theme.textPrimary }}>Aucun rappel pour cette période</div>
      </div>
    );
  }

  return (
    <>
      {/* ── Table (≥640px) ── */}
      <div className="rmd-table" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
              {["Client", "Téléphone", "Tranche", "Montant tranche", "Montant restant", "Échéance", "Action"].map(h => (
                <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.7rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.installation_id + e.payment_date}
                style={{ borderBottom: i < entries.length - 1 ? `1px solid ${theme.border}` : "none" }}
                onMouseEnter={ev => (ev.currentTarget.style.background = theme.cardBgHover)}
                onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: "0.85rem 1rem", fontWeight: 600, color: theme.textPrimary }}>{e.client}</td>
                <td style={{ padding: "0.85rem 1rem", color: theme.textMuted }}>{e.phone || "—"}</td>
                <td style={{ padding: "0.85rem 1rem" }}>
                  <span style={{ padding: "2px 8px", borderRadius: RADIUS.full, background: color + "18", color, fontSize: "0.75rem", fontWeight: 600 }}>{e.payment_label}</span>
                </td>
                <td style={{ padding: "0.85rem 1rem", fontWeight: 600, color: theme.textPrimary, whiteSpace: "nowrap" }}>{fmt(e.payment_amount)} F</td>
                <td style={{ padding: "0.85rem 1rem", fontWeight: 600, color: "#ef4444", whiteSpace: "nowrap" }}>{fmt(e.montant_restant)} F</td>
                <td style={{ padding: "0.85rem 1rem", color: theme.textMuted, whiteSpace: "nowrap" }}>
                  {new Date(e.payment_date).toLocaleDateString("fr-FR")}
                </td>
                <td style={{ padding: "0.85rem 1rem" }}>
                  <button
                    onClick={() => onSendManual(e.installation_id, e.payment_date)}
                    disabled={sending === e.installation_id}
                    style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.35rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${color}44`, background: "transparent", color, fontSize: "0.78rem", fontWeight: 600, cursor: sending === e.installation_id ? "not-allowed" : "pointer", fontFamily: FONTS.body, opacity: sending === e.installation_id ? 0.5 : 1 }}>
                    {sending === e.installation_id ? "…" : "📱 Envoyer"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* ── Cartes mobiles (<640px) ── */}
      <div className="rmd-cards">
        {entries.map((e, i) => (
          <div key={e.installation_id + e.payment_date} style={{ padding: "0.85rem 1rem", borderBottom: i < entries.length - 1 ? `1px solid ${theme.border}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.3rem" }}>
              <div style={{ fontWeight: 600, color: theme.textPrimary, fontSize: "0.875rem" }}>{e.client}</div>
              <span style={{ padding: "2px 8px", borderRadius: RADIUS.full, background: color + "18", color, fontSize: "0.72rem", fontWeight: 600 }}>{e.payment_label}</span>
            </div>
            <div style={{ fontSize: "0.78rem", color: theme.textMuted, marginBottom: "0.3rem" }}>{e.phone || "—"} · {new Date(e.payment_date).toLocaleDateString("fr-FR")}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "#ef4444", fontWeight: 600 }}>Reste : {fmt(e.montant_restant)} F</span>
              <button onClick={() => onSendManual(e.installation_id, e.payment_date)} disabled={sending === e.installation_id}
                style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.35rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${color}44`, background: "transparent", color, fontSize: "0.78rem", fontWeight: 600, cursor: sending === e.installation_id ? "not-allowed" : "pointer", fontFamily: FONTS.body, opacity: sending === e.installation_id ? 0.5 : 1 }}>
                {sending === e.installation_id ? "…" : "📱 Envoyer"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Historique table ──────────────────────────────────────────────────────────
function HistoryTable({ entries, theme }: { entries: ReminderHistory[]; theme: LayoutContext["theme"] }) {
  if (entries.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 2rem", color: theme.textMuted }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📭</div>
        <div style={{ fontWeight: 600, color: theme.textPrimary }}>Aucun historique</div>
      </div>
    );
  }

  const typeLabel = (tpl: string) => {
    if (tpl.includes("j_minus_5")) return { label: "J-5", color: "#f59e0b" };
    if (tpl.includes("j_minus_2")) return { label: "J-2", color: "#3b82f6" };
    if (tpl.includes("j_day"))     return { label: "Jour J", color: "#ef4444" };
    if (tpl.includes("manuel"))    return { label: "Manuel", color: "#8b5cf6" };
    return { label: tpl, color: "#6b7280" };
  };

  return (
    <>
      <div className="rmd-table" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
              {["Destinataire", "Téléphone", "Type", "Statut", "Date d'envoi", "Échéance paiement"].map(h => (
                <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.7rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const tl = typeLabel(e.message_template || "");
              const sc = STATUS_CFG[e.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.pending;
              const pd = e.extra_data?.payment_date;
              return (
                <tr key={e.id}
                  style={{ borderBottom: i < entries.length - 1 ? `1px solid ${theme.border}` : "none" }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = theme.cardBgHover)}
                  onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "0.85rem 1rem", fontWeight: 600, color: theme.textPrimary }}>{e.recipient_name || "—"}</td>
                  <td style={{ padding: "0.85rem 1rem", color: theme.textMuted }}>{e.phone}</td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <span style={{ padding: "2px 8px", borderRadius: RADIUS.full, background: tl.color + "18", color: tl.color, fontSize: "0.75rem", fontWeight: 600 }}>{tl.label}</span>
                  </td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <span style={{ padding: "2px 8px", borderRadius: RADIUS.full, background: sc.bg, color: sc.color, fontSize: "0.75rem", fontWeight: 600 }}>{sc.label}</span>
                  </td>
                  <td style={{ padding: "0.85rem 1rem", color: theme.textMuted, whiteSpace: "nowrap" }}>
                    {new Date(e.sent_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td style={{ padding: "0.85rem 1rem", color: theme.textMuted, whiteSpace: "nowrap" }}>
                    {pd ? new Date(pd).toLocaleDateString("fr-FR") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="rmd-cards">
        {entries.map((e, i) => {
          const tl = typeLabel(e.message_template || "");
          const sc = STATUS_CFG[e.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.pending;
          const pd = e.extra_data?.payment_date;
          return (
            <div key={e.id} style={{ padding: "0.85rem 1rem", borderBottom: i < entries.length - 1 ? `1px solid ${theme.border}` : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                <div style={{ fontWeight: 600, color: theme.textPrimary, fontSize: "0.875rem" }}>{e.recipient_name || "—"}</div>
                <span style={{ padding: "2px 8px", borderRadius: RADIUS.full, background: sc.bg, color: sc.color, fontSize: "0.72rem", fontWeight: 600 }}>{sc.label}</span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.75rem", color: theme.textMuted }}>{e.phone}</span>
                <span style={{ padding: "2px 7px", borderRadius: RADIUS.full, background: tl.color + "18", color: tl.color, fontSize: "0.72rem", fontWeight: 600 }}>{tl.label}</span>
                {pd && <span style={{ fontSize: "0.75rem", color: theme.textMuted }}>Éch. {new Date(pd).toLocaleDateString("fr-FR")}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
type ActiveTab = "j_minus_5" | "j_minus_2" | "j_day" | "history";

export default function PaymentRemindersPage() {
  const { theme } = useOutletContext<LayoutContext>();
  const swal      = useSwal();
  const navigate  = useNavigate();

  const [dashboard,  setDashboard]  = useState<ReminderDashboard | null>(null);
  const [history,    setHistory]    = useState<ReminderHistory[]>([]);
  const [stats,      setStats]      = useState<ReminderStats | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState<ActiveTab>("j_minus_5");
  const [histPeriod, setHistPeriod] = useState("all");
  const [sending,    setSending]    = useState<number | null>(null);
  const [checking,   setChecking]   = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, histRes, statsRes] = await Promise.all([
        installationsService.getRemindersDashboard(),
        installationsService.getRemindersHistory(histPeriod),
        installationsService.getRemindersStatistics(),
      ]);
      setDashboard(dash);
      setHistory(histRes.data);
      setStats(statsRes.statistics);
    } catch {
      swal.serverError();
    } finally {
      setLoading(false);
    }
  }, [histPeriod]);

  useEffect(() => { load(); }, [load]);

  // ── Envoyer les rappels ────────────────────────────────────────────────────
  const handleSendAll = async (dry_run: boolean) => {
    setChecking(true);
    try {
      const res = await installationsService.checkAndSendReminders(dry_run);
      if (res.success) {
        swal.success(dry_run ? "Simulation terminée" : "Rappels envoyés", res.message);
        if (!dry_run) load();
      } else {
        swal.error("Erreur", "Une erreur est survenue.");
      }
    } catch {
      swal.serverError();
    } finally {
      setChecking(false);
    }
  };

  // ── Envoi manuel ──────────────────────────────────────────────────────────
  const handleSendManual = async (id: number, payment_date: string) => {
    setSending(id);
    try {
      const res = await installationsService.sendManualReminder(id, payment_date);
      if (res.success) {
        swal.success("SMS envoyé", "Le rappel de paiement a été envoyé.");
        load();
      } else {
        swal.error("Échec", res.message || "L'envoi a échoué.");
      }
    } catch {
      swal.serverError();
    } finally {
      setSending(null);
    }
  };

  const tabs: { key: ActiveTab; label: string; color: string; icon: string; count: number }[] = [
    { key: "j_minus_5", label: "J-5",       color: TYPE_CFG.j_minus_5.color, icon: TYPE_CFG.j_minus_5.icon, count: dashboard?.j_minus_5.length ?? 0 },
    { key: "j_minus_2", label: "J-2",       color: TYPE_CFG.j_minus_2.color, icon: TYPE_CFG.j_minus_2.icon, count: dashboard?.j_minus_2.length ?? 0 },
    { key: "j_day",     label: "Jour J",    color: TYPE_CFG.j_day.color,     icon: TYPE_CFG.j_day.icon,     count: dashboard?.j_day.length ?? 0 },
    { key: "history",   label: "Historique",color: "#6b7280",                icon: "📋",                     count: history.length },
  ];

  const activeEntries: ReminderDashboardEntry[] =
    activeTab === "j_minus_5" ? (dashboard?.j_minus_5 ?? []) :
    activeTab === "j_minus_2" ? (dashboard?.j_minus_2 ?? []) :
    activeTab === "j_day"     ? (dashboard?.j_day     ?? []) : [];

  const activeColor =
    activeTab === "j_minus_5" ? TYPE_CFG.j_minus_5.color :
    activeTab === "j_minus_2" ? TYPE_CFG.j_minus_2.color :
    activeTab === "j_day"     ? TYPE_CFG.j_day.color     : "#6b7280";

  return (
    <div style={{ fontFamily: FONTS.body }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .rmd-table { display: none; }
        .rmd-cards { display: flex; flex-direction: column; gap: 0; }
        @media (min-width: 640px) {
          .rmd-table { display: block; }
          .rmd-cards { display: none; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button onClick={() => navigate("/dashboard/installations")}
            style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.45rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body }}>
            ← Installations
          </button>
          <div>
            <h1 style={{ fontFamily: FONTS.display, fontSize: "1.5rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>
              🔔 Rappels de paiement
            </h1>
            <p style={{ fontSize: "0.85rem", color: theme.textMuted, marginTop: 3 }}>
              Gestion des relances automatiques — J-5, J-2, Jour J
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button onClick={() => handleSendAll(true)} disabled={checking}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.62rem 1.1rem", borderRadius: RADIUS.md, border: `1px solid ${PALETTE.primary}55`, background: "transparent", color: PALETTE.primary, fontSize: "0.875rem", fontWeight: 600, cursor: checking ? "not-allowed" : "pointer", fontFamily: FONTS.body, opacity: checking ? 0.6 : 1 }}>
            👁 Simulation
          </button>
          <button onClick={() => handleSendAll(false)} disabled={checking}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.62rem 1.25rem", borderRadius: RADIUS.md, border: "none", background: checking ? "#6b7280" : `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: checking ? "not-allowed" : "pointer", fontFamily: FONTS.body, boxShadow: checking ? "none" : `0 0 20px ${PALETTE.primary}22` }}>
            {checking ? "Envoi…" : "📤 Envoyer les rappels"}
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <div style={{ width: 34, height: 34, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))", gap: "0.85rem", marginBottom: "1.75rem" }}>
            <StatCard label="J-5 (dans 5 jours)"  value={dashboard?.j_minus_5.length ?? 0} color={TYPE_CFG.j_minus_5.color} icon={TYPE_CFG.j_minus_5.icon} theme={theme} />
            <StatCard label="J-2 (dans 2 jours)"  value={dashboard?.j_minus_2.length ?? 0} color={TYPE_CFG.j_minus_2.color} icon={TYPE_CFG.j_minus_2.icon} theme={theme} />
            <StatCard label="Jour J (aujourd'hui)" value={dashboard?.j_day.length ?? 0}     color={TYPE_CFG.j_day.color}     icon={TYPE_CFG.j_day.icon}     theme={theme} />
            <StatCard label="Envoyés aujourd'hui"  value={dashboard?.reminders_sent_today ?? 0} color="#10b981" icon="✅" theme={theme} />
            {stats && (
              <>
                <StatCard label="Total envoyés"   value={stats.success}      color="#10b981"         icon="📨" sub="tous types" theme={theme} />
                <StatCard label="Taux de succès"  value={`${stats.success_rate}%`} color={PALETTE.primary} icon="📊" theme={theme} />
              </>
            )}
          </div>

          {/* ── Onglets ── */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "nowrap", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" as any, alignItems: "center" }}>
            {tabs.map(t => (
              <TabBtn key={t.key} label={t.label} active={activeTab === t.key} count={t.count} color={t.color} icon={t.icon} onClick={() => setActiveTab(t.key)} theme={theme} />
            ))}
            {activeTab === "history" && (
              <select value={histPeriod} onChange={e => setHistPeriod(e.target.value)}
                style={{ marginLeft: "auto", padding: "0.5rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, cursor: "pointer", flexShrink: 0 }}>
                <option value="all">Tout</option>
                <option value="today">Aujourd'hui</option>
                <option value="week">7 derniers jours</option>
                <option value="month">Ce mois</option>
              </select>
            )}
          </div>

          {/* ── Contenu ── */}
          <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
            {activeTab === "history" ? (
              <HistoryTable entries={history} theme={theme} />
            ) : (
              <ReminderTable
                entries={activeEntries}
                color={activeColor}
                theme={theme}
                onSendManual={handleSendManual}
                sending={sending}
              />
            )}
          </div>

          {/* ── Stats par type ── */}
          {stats && (
            <div style={{ marginTop: "1.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.85rem" }}>
              {(["j_minus_5", "j_minus_2", "j_day"] as const).map(type => {
                const cfg = TYPE_CFG[type];
                const count = stats.by_type[type];
                return (
                  <div key={type} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "0.85rem 1.1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "0.72rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Rappels {cfg.label}</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary }}>{count} envoyés</div>
                    </div>
                    <span style={{ fontSize: "1.5rem" }}>{cfg.icon}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
