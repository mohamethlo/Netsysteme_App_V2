// src/services/attendanceService.ts
import api from "./api";

export interface WorkLocation {
  created_at: string | number | Date;
  id:        number;
  name:      string;
  latitude:  number;
  longitude: number;
  radius:    number;
  address:   string | null;
  type:      "bureau" | "chantier";
  is_active: boolean;
}

export interface AttendanceUser {
  id:        number;
  prenom:    string;
  nom:       string;
  full_name: string;
  notes?:    string | null;
}

export interface Attendance {
  id:                  number;
  user:                number;
  user_detail:         AttendanceUser | null;
  date:                string;
  check_in:            string | null;
  check_out:           string | null;
  check_in_str:        string | null;
  check_out_str:       string | null;
  check_in_location:   string | null;
  check_out_location:  string | null;
  check_in_lat:        number | null;
  check_in_lng:        number | null;
  check_out_lat:       number | null;
  check_out_lng:       number | null;
  work_location:       number | null;
  work_location_name:  string | null;
  work_location_type:  string | null;
  status:              string;
  status_display:      string;
  notes:               string | null;
  total_hours:         number;
  is_late:             boolean;
  needs_justification: boolean;
  created_at:          string;
}

export interface TodayResponse {
  today_attendance:    Attendance | null;
  is_late:             boolean;
  needs_justification: boolean;
  work_locations:      WorkLocation[];
  date:                string;
}

export interface DailySummary {
  date:     string;
  presents: AttendanceUser[];
  absents:  AttendanceUser[];
  retards:  AttendanceUser[];
}

export interface TechLocation {
  id:                number;
  full_name:         string;
  status:            string;
  check_in_lat:      number | null;
  check_in_lng:      number | null;
  check_in_time:     string | null;
  check_in_location: string | null;
  is_late:           boolean;
  work_location: {
    id:        number;
    name:      string;
    latitude:  number;
    longitude: number;
    radius:    number;
    type:      string;
  } | null;
  is_in_zone: boolean;
}

export interface CheckInPayload {
  latitude:      number;
  longitude:     number;
  location_name?: string;
}

export interface CheckOutPayload {
  latitude:  number;
  longitude: number;
  location?: string;
}

export interface PaginatedAttendances {
  count:    number;
  next:     string | null;
  previous: string | null;
  results:  Attendance[];
}

const norm = (d: any): PaginatedAttendances =>
  Array.isArray(d) ? { results: d, count: d.length, next: null, previous: null } : d;

export const attendanceService = {
  getAll:       (params?: Record<string, string | number>) =>
    api.get<any>("/attendance/", { params }).then(r => norm(r.data)),

  getToday:     () =>
    api.get<TodayResponse>("/attendance/today/").then(r => r.data),

  getDailySummary: () =>
    api.get<DailySummary>("/attendance/daily-summary/").then(r => r.data),

  getDashboard: () =>
    api.get<{ total_aujourd_hui: number; presents_aujourd_hui: number; retards_aujourd_hui: number; total_ce_mois: number }>
      ("/attendance/dashboard/").then(r => r.data),

  checkIn:  (payload: CheckInPayload) =>
    api.post<{ success: boolean; message: string; need_zone_name?: boolean; attendance?: Attendance }>
      ("/attendance/check-in/", payload).then(r => r.data),

  checkOut: (payload: CheckOutPayload) =>
    api.post<{ success: boolean; message: string; attendance?: Attendance }>
      ("/attendance/check-out/", payload).then(r => r.data),

  justifyLate: (reason: string) =>
    api.post<{ success: boolean; message: string }>
      ("/attendance/justify-late/", { reason }).then(r => r.data),

  // Zones de travail
  getLocations: () =>
    api.get<WorkLocation[]>("/attendance/locations/").then(r => r.data),

  createLocation: (data: Partial<WorkLocation>) =>
    api.post<WorkLocation>("/attendance/locations/", data).then(r => r.data),

  updateLocation: (id: number, data: Partial<WorkLocation>) =>
    api.patch<WorkLocation>(`/attendance/locations/${id}/`, data).then(r => r.data),

  deleteLocation: (id: number) =>
    api.delete(`/attendance/locations/${id}/`).then(r => r.data),

  getTechLocations: () =>
    api.get<TechLocation[]>("/attendance/tech-locations/").then(r => r.data),
};