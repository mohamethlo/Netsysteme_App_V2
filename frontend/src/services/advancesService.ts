import api from "./api";

export type AdvanceStatut = "en_attente" | "approuve" | "refuse";

export interface SalaryAdvance {
  id:              number;
  user:            number;
  user_nom:        string | null;
  montant:         number;
  motif:           string | null;
  date_demande:    string;
  statut:          AdvanceStatut;
  statut_display:  string;
  notes_admin:     string | null;
  created_at:      string;
  approved_at:     string | null;
  approved_by:     number | null;
  approved_by_nom: string | null;
}

export interface AdvanceDashboard {
  total:           number;
  en_attente:      number;
  approuve:        number;
  refuse:          number;
  montant_total:   number;
  montant_attente: number;
}

export interface Employee {
  id:   number;
  nom:  string;
  role: string | null;
  site: string | null;
}

function norm(data: any): { results: SalaryAdvance[]; count: number } {
  if (Array.isArray(data)) return { results: data, count: data.length };
  return { results: data.results ?? [], count: data.count ?? 0 };
}

export const advancesService = {
  getAll: (params?: Record<string, any>) =>
    api.get<any>("/advances/", { params }).then(r => norm(r.data)),

  getById: (id: number) =>
    api.get<SalaryAdvance>(`/advances/${id}/`).then(r => r.data),

  getDashboard: () =>
    api.get<AdvanceDashboard>("/advances/dashboard/").then(r => r.data),

  getEmployees: () =>
    api.get<Employee[]>("/advances/employees/").then(r => r.data),

  create: (data: { montant: number; motif?: string; user_id?: number }) =>
    api.post<SalaryAdvance>("/advances/", data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/advances/${id}/`).then(r => r.data),

  approve: (id: number, notes_admin?: string) =>
    api.post<SalaryAdvance>(`/advances/${id}/approve/`, { notes_admin }).then(r => r.data),

  refuse: (id: number, notes_admin?: string) =>
    api.post<SalaryAdvance>(`/advances/${id}/refuse/`, { notes_admin }).then(r => r.data),
};