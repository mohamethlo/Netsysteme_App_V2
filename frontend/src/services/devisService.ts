import api from "./api";

export type DevisStatus = "pending" | "assigned" | "completed";

export interface LigneDevis {
  id:            number;
  designation:   string;
  quantite:      number;
  prix_unitaire: string | null;
}

export interface Devis {
  id:             number;
  nom:            string;
  prenom:         string;
  telephone:      string;
  commentaire:    string | null;
  status:         DevisStatus;
  status_display: string;
  created_at:     string;
  user:           number | null;
  user_nom:       string | null;
  assigned_to:    number | null;
  technicien_nom: string | null;
  lignes:         LigneDevis[];
}

export interface DevisDashboard {
  total:     number;
  pending:   number;
  assigned:  number;
  completed: number;
  recent:    Devis[];
}

export interface DevisTechnicien {
  id:   number;
  nom:  string;
  role: string | null;
}

export interface LigneDevisInput {
  designation:   string;
  quantite:      number;
  prix_unitaire?: number | null;
}

function norm(data: any): { results: Devis[]; count: number } {
  if (Array.isArray(data)) return { results: data, count: data.length };
  return { results: data.results ?? [], count: data.count ?? 0 };
}

export const devisService = {
  getAll: (params?: Record<string, any>) =>
    api.get<any>("/devis/", { params }).then(r => norm(r.data)),

  getDashboard: () =>
    api.get<DevisDashboard>("/devis/dashboard/").then(r => r.data),

  getTechnicians: () =>
    api.get<DevisTechnicien[]>("/devis/technicians/").then(r => r.data),

  create: (data: { nom: string; prenom: string; telephone: string; commentaire?: string }) =>
    api.post<Devis>("/devis/", data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/devis/${id}/`).then(r => r.data),

  assign: (id: number, technician_id: number) =>
    api.post<Devis>(`/devis/${id}/assign/`, { technician_id }).then(r => r.data),

  fillMateriels: (id: number, lignes: LigneDevisInput[], commentaire?: string) =>
    api.post<Devis>(`/devis/${id}/materiels/`, { lignes, commentaire }).then(r => r.data),

  update: (id: number, data: { nom?: string; prenom?: string; telephone?: string; commentaire?: string }) =>
    api.patch<Devis>(`/devis/${id}/`, data).then(r => r.data),

  setPrix: (id: number, lignes: { id: number; prix_unitaire: number | null }[]) =>
    api.post<Devis>(`/devis/${id}/prix/`, { lignes }).then(r => r.data),
};
