// src/services/expensesService.ts
import api from "./api";

export type Site    = "Dakar" | "Mbour";
export type Statut  = "en_attente" | "approuve" | "rejete";

export interface ExpenseUser {
  id:        number;
  prenom:    string;
  nom:       string;
  full_name: string;
}

export interface Expense {
  id:                number;
  user:              number;
  user_detail:       ExpenseUser | null;
  titre:             string;
  description:       string | null;
  montant:           number;
  categorie:         string | null;
  categorie_display: string | null;
  date_depense:      string;
  date_str:          string | null;
  statut:            Statut;
  statut_display:    string;
  justificatif:      string | null;
  justificatif_url:  string | null;
  notes_admin:       string | null;
  site:              Site | null;
  approved_by:       number | null;
  approved_by_detail:{ id: number; full_name: string } | null;
  approved_at:       string | null;
  deleted_at:        string | null;
  deleted_at_str:    string | null;
  is_deleted:        boolean;
  can_restore:       boolean;
  created_at:        string;
}

export interface Approvisionnement {
  id:         number;
  montant:    number;
  date:       string;
  date_str:   string | null;
  site:       Site;
  created_by: number | null;
}

export interface SiteDashboard {
  site:             Site;
  total_appro:      number;
  total_depenses:   number;
  montant_restant:  number;
  benefice:         number;
  pertes:           number;
  appro_mensuel:    number[];
  depenses_mensuel: number[];
  categories:       string[];
}

export interface PaginatedExpenses {
  count:    number;
  next:     string | null;
  previous: string | null;
  results:  Expense[];
}

const norm = (d: any): PaginatedExpenses =>
  Array.isArray(d) ? { results: d, count: d.length, next: null, previous: null } : d;

export const expensesService = {
  // ── Dépenses ───────────────────────────────────────────────────────────────
  getAll: (params?: Record<string, any>) =>
    api.get<any>("/expenses/", { params }).then(r => norm(r.data)),

  getById: (id: number) =>
    api.get<Expense>(`/expenses/${id}/`).then(r => r.data),

  create: (data: FormData | Record<string, any>) =>
    api.post<Expense>("/expenses/", data).then(r => r.data),

  update: (id: number, data: FormData | Record<string, any>) =>
    api.patch<Expense>(`/expenses/${id}/`, data).then(r => r.data),

  delete: (id: number) =>           // soft delete → corbeille
    api.delete(`/expenses/${id}/`).then(r => r.data),

  approve: (id: number) =>
    api.post<Expense>(`/expenses/${id}/approve/`).then(r => r.data),

  reject: (id: number, notes?: string) =>
    api.post<Expense>(`/expenses/${id}/reject/`, { notes_admin: notes ?? "" }).then(r => r.data),

  // ── Corbeille ──────────────────────────────────────────────────────────────
  getTrash: () =>
    api.get<Expense[]>("/expenses/trash/").then(r => r.data),

  restore: (id: number) =>
    api.post<{ success: boolean; message: string }>(`/expenses/${id}/restore/`).then(r => r.data),

  forceDelete: (id: number) =>
    api.delete(`/expenses/${id}/force-delete/`).then(r => r.data),

  // ── Dashboard ──────────────────────────────────────────────────────────────
  getDashboard: (params?: { site?: Site; month?: number; year?: number }) =>
    api.get<SiteDashboard | SiteDashboard[]>("/expenses/dashboard/", { params }).then(r => r.data),

  getCategories: () =>
    api.get<{ value: string; label: string }[]>("/expenses/categories/").then(r => r.data),

  // ── Approvisionnements ─────────────────────────────────────────────────────
  appros: {
    getAll: (params?: Record<string, any>) =>
      api.get<Approvisionnement[]>("/expenses/appros/", { params }).then(r => r.data),

    create: (data: { montant: number; date: string; site: Site }) =>
      api.post<Approvisionnement>("/expenses/appros/", data).then(r => r.data),

    history: (site?: Site) =>
      api.get<Approvisionnement[]>("/expenses/appros/history/", { params: site ? { site } : undefined }).then(r => r.data),

    delete: (id: number) =>
      api.delete(`/expenses/appros/${id}/`).then(r => r.data),
  },
};