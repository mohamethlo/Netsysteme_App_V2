// src/pages/calendar/components/EventModal.tsx
import { useState } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { type CalendarEvent } from "../../../services/calendarService";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark: boolean; theme: LayoutContext["theme"];
  mode:        "create" | "edit" | "view";
  event?:      CalendarEvent;
  defaultDate?: string;
  onClose:     () => void;
  onCreate:    (data: { title: string; start: string; all_day: boolean }) => Promise<void>;
  onUpdate:    (id: number, data: Partial<CalendarEvent>) => Promise<void>;
  onDelete:    (id: number) => Promise<void>;
  onSyncGoogle:(id: number) => Promise<void>;
}

export default function EventModal({ dark, theme, mode, event, defaultDate, onClose, onCreate, onUpdate, onDelete, onSyncGoogle }: Props) {
  const [title,    setTitle]   = useState(event?.title    ?? "");
  const [start,    setStart]   = useState(
    event?.start?.substring(0, 16) ??
    (defaultDate ? `${defaultDate}T09:00` : new Date().toISOString().substring(0, 16))
  );
  const [allDay,   setAllDay]  = useState(event?.all_day  ?? false);
  const [editing,  setEditing] = useState(mode === "create" || mode === "edit");
  const [busy,     setBusy]    = useState(false);
  const [syncing,  setSyncing] = useState(false);

  const isView = mode === "view" && !editing;

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const startVal = allDay ? start.substring(0, 10) : start;
      if (mode === "create" || (mode === "view" && editing && !event)) {
        await onCreate({ title: title.trim(), start: startVal, all_day: allDay });
      } else if (event) {
        await onUpdate(event.id, { title: title.trim(), start: startVal, all_day: allDay });
      }
    } finally { setBusy(false); }
  };

  const handleSync = async () => {
    if (!event) return;
    setSyncing(true);
    try { await onSyncGoogle(event.id); }
    finally { setSyncing(false); }
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.6rem 0.85rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box",
  };

  const TITLE_MAP = { create: "➕ Nouvel événement", edit: "✏️ Modifier", view: "📅 Événement" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 460, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg,rgba(79,70,229,0.08),rgba(124,58,237,0.04))", borderRadius: "18px 18px 0 0" }}>
          <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: theme.textPrimary, margin: 0 }}>
            {TITLE_MAP[mode]}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.5rem" }}>
          {isView && event ? (
            // ── Mode visualisation ───────────────────────────────────────────
            <div>
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Titre</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: theme.textPrimary }}>{event.title}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Date / Heure</div>
                  <div style={{ fontSize: "0.875rem", color: theme.textSecondary }}>
                    {event.all_day
                      ? new Date(event.start + "T00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
                      : new Date(event.start).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Toute la journée</div>
                  <div>{event.all_day ? "✅ Oui" : "Non"}</div>
                </div>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Google Calendar</div>
                {event.google_synced
                  ? <span style={{ fontSize: "0.78rem", padding: "2px 8px", borderRadius: 99, background: "rgba(16,185,129,0.12)", color: "#10b981", fontWeight: 600 }}>✅ Synchronisé{event.synced_at ? ` · ${new Date(event.synced_at).toLocaleDateString("fr-FR")}` : ""}</span>
                  : <span style={{ fontSize: "0.78rem", padding: "2px 8px", borderRadius: 99, background: "rgba(107,114,128,0.1)", color: theme.textMuted }}>Non synchronisé</span>}
                {event.last_sync_error && (
                  <div style={{ marginTop: 4, fontSize: "0.72rem", color: "#ef4444" }}>⚠️ {event.last_sync_error}</div>
                )}
              </div>
              {event.created_by_name && (
                <div style={{ fontSize: "0.72rem", color: theme.textMuted }}>
                  Créé par {event.created_by_name} · {new Date(event.created_at).toLocaleDateString("fr-FR")}
                </div>
              )}
            </div>
          ) : (
            // ── Mode formulaire ──────────────────────────────────────────────
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Titre *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nom de l'événement…" style={inp} autoFocus />
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", display: "block", marginBottom: 5 }}>
                  {allDay ? "Date" : "Date et heure"} *
                </label>
                <input
                  type={allDay ? "date" : "datetime-local"}
                  value={allDay ? start.substring(0, 10) : start}
                  onChange={e => setStart(e.target.value)}
                  style={inp}
                />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", color: theme.textSecondary }}>
                <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer" }} />
                Événement toute la journée
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "0.85rem 1.5rem", borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {event && isView && (
              <>
                <button onClick={() => setEditing(true)}
                  style={{ padding: "0.48rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body }}>
                  ✏️ Modifier
                </button>
                <button onClick={handleSync} disabled={syncing}
                  style={{ padding: "0.48rem 0.85rem", borderRadius: RADIUS.md, border: "1px solid rgba(59,130,246,0.4)", background: "transparent", color: "#3b82f6", fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body, opacity: syncing ? 0.6 : 1 }}>
                  {syncing ? "Sync…" : "🔄 Google"}
                </button>
                <button onClick={() => onDelete(event.id)}
                  style={{ padding: "0.48rem 0.85rem", borderRadius: RADIUS.md, border: "1px solid rgba(239,68,68,0.4)", background: "transparent", color: "#ef4444", fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body }}>
                  🗑 Supprimer
                </button>
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto" }}>
            <button onClick={isView && !editing ? onClose : () => { if (editing && event) setEditing(false); else onClose(); }}
              style={{ padding: "0.5rem 1.1rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
              {isView ? "Fermer" : "Annuler"}
            </button>
            {!isView && (
              <button onClick={handleSubmit} disabled={busy || !title.trim()}
                style={{ padding: "0.5rem 1.25rem", borderRadius: RADIUS.md, border: "none", background: busy || !title.trim() ? theme.border : `linear-gradient(135deg,#4f46e5,#7c3aed)`, color: busy || !title.trim() ? theme.textMuted : "#fff", fontSize: "0.875rem", fontWeight: 700, cursor: busy || !title.trim() ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
                {busy ? "Sauvegarde…" : mode === "create" ? "Créer" : "Sauvegarder"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}