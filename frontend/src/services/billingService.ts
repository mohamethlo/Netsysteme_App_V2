// ─────────────────────────────────────────────────────────────────────────────
//  src/services/billingService.ts
//  Service centralisé — préfixe /api/billing/
//  Compatible avec apps/billing/urls.py
// ─────────────────────────────────────────────────────────────────────────────
import { useAuthStore } from "../store/authStore";
import api from "./api";

// ════════════════════════════════════════════════════════════════════════════
//  Types
// ════════════════════════════════════════════════════════════════════════════

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

export interface Product {
  id:                  number;
  name:                string | null;
  description:         string | null;
  quantity:            number;
  alert_quantity:      number;
  unit_price:          number;
  supplier:            string | null;
  image_path:          string | null;
  image_url:           string | null;
  is_low_stock:        boolean;
  stock_status:        "ok" | "faible" | "rupture";
  invoice_items_count: number;
  created_at:          string;
  updated_at:          string;
}

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

export type InvoiceStatus = "draft"|"confirmed"|"sent"|"paid"|"overdue"|"cancelled";

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

export type ProformaStatus = "draft"|"sent"|"converted"|"cancelled";

export interface Proforma {
  id:                       number;
  proforma_number:          string | null;
  billing_client:           number;
  billing_client_detail:    BillingClient | null;
  date:                     string;
  valid_until:              string | null;
  tax_rate:                 number;
  status:                   ProformaStatus;
  status_display:           string;
  notes:                    string | null;
  domaine:                  "NETSYSTEME" | "SSE" | null;
  converted_to_invoice:     boolean;
  invoice:                  number | null;
  discount_percent:         number;
  discount_amount:          number;
  items:                    ProformaItem[];
  total_ht:                 number;
  tva_amount:               number;
  total_ttc_before_discount:number;
  discount_value:           number;
  total_ttc:                number;
  created_at:               string;
  updated_at:               string;
}

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
  items:            InvoiceItemPayload[];
}

export interface BillingDashboard {
  total_clients:          number;
  total_invoices:         number;
  total_proformas:        number;
  total_products:         number;
  low_stock:              number;
  montant_total_factures: number;
  recent_invoices:        Invoice[];
  recent_proformas:       Proforma[];
}

export interface Paginated<T> {
  count: number; next: string | null; previous: string | null; results: T[];
}

// Normalise réponse paginée ou tableau brut
const pag = <T>(data: any): Paginated<T> =>
  Array.isArray(data) ? { results: data, count: data.length, next: null, previous: null } : data;

