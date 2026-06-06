// src/pages/calendar/CalendarPage.tsx
import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import { calendarService, type CalendarEvent, type CalendarStats } from "../../services/calendarService";
import { useSwal } from "../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../theme";
import CalendarGrid  from "./components/CalendarGrid";
import EventModal    from "./components/EventModal";

export default function CalendarPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const swal = useSwal();
  const now  = new Date();

  const [year,    setYear]    = useState(now.getFullYear());
  const [month,   setMonth]   = useState(now.getMonth() + 1);
  const [events,  setEvents]  = useState<CalendarEvent[]>([]);
  const [stats,   setStats]   = useState<CalendarStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal,    setModal]    = useState<{ mode: "create" | "edit" | "view"; event?: CalendarEvent; date?: string } | null>(null);
  const [dayPopup, setDayPopup] = useState<{ date: string; events: CalendarEvent[] } | null>(null);
  const [syncing,  setSyncing]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [evts, st] = await Promise.all([
        calendarService.getByMonth(year, month),
        calendarService.getStats(),
      ]);
      setEvents(Array.isArray(evts) ? evts : []);
      setStats(st);
    } catch { swal.serverError(); } finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: { title: string; start: string; all_day: boolean }) => {
    try {
      await calendarService.create(data);
      swal.success("Événement créé !");
      setModal(null);
      load();
    } catch (e: any) {
      swal.error("Erreur", e?.response?.data?.title?.[0] ?? "Erreur lors de la création.");
    }
  };

  const handleUpdate = async (id: number, data: Partial<CalendarEvent>) => {
    try {
      await calendarService.update(id, data);
      swal.success("Événement modifié !");
      setModal(null);
      load();
    } catch { swal.serverError(); }
  };

  const handleDelete = async (id: number) => {
    if (!await swal.confirm({ title: "Supprimer cet événement ?", confirmText: "Supprimer", icon: "warning" })) return;
    try {
      await calendarService.delete(id);
      setModal(null);
      load();
    } catch { swal.serverError(); }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const r = await calendarService.syncAll();
      swal.success(r.message);
      load();
    } catch { swal.error("Erreur", "Impossible de synchroniser avec Google Calendar."); }
    finally { setSyncing(false); }
  };

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                     "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  return (
    <div style={{ fontFamily: FONTS.body }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", borderRadius: "16px", padding: "1.75rem 2rem", marginBottom: "1.5rem", color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: "-1rem", top: "-1rem", fontSize: "8rem", opacity: 0.07, pointerEvents: "none" }}>📅</div>
        <h1 style={{ fontFamily: FONTS.display, fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>Calendrier</h1>
        <p style={{ fontSize: "0.875rem", opacity: 0.85, margin: 0 }}>Planifiez et synchronisez vos événements avec Google Calendar</p>
      </div>

      {/* KPIs */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
          {[
            { label: "Total événements", value: stats.total,    icon: "📋", color: "#4f46e5" },
            { label: "Aujourd'hui",      value: stats.today,    icon: "⭐", color: "#f59e0b" },
            { label: "À venir",          value: stats.upcoming, icon: "🔜", color: "#10b981" },
            { label: "Sync Google",      value: stats.synced,   icon: "🔄", color: "#3b82f6" },
          ].map(k => (
            <div key={k.label} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
              <div style={{ width: 38, height: 38, borderRadius: "9px", background: k.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>{k.icon}</div>
              <div>
                <div style={{ fontSize: "0.65rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{k.label}</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1.1 }}>{k.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Barre de navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button onClick={prevMonth} style={{ padding: "0.5rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, cursor: "pointer", fontFamily: FONTS.body, fontSize: "1rem" }}>‹</button>
          <h2 style={{ fontFamily: FONTS.display, fontSize: "1.2rem", fontWeight: 700, color: theme.textPrimary, margin: 0, minWidth: 120, textAlign: "center" }}>
            {MONTHS_FR[month - 1]}
          </h2>
          <button onClick={nextMonth} style={{ padding: "0.5rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, cursor: "pointer", fontFamily: FONTS.body, fontSize: "1rem" }}>›</button>

          {/* Sélecteur d'année */}
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ padding: "0.45rem 0.6rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.cardBg, color: theme.textPrimary, fontFamily: FONTS.body, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", outline: "none" }}
          >
            {Array.from({ length: now.getFullYear() - 2019 + 2 }, (_, i) => 2020 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }}
            style={{ padding: "0.45rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: "pointer", fontFamily: FONTS.body, fontSize: "0.78rem" }}>
            Aujourd'hui
          </button>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={handleSyncAll} disabled={syncing}
            style={{ padding: "0.5rem 1rem", borderRadius: RADIUS.md, border: "1px solid rgba(59,130,246,0.4)", background: "transparent", color: "#3b82f6", fontSize: "0.82rem", cursor: syncing ? "not-allowed" : "pointer", fontFamily: FONTS.body, opacity: syncing ? 0.6 : 1 }}>
            {syncing ? "Sync…" : "🔄 Google Sync"}
          </button>
          <button onClick={() => setModal({ mode: "create" })}
            style={{ padding: "0.5rem 1.25rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,#4f46e5,#7c3aed)`, color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", fontFamily: FONTS.body }}>
            ＋ Ajouter
          </button>
        </div>
      </div>

      {/* Grille calendrier */}
      <CalendarGrid
        dark={dark} theme={theme}
        year={year} month={month}
        events={events} loading={loading}
        onDayClick={date => setModal({ mode: "create", date })}
        onEventClick={ev => setModal({ mode: "view", event: ev })}
        onMoreClick={(date, evts) => setDayPopup({ date, events: evts })}
      />

      {/* Popup "tous les événements du jour" */}
      {dayPopup && (
        <div
          onClick={() => setDayPopup(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 16, padding: "1.5rem", width: "100%", maxWidth: 420, maxHeight: "80vh", display: "flex", flexDirection: "column", gap: "0.75rem", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: "1rem", color: theme.textPrimary }}>
                {new Date(dayPopup.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </span>
              <button onClick={() => setDayPopup(null)} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: theme.textMuted }}>✕</button>
            </div>
            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {dayPopup.events.map(ev => (
                <div
                  key={ev.id}
                  onClick={() => { setDayPopup(null); setModal({ mode: "view", event: ev }); }}
                  style={{ padding: "0.6rem 0.85rem", borderRadius: 8, border: `1px solid ${theme.border}`, cursor: "pointer", background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)", color: theme.textPrimary, fontSize: "0.85rem", fontWeight: 500 }}
                  onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)")}
                >
                  <div style={{ fontWeight: 600 }}>{ev.google_synced ? "🔄 " : ""}{ev.title}</div>
                  {!ev.all_day && ev.start.includes("T") && (
                    <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: 2 }}>
                      {ev.start.slice(11, 16)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => { setDayPopup(null); setModal({ mode: "create", date: dayPopup.date }); }}
              style={{ padding: "0.5rem", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: FONTS.body, fontSize: "0.82rem" }}
            >
              ＋ Ajouter un événement ce jour
            </button>
          </div>
        </div>
      )}

      {/* Modal création / édition / visualisation */}
      {modal && (
        <EventModal
          dark={dark} theme={theme}
          mode={modal.mode}
          event={modal.event}
          defaultDate={modal.date}
          onClose={() => setModal(null)}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onSyncGoogle={async (id) => {
            const r = await calendarService.syncOne(id);
            if (r.success) { swal.success(r.message); load(); }
            else swal.error("Erreur sync", r.message);
          }}
        />
      )}
    </div>
  );
}