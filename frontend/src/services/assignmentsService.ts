// src/services/assignmentsService.ts
import api from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface TechnicianRow {
  id:                    number;
  name:                  string;
  phone:                 string;
  email:                 string;
  is_present:            boolean;
  active_location:       string | null;
  active_assignment_id:  number | null;
  check_in_time:         string | null;
}

export interface DailyReportEntry {
  technician: {
    id:                number;
    name:              string;
    phone:             string;
    assigned_location: string;
    assignment_status: "assigned" | "available" | "absent";
  };
  status:            "present" | "absent";
  hours_worked:      number;
  pointage_location: string;
  assignments_count: number;
}

export interface DailyReport {
  daily_data:        DailyReportEntry[];
  selected_date:     string;
  total_technicians: number;
  present_count:     number;
  absent_count:      number;
  presence_rate:     number;
  total_hours:       number;
  avg_hours:         number;
  is_future_date:    boolean;
}

export interface AssignmentHistoryItem {
  id:               number;
  location:         string;
  assigned_at:      string;
  unassigned_at:    string;
  duration_minutes: number;
  duration_hours:   number;
  is_active:        boolean;
}

const JSON_H = { "Content-Type": "application/json" };

export const assignmentsService = {
  // ── Rapport quotidien ────────────────────────────────────────────────────
  getDailyReport: (date?: string) =>
    api.get<DailyReport>("/assignments/daily-report/", { params: date ? { date } : {} })
       .then(r => r.data),

  // ── Liste techniciens enrichie ───────────────────────────────────────────
  getTechnicians: (date?: string) =>
    api.get<{ technicians: TechnicianRow[]; date: string }>(
      "/assignments/technicians/", { params: date ? { date } : {} }
    ).then(r => r.data),

  // ── Affecter ─────────────────────────────────────────────────────────────
  assign: (payload: {
    technician_id: number;
    location_id:   number | null;
    date?:         string;
    sms_domain?:   "NETSYSTEME" | "SSE";
  }) =>
    api.post<{
      success:    boolean;
      message:    string;
      sms_sent:   boolean;
      sms_error?: string;
    }>("/assignments/assign/", payload, { headers: JSON_H }).then(r => r.data),

  // ── Historique ────────────────────────────────────────────────────────────
  getHistory: (technician_id: number, date: string) =>
    api.get<{
      success:       boolean;
      assignments:   AssignmentHistoryItem[];
      total_minutes: number;
      total_hours:   number;
    }>("/assignments/history/", { params: { technician_id, date } }).then(r => r.data),
};