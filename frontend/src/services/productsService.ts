// ─────────────────────────────────────────────────────────────────────────────
//  src/services/productsService.ts
// ─────────────────────────────────────────────────────────────────────────────
import api from "./api";

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

export interface ProductSelect {
  id:           number;
  name:         string | null;
  description:  string | null;
  price:        number;
  quantity:     number;
  is_low_stock: boolean;
}

export interface ProductStats {
  total:        number;
  en_rupture:   number;
  stock_faible: number;
  stock_ok:     number;
  valeur_stock: number;
}

export interface StockAdjustPayload {
  operation: "add" | "remove" | "set";
  quantity:  number;
  note?:     string;
}

export interface PaginatedProducts {
  count:    number;
  next:     string | null;
  previous: string | null;
  results:  Product[];
}

const normalize = (data: PaginatedProducts | Product[]): PaginatedProducts =>
  Array.isArray(data)
    ? { results: data, count: data.length, next: null, previous: null }
    : data;

export const productsService = {
  getAll: (params?: Record<string, string | number>) =>
    api.get<PaginatedProducts | Product[]>("/products/", { params })
      .then(r => normalize(r.data as any)),

  getById: (id: number) =>
    api.get<Product>(`/products/${id}/`).then(r => r.data),

  getSelect: () =>
    api.get<ProductSelect[]>("/products/select/").then(r => r.data),

  getStats: () =>
    api.get<ProductStats>("/products/stats/").then(r => r.data),

  getLowStock: () =>
    api.get<Product[]>("/products/low-stock/").then(r => r.data),

  create: (formData: FormData) =>
    api.post<Product>("/products/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data),

  update: (id: number, formData: FormData) =>
    api.patch<Product>(`/products/${id}/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/products/${id}/`).then(r => r.data),

  adjustStock: (id: number, payload: StockAdjustPayload) =>
    api.post<{ detail: string; new_quantity: number; product: Product }>(
      `/products/${id}/adjust-stock/`, payload
    ).then(r => r.data),

  // Dans productsService, ajoute :
  getStockAlerts: () =>
    api.get<{
      total:    number;
      ruptures: number;
      faibles:  number;
      alertes:  Array<{
        id:             number;
        name:           string;
        description:    string | null;
        quantity:       number;
        alert_quantity: number;
        unit_price:     number;
        supplier:       string | null;
        image_path:     string | null;
        stock_status:   "ok" | "faible" | "rupture";
        is_low_stock:   boolean;
      }>;
    }>("/billing/products/stock-alerts/").then(r => r.data),
};