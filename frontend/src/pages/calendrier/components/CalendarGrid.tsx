// src/pages/calendar/components/CalendarGrid.tsx
import { type LayoutContext } from "../../../layouts/MainLayout";
import { type CalendarEvent } from "../../../services/calendarService";
import { FONTS, RADIUS } from "../../../theme";

interface Props {
  dark: boolean; theme: LayoutContext["theme"];
  year: number; month: number;
  events: CalendarEvent[]; loading: boolean;
  onDayClick:   (date: string)                              => void;
  onEventClick: (event: CalendarEvent)                      => void;
  onMoreClick:  (date: string, events: CalendarEvent[])     => void;
}

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// Couleurs cycliques pour les événements
const EVENT_COLORS = [
  { bg: "rgba(79,70,229,0.12)", text: "#4f46e5", border: "#4f46e5" },
  { bg: "rgba(16,185,129,0.12)",text: "#10b981", border: "#10b981" },
  { bg: "rgba(245,158,11,0.12)",text: "#f59e0b", border: "#f59e0b" },
  { bg: "rgba(239,68,68,0.1)",  text: "#ef4444", border: "#ef4444" },
  { bg: "rgba(59,130,246,0.12)",text: "#3b82f6", border: "#3b82f6" },
  { bg: "rgba(168,85,247,0.12)",text: "#a855f7", border: "#a855f7" },
];

function getEventColor(id: number) {
  return EVENT_COLORS[id % EVENT_COLORS.length];
}

function buildGrid(year: number, month: number): (Date | null)[] {
  const first   = new Date(year, month - 1, 1);
  const last    = new Date(year, month, 0);
  // Lundi = 0, ..., Dimanche = 6
  const startDow = (first.getDay() + 6) % 7; // convertit dimanche=0 → 6
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month - 1, d));
  // Remplir jusqu'à 42 cellules (6 lignes × 7 colonnes)
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default function CalendarGrid({ dark, theme, year, month, events, loading, onDayClick, onEventClick, onMoreClick }: Props) {
  const cells = buildGrid(year, month);
  const today = toISO(new Date());

  const eventsForDay = (date: Date): CalendarEvent[] => {
    const iso = toISO(date);
    return events.filter(e => e.start.startsWith(iso));
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4rem", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "16px" }}>
        <div style={{ width: 32, height: 32, border: "3px solid rgba(79,70,229,0.2)", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "16px", overflow: "hidden" }}>
      {/* En-têtes jours */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: `1px solid ${theme.border}` }}>
        {DAYS_FR.map(d => (
          <div key={d} style={{ padding: "0.65rem", textAlign: "center", fontSize: "0.72rem", fontWeight: 700, color: d === "Sam" || d === "Dim" ? "#ef4444" : theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Cellules */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
        {cells.map((date, idx) => {
          if (!date) {
            return (
              <div key={`empty-${idx}`} style={{ minHeight: 100, borderRight: (idx + 1) % 7 !== 0 ? `1px solid ${theme.border}` : "none", borderBottom: `1px solid ${theme.border}`, background: dark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)" }} />
            );
          }
          const iso      = toISO(date);
          const isToday  = iso === today;
          const isWeekend= date.getDay() === 0 || date.getDay() === 6;
          const dayEvents= eventsForDay(date);

          return (
            <div key={iso}
              onClick={() => onDayClick(iso)}
              style={{ minHeight: 100, padding: "0.45rem", borderRight: (idx + 1) % 7 !== 0 ? `1px solid ${theme.border}` : "none", borderBottom: `1px solid ${theme.border}`, cursor: "pointer", transition: "background 0.1s", background: isToday ? (dark ? "rgba(79,70,229,0.08)" : "rgba(79,70,229,0.04)") : isWeekend ? (dark ? "rgba(239,68,68,0.03)" : "rgba(239,68,68,0.02)") : "transparent", position: "relative" }}
              onMouseEnter={e => !isToday && (e.currentTarget.style.background = theme.cardBgHover)}
              onMouseLeave={e => (e.currentTarget.style.background = isToday ? (dark ? "rgba(79,70,229,0.08)" : "rgba(79,70,229,0.04)") : isWeekend ? (dark ? "rgba(239,68,68,0.03)" : "rgba(239,68,68,0.02)") : "transparent")}
            >
              {/* Numéro du jour */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.25rem" }}>
                <span style={{
                  width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.8rem", fontWeight: isToday ? 700 : 400,
                  background: isToday ? "#4f46e5" : "transparent",
                  color: isToday ? "#fff" : isWeekend ? "#ef4444" : theme.textSecondary,
                }}>
                  {date.getDate()}
                </span>
              </div>

              {/* Événements du jour */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {dayEvents.slice(0, 3).map(ev => {
                  const col = getEventColor(ev.id);
                  return (
                    <div key={ev.id}
                      onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                      title={ev.title}
                      style={{ padding: "1px 5px", borderRadius: 4, background: col.bg, color: col.text, fontSize: "0.68rem", fontWeight: 600, borderLeft: `3px solid ${col.border}`, cursor: "pointer", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>
                      {ev.google_synced && <span style={{ marginRight: 2, opacity: 0.7 }}>🔄</span>}
                      {ev.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div
                    onClick={e => { e.stopPropagation(); onMoreClick(iso, dayEvents); }}
                    style={{ fontSize: "0.65rem", color: "#4f46e5", paddingLeft: 4, cursor: "pointer", fontWeight: 600, textDecoration: "underline" }}
                  >
                    +{dayEvents.length - 3} de plus
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}