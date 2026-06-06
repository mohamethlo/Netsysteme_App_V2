// ─────────────────────────────────────────────────────────────────────────────
//  src/services/invoicesService.ts
// ─────────────────────────────────────────────────────────────────────────────
import api from "./api";
import type { BillingClient } from "./billingClientsService";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface InvoiceItem {
  id:                     number;
  description:            string | null;
  quantity:               number;
  unit_price:             number;
  discount_percent:       number;
  product:                number | null;
  product_name:           string | null;
  product_image_url:      string | null;
  subtotal:               number;
  subtotal_after_discount:number;
}

export interface Invoice {
  id:                       number;
  invoice_number:           string | null;
  billing_client:           number | null;
  billing_client_detail:    BillingClient | null;
  installation:             number | null;
  date:                     string;
  due_date:                 string | null;
  tax_rate:                 number;
  status:                   InvoiceStatus;
  status_display:           string;
  notes:                    string | null;
  domaine:                  "NETSYSTEME" | "SSE" | null;
  domaine_display:          string | null;
  discount_percent:         number;
  discount_amount:          number;
  advance_amount:           number;
  items:                    InvoiceItem[];
  // Calculs
  total_ht:                 number;
  tva_amount:               number;
  total_ttc_before_discount:number;
  discount_value:           number;
  total_ttc:                number;
  remaining_balance:        number;
  has_advance:              boolean;
  created_at:               string;
  updated_at:               string;
}

export type InvoiceStatus =
  | "draft" | "confirmed" | "sent" | "paid" | "overdue" | "cancelled";

export interface InvoiceItemPayload {
  description:      string;
  quantity:         number;
  unit_price:       number;
  discount_percent: number;
  product?:         number | null;
}

export interface InvoicePayload {
  invoice_number:   string;
  billing_client:   number;
  installation?:    number | null;
  date:             string;
  due_date?:        string | null;
  tax_rate:         number;
  status?:          InvoiceStatus;
  notes?:           string | null;
  domaine:          "NETSYSTEME" | "SSE";
  discount_percent?:number;
  discount_amount?: number;
  advance_amount?:  number;
  items:            InvoiceItemPayload[];
}

export interface InvoiceDashboard {
  total_factures:     number;
  brouillons:         number;
  confirmees:         number;
  payees:             number;
  montant_total:      number;
  montant_en_attente: number;
  recent:             Invoice[];
}

export interface PaginatedInvoices {
  count:    number;
  next:     string | null;
  previous: string | null;
  results:  Invoice[];
}

const normalize = (data: any): PaginatedInvoices =>
  Array.isArray(data)
    ? { results: data, count: data.length, next: null, previous: null }
    : data;

// ── Service ───────────────────────────────────────────────────────────────────
export const invoicesService = {

  getAll: (params?: Record<string, string | number>) =>
    api.get<any>("/invoices/", { params }).then(r => normalize(r.data)),

  getById: (id: number) =>
    api.get<Invoice>(`/invoices/${id}/`).then(r => r.data),

  getDashboard: () =>
    api.get<InvoiceDashboard>("/invoices/dashboard/").then(r => r.data),

  getNextNumber: () =>
    api.get<{ number: string }>("/invoices/next-number/").then(r => r.data),

  create: (payload: InvoicePayload) =>
    api.post<Invoice>("/invoices/", payload).then(r => r.data),

  update: (id: number, payload: Partial<InvoicePayload>) =>
    api.patch<Invoice>(`/invoices/${id}/`, payload).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/invoices/${id}/`).then(r => r.data),

  confirm: (id: number) =>
    api.post<Invoice>(`/invoices/${id}/confirm/`).then(r => r.data),

  changeStatus: (id: number, newStatus: InvoiceStatus) =>
    api.patch<Invoice>(`/invoices/${id}/change-status/`, { status: newStatus }).then(r => r.data),

  convertToProforma: (id: number) =>
    api.post(`/invoices/${id}/convert-to-proforma/`).then(r => r.data),
};