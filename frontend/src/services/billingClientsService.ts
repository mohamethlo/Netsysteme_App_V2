// ─────────────────────────────────────────────────────────────────────────────
//  src/services/billingClientsService.ts
//  Service dédié au module BillingClients — indépendant du service facturation
// ─────────────────────────────────────────────────────────────────────────────
import api from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BillingClient {
  id:              number;
  company_name:    string | null;
  contact_name:    string | null;
  email:           string | null;
  phone:           string;
  address:         string | null;
  tax_id:          string | null;
  display_name:    string;
  can_delete:      boolean;
  invoices_count:  number;
  proformas_count: number;
  created_at:      string;
  updated_at:      string;
}

export interface BillingClientPayload {
  company_name?: string | null;
  contact_name?: string | null;
  email?:        string | null;
  phone:         string;
  address?:      string | null;
  tax_id?:       string | null;
}

export interface BillingClientStats {
  total:        number;
  with_company: number;
  with_email:   number;
  with_tax_id:  number;
}

export interface BillingClientSelect {
  id:    number;
  text:  string;
  phone: string;
}

export interface PaginatedClients {
  count:    number;
  next:     string | null;
  previous: string | null;
  results:  BillingClient[];
}

// ── Service ───────────────────────────────────────────────────────────────────
export const billingClientsService = {

  // Liste paginée avec filtres
  getAll: (params?: Record<string, string | number>) =>
    api.get<PaginatedClients | BillingClient[]>("/billing-clients/", { params })
      .then(r => {
        const data = r.data;
        if (Array.isArray(data)) return { results: data, count: data.length, next: null, previous: null };
        return data as PaginatedClients;
      }),

  // Détail
  getById: (id: number) =>
    api.get<BillingClient>(`/billing-clients/${id}/`).then(r => r.data),

  // Liste simplifiée pour les <select>
  getSelect: () =>
    api.get<BillingClientSelect[]>("/billing-clients/select/").then(r => r.data),

  // Statistiques
  getStats: () =>
    api.get<BillingClientStats>("/billing-clients/stats/").then(r => r.data),

  // Créer
  create: (payload: BillingClientPayload) =>
    api.post<BillingClient>("/billing-clients/", payload).then(r => r.data),

  // Modifier (partial)
  update: (id: number, payload: Partial<BillingClientPayload>) =>
    api.patch<BillingClient>(`/billing-clients/${id}/`, payload).then(r => r.data),

  // Supprimer (protégé côté serveur)
  delete: (id: number) =>
    api.delete(`/billing-clients/${id}/`).then(r => r.data),
};