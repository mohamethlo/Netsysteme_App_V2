// src/services/reportsService.ts
import api from "./api";

export type StatusLabel = "excellent" | "bon" | "moyen" | "problematique";

export interface AttendanceDetail {
  date:        string;
  day_name:    string;
  check_in:    string;
  check_out:   string;
  total_hours: string;
  location:    string;
  is_late:     boolean;
  notes:       string;
  status:      string;
}

export interface EmployeeReport {
  employee: {
    id:        number;
    name:      string;
    prenom:    string;
    nom:       string;
    role:      string;
    email:     string;
    telephone: string;
  };
  total_hours:       number;
  working_days:      number;
  days_present:      number;
  days_absent:       number;
  days_late:         number;
  justified_lates:   number;
  unjustified_lates: number;
  attendance_rate:   number;
  status:            StatusLabel;
  attendance_details: AttendanceDetail[];
}

export interface MonthlyReport {
  report_data:      EmployeeReport[];
  year:             number;
  month:            number;
  month_name:       string;
  first_day:        string;
  last_day:         string;
  report_end:       string;
  total_employees:  number;
  avg_hours:        number;
  total_absences:   number;
  total_lates:      number;
  avg_working_days: number;
}

export const reportsService = {
  // ── Rapport mensuel ───────────────────────────────────────────────────────
  getMonthly: (year: number, month: number) =>
    api.get<MonthlyReport>("/reports/monthly/", { params: { year, month } }).then(r => r.data),

  // ── Export global PDF ─────────────────────────────────────────────────────
  exportPdf: (year: number, month: number) => {
    const token = localStorage.getItem("access_token");
    const url   = `${api.defaults.baseURL}/reports/monthly/export/pdf/?year=${year}&month=${month}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `rapport_mensuel_${month}_${year}.pdf`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      });
  },

  // ── Export global Excel ───────────────────────────────────────────────────
  exportExcel: (year: number, month: number) => {
    const token = localStorage.getItem("access_token");
    const url   = `${api.defaults.baseURL}/reports/monthly/export/excel/?year=${year}&month=${month}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `rapport_mensuel_${month}_${year}.xlsx`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      });
  },

  // ── Export PDF individuel ─────────────────────────────────────────────────
  exportEmployeePdf: (employeeId: number, year: number, month: number) => {
    const token = localStorage.getItem("access_token");
    const url   = `${api.defaults.baseURL}/reports/employee/${employeeId}/pdf/?year=${year}&month=${month}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `rapport_${employeeId}_${month}_${year}.pdf`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      });
  },
};