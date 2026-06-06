import api from "./api";

export interface InventoryCategory {
  id:          number;
  name:        string;
  description: string | null;
  created_at:  string;
  items_count: number;
}

export type StockStatus = "ok" | "faible" | "rupture";

export interface InventoryItem {
  id:           number;
  name:         string;
  description:  string | null;
  reference:    string | null;
  category:     number | null;
  category_name:string | null;
  quantity:     number;
  unit:         string;
  prix_achat:   number | null;
  prix_vente:   number | null;
  seuil_alerte: number;
  fournisseur:  string | null;
  emplacement:  string | null;
  image_path:   string | null;
  image_url:    string | null;
  is_low_stock: boolean;
  stock_status: StockStatus;
  created_at:   string;
  updated_at:   string;
}

export interface InventoryStats {
  total:        number;
  low_stock:    number;
  rupture:      number;
  ok:           number;
  valeur_stock: number;
  categories:   number;
  alertes:      InventoryItem[];
}

export interface StockMovement {
  id:             number;
  item:           number;
  item_name:      string;
  type_mouvement: "entree" | "sortie" | "ajust";
  quantite:       number;
  quantite_avant: number;
  quantite_apres: number;
  raison:         string | null;
  created_by:     number | null;
  created_by_nom: string | null;
  created_at:     string;
}

export interface ItemSelect {
  id:           number;
  name:         string;
  description:  string | null;
  quantity:     number;
  unit:         string;
  prix_vente:   number | null;
  is_low_stock: boolean;
}

function norm(data: any): { results: any[]; count: number } {
  if (Array.isArray(data)) return { results: data, count: data.length };
  return { results: data.results ?? [], count: data.count ?? 0 };
}

export const inventoryService = {

  // ── Catégories ──────────────────────────────────────────────────────────────
  categories: {
    getAll: () =>
      api.get<any>("/inventory/categories/").then(r => norm(r.data).results as InventoryCategory[]),
    create: (data: Partial<InventoryCategory>) =>
      api.post<InventoryCategory>("/inventory/categories/", data).then(r => r.data),
    update: (id: number, data: Partial<InventoryCategory>) =>
      api.patch<InventoryCategory>(`/inventory/categories/${id}/`, data).then(r => r.data),
    delete: (id: number) =>
      api.delete(`/inventory/categories/${id}/`).then(r => r.data),
  },

  // ── Articles ────────────────────────────────────────────────────────────────
  getAll: (params?: Record<string, any>) =>
    api.get<any>("/inventory/items/", { params }).then(r => norm(r.data)),

  getById: (id: number) =>
    api.get<InventoryItem>(`/inventory/items/${id}/`).then(r => r.data),

  getStats: () =>
    api.get<InventoryStats>("/inventory/items/stats/").then(r => r.data),

  getSelect: () =>
    api.get<ItemSelect[]>("/inventory/items/select/").then(r => r.data),

  create: (formData: FormData) =>
    api.post<InventoryItem>("/inventory/items/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data),

  update: (id: number, formData: FormData) =>
    api.patch<InventoryItem>(`/inventory/items/${id}/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/inventory/items/${id}/`).then(r => r.data),

  // ── Mouvements de stock ─────────────────────────────────────────────────────
  adjustStock: (id: number, payload: {
    operation: "add" | "remove" | "set";
    quantity:  number;
    raison?:   string;
  }) =>
    api.post(`/inventory/items/${id}/adjust-stock/`, payload).then(r => r.data),

  outbound: (id: number, payload: { quantity: number; reason: string }) =>
    api.post(`/inventory/items/${id}/outbound/`, payload).then(r => r.data),

  getMovements: (id: number) =>
    api.get<StockMovement[]>(`/inventory/items/${id}/movements/`).then(r => r.data),

  // ── Mouvements globaux ──────────────────────────────────────────────────────
  movements: {
    getAll: (params?: Record<string, any>) =>
      api.get<any>("/inventory/movements/", { params }).then(r => norm(r.data)),
  },
};