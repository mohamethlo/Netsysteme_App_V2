// src/services/calendarService.ts
import api from "./api";

export interface CalendarEvent {
  id:               number;
  title:            string;
  start:            string;   // "2026-04-05" ou "2026-04-05T09:00:00"
  all_day:          boolean;
  google_event_id:  string | null;
  google_synced:    boolean;
  synced_at:        string | null;
  last_sync_error:  string | null;
  created_at:       string;
  created_by:       number | null;
  created_by_name:  string | null;
}

export interface CalendarStats {
  total:    number;
  synced:   number;
  upcoming: number;
  today:    number;
}

const J = { "Content-Type": "application/json" };

export const calendarService = {
  // ── CRUD ──────────────────────────────────────────────────────────────────
  getAll: (params?: { start?: string; end?: string }) =>
    api.get<CalendarEvent[]>("/calendrier/events/", { params }).then(r => r.data),

  getByMonth: (year: number, month: number) =>
    api.get<CalendarEvent[]>("/calendrier/events/month/", { params: { year, month } }).then(r => r.data),

  getById: (id: number) =>
    api.get<CalendarEvent>(`/calendrier/events/${id}/`).then(r => r.data),

  create: (data: { title: string; start: string; all_day?: boolean }) =>
    api.post<CalendarEvent>("/calendrier/events/", data, { headers: J }).then(r => r.data),

  update: (id: number, data: Partial<{ title: string; start: string; all_day: boolean }>) =>
    api.patch<CalendarEvent>(`/calendrier/events/${id}/`, data, { headers: J }).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/calendrier/events/${id}/`).then(r => r.data),

  // ── Stats ─────────────────────────────────────────────────────────────────
  getStats: () =>
    api.get<CalendarStats>("/calendrier/events/stats/").then(r => r.data),

  // ── Google Sync ───────────────────────────────────────────────────────────
  syncOne: (id: number) =>
    api.post<{ success: boolean; message: string }>(
      `/calendrier/events/${id}/sync-google/`, {}, { headers: J }
    ).then(r => r.data),

  syncAll: () =>
    api.post<{ success: boolean; message: string; synced: number; failed: number }>(
      "/calendrier/events/sync-all/", {}, { headers: J }
    ).then(r => r.data),
};