// ════════════════════════════════════════════════════════════════════════════
//  Service
// ════════════════════════════════════════════════════════════════════════════
export const billingService = {

  // ── Dashboard global ─────────────────────────────────────────────────────
  getDashboard: () =>
    api.get<BillingDashboard>("/billing/dashboard/").then(r => r.data),

  // ── Clients ──────────────────────────────────────────────────────────────
  clients: {
    getAll:    (params?: Record<string, string | number>) =>
      api.get<BillingClient[] | Paginated<BillingClient>>("/billing/clients/", { params })
        .then(r => pag<BillingClient>(r.data)),
    getById:   (id: number) =>
      api.get<BillingClient>(`/billing/clients/${id}/`).then(r => r.data),
    getSelect: () =>
      api.get<{ id: number; text: string; phone: string }[]>("/billing/clients/select/").then(r => r.data),
    getStats:  () =>
      api.get<{ total: number; with_company: number; with_email: number; with_tax_id: number }>("/billing/clients/stats/").then(r => r.data),
    create:    (data: Partial<BillingClient>) =>
      api.post<BillingClient>("/billing/clients/", data).then(r => r.data),
    update:    (id: number, data: Partial<BillingClient>) =>
      api.patch<BillingClient>(`/billing/clients/${id}/`, data).then(r => r.data),
    delete:    (id: number) =>
      api.delete(`/billing/clients/${id}/`).then(r => r.data),
  },

  // ── Products ─────────────────────────────────────────────────────────────
  products: {
    getAll:      (params?: Record<string, string | number>) =>
      api.get<Product[] | Paginated<Product>>("/billing/products/", { params })
        .then(r => pag<Product>(r.data)),
    getSelect:   () =>
      api.get<{ id: number; name: string | null; description: string | null; price: number; quantity: number; is_low_stock: boolean }[]>("/billing/products/select/").then(r => r.data),
    getStats:    () =>
      api.get<{ total: number; stock_ok: number; stock_faible: number; en_rupture: number; valeur_stock: number }>("/billing/products/stats/").then(r => r.data),
    getLowStock: () =>
      api.get<Product[]>("/billing/products/low-stock/").then(r => r.data),
    getById:     (id: number) =>
      api.get<Product>(`/billing/products/${id}/`).then(r => r.data),
    create:      (formData: FormData) =>
      api.post<Product>("/billing/products/", formData, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data),
    update:      (id: number, formData: FormData) =>
      api.patch<Product>(`/billing/products/${id}/`, formData, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data),
    delete:      (id: number) =>
      api.delete(`/billing/products/${id}/`).then(r => r.data),
    adjustStock: (id: number, op: "add"|"remove"|"set", qty: number) =>
      api.post<{ detail: string; new_quantity: number; product: Product }>(`/billing/products/${id}/adjust-stock/`, { operation: op, quantity: qty }).then(r => r.data),
  },

  // ── Invoices ─────────────────────────────────────────────────────────────
  invoices: {
    getAll:          (params?: Record<string, string | number>) =>
      api.get<any>("/billing/invoices/", { params }).then(r => pag<Invoice>(r.data)),
    getById:         (id: number) =>
      api.get<Invoice>(`/billing/invoices/${id}/`).then(r => r.data),
    getDashboard:    () =>
      api.get<{ total_factures: number; brouillons: number; confirmees: number; payees: number; montant_total: number; montant_en_attente: number; recent: Invoice[] }>("/billing/invoices/dashboard/").then(r => r.data),
    getNextNumber:   () =>
      api.get<{ number: string }>("/billing/invoices/next-number/").then(r => r.data),
    create:          (payload: InvoicePayload) =>
      api.post<Invoice>("/billing/invoices/", payload).then(r => r.data),
    update:          (id: number, payload: Partial<InvoicePayload>) =>
      api.patch<Invoice>(`/billing/invoices/${id}/`, payload).then(r => r.data),
    delete:          (id: number) =>
      api.delete(`/billing/invoices/${id}/`).then(r => r.data),
    confirm:         (id: number) =>
      api.post<Invoice>(`/billing/invoices/${id}/confirm/`).then(r => r.data),
    changeStatus:    (id: number, s: InvoiceStatus) =>
      api.patch<Invoice>(`/billing/invoices/${id}/change-status/`, { status: s }).then(r => r.data),
    convertToProforma: (id: number) =>
      api.post<Proforma>(`/billing/invoices/${id}/convert-to-proforma/`).then(r => r.data),

    // ── À ajouter dans billingService.invoices ──────────────────────────────────
    
     getPdfUrl: (id: number) =>
       `${api.defaults.baseURL}/billing/invoices/${id}/pdf/`,
    
     downloadPdf: async (id: number, filename?: string) => {
       const token = useAuthStore.getState().accessToken;
       const url   = `${api.defaults.baseURL}/billing/invoices/${id}/pdf/`;
       const resp  = await fetch(url, {
         headers: { Authorization: `Bearer ${token}` },
       });
       if (!resp.ok) throw new Error("Erreur génération PDF");
       const blob   = await resp.blob();
       const blobUrl = URL.createObjectURL(blob);
       const a      = document.createElement("a");
       a.href       = blobUrl;
       a.target     = "_blank";   // ouvre dans un nouvel onglet
       a.download   = filename ?? `facture_${id}.pdf`;
       a.click();
       URL.revokeObjectURL(blobUrl);
     },
  },

  // ── Proformas ────────────────────────────────────────────────────────────
  proformas: {
    getAll:        (params?: Record<string, string | number>) =>
      api.get<any>("/billing/proformas/", { params }).then(r => pag<Proforma>(r.data)),
    getById:       (id: number) =>
      api.get<Proforma>(`/billing/proformas/${id}/`).then(r => r.data),
    getDashboard:  () =>
      api.get<{ total_proformas: number; brouillons: number; envoyes: number; convertis: number; annules: number; montant_total: number; montant_en_attente: number; expire_bientot: number; recent: Proforma[] }>("/billing/proformas/dashboard/").then(r => r.data),
    getNextNumber: () =>
      api.get<{ number: string }>("/billing/proformas/next-number/").then(r => r.data),
    create:        (payload: ProformaPayload) =>
      api.post<Proforma>("/billing/proformas/", payload).then(r => r.data),
    update:        (id: number, payload: Partial<ProformaPayload>) =>
      api.patch<Proforma>(`/billing/proformas/${id}/`, payload).then(r => r.data),
    delete:        (id: number) =>
      api.delete(`/billing/proformas/${id}/`).then(r => r.data),
    convert:       (id: number) =>
      api.post<Invoice>(`/billing/proformas/${id}/convert/`).then(r => r.data),
    changeStatus:  (id: number, s: "draft"|"sent"|"cancelled") =>
      api.patch<Proforma>(`/billing/proformas/${id}/change-status/`, { status: s }).then(r => r.data),
    duplicate:     (id: number) =>
      api.post<Proforma>(`/billing/proformas/${id}/duplicate/`).then(r => r.data),

    
    // ── À ajouter dans billingService.proformas ─────────────────────────────────

    getPdfUrl: (id: number) =>
      `${api.defaults.baseURL}/billing/proformas/${id}/pdf/`,

    downloadPdf: async (id: number, filename?: string) => {
      const token = useAuthStore.getState().accessToken;
      const url   = `${api.defaults.baseURL}/billing/proformas/${id}/pdf/`;
      const resp  = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Erreur génération PDF");
      const blob   = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a      = document.createElement("a");
      a.href       = blobUrl;
      a.target     = "_blank";
      a.download   = filename ?? `proforma_${id}.pdf`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    },
  },
};