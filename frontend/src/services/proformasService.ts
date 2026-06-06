// ─────────────────────────────────────────────────────────────────────────────
//  src/services/proformasService.ts
// ─────────────────────────────────────────────────────────────────────────────
import api from "./api";
import type { BillingClient } from "./billingClientsService";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ProformaItem {
  id:               number;
  description:      string | null;
  quantity:         number;
  unit_price:       number;
  discount_percent: number;
  product:          number | null;
  product_name:     string | null;
  product_image_url:string | null;
  subtotal:         number;
  subtotal_discount:number;
}

export type ProformaStatus = "draft" | "sent" | "converted" | "cancelled";

export interface Proforma {
  id:                     number;
  proforma_number:        string | null;
  billing_client:         number;
  billing_client_detail:  BillingClient | null;
  date:                   string;
  valid_until:            string | null;
  tax_rate:               number;
  status:                 ProformaStatus;
  status_display:         string;
  notes:                  string | null;
  domaine:                "NETSYSTEME" | "SSE" | null;
  converted_to_invoice:   boolean;
  invoice:                number | null;
  discount_percent:       number;
  discount_amount:        number;
  items:                  ProformaItem[];
  // Calculs
  total_ht:               number;
  tva_amount:             number;
  total_ttc_before_discount: number;
  discount_value:         number;
  total_ttc:              number;
  created_at:             string;
  updated_at:             string;
}

export interface ProformaItemPayload {
  description:      string;
  quantity:         number;
  unit_price:       number;
  discount_percent: number;
  product?:         number | null;
}

export interface ProformaPayload {
  proforma_number:  string;
  billing_client:   number;
  date:             string;
  valid_until?:     string | null;
  tax_rate:         number;
  status?:          ProformaStatus;
  notes?:           string | null;
  domaine:          "NETSYSTEME" | "SSE";
  discount_percent?:number;
  discount_amount?: number;
  items:            ProformaItemPayload[];
}

export interface ProformaDashboard {
  total_proformas:    number;
  brouillons:         number;
  envoyes:            number;
  convertis:          number;
  annules:            number;
  montant_total:      number;
  montant_en_attente: number;
  expire_bientot:     number;
  recent:             Proforma[];
}

export interface PaginatedProformas {
  count:    number;
  next:     string | null;
  previous: string | null;
  results:  Proforma[];
}

const normalize = (data: any): PaginatedProformas =>
  Array.isArray(data)
    ? { results: data, count: data.length, next: null, previous: null }
    : data;

// ── Service ───────────────────────────────────────────────────────────────────
export const proformasService = {

  getAll: (params?: Record<string, string | number>) =>
    api.get<any>("/proformas/", { params }).then(r => normalize(r.data)),

  getById: (id: number) =>
    api.get<Proforma>(`/proformas/${id}/`).then(r => r.data),

  getDashboard: () =>
    api.get<ProformaDashboard>("/proformas/dashboard/").then(r => r.data),

  getNextNumber: () =>
    api.get<{ number: string }>("/proformas/next-number/").then(r => r.data),

  create: (payload: ProformaPayload) =>
    api.post<Proforma>("/proformas/", payload).then(r => r.data),

  update: (id: number, payload: Partial<ProformaPayload>) =>
    api.patch<Proforma>(`/proformas/${id}/`, payload).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/proformas/${id}/`).then(r => r.data),

  convert: (id: number) =>
    api.post(`/proformas/${id}/convert/`).then(r => r.data),

  changeStatus: (id: number, newStatus: Omit<ProformaStatus, "converted">) =>
    api.patch<Proforma>(`/proformas/${id}/change-status/`, { status: newStatus }).then(r => r.data),

  duplicate: (id: number) =>
    api.post<Proforma>(`/proformas/${id}/duplicate/`).then(r => r.data),
};