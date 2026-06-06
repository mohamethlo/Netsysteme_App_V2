import api from "./api";

export interface Justificatif {
  id:          number;
  nom:         string;
  fichier:     string;
  url:         string | null;
  uploaded_at: string;
}

export interface UserMini {
  id:        number;
  full_name: string;
  prenom:    string;
  nom:       string;
}

export interface DepenseTerrain {
  id:               number;
  technicien:       number;
  technicien_detail: UserMini;
  chantier:         number | null;
  chantier_nom:     string | null;
  type_depense:     string;
  type_display:     string;
  description:      string;
  montant:          string;
  date_depense:     string;
  statut:           "en_attente" | "approuvee" | "refusee" | "remboursee";
  statut_display:   string;
  notes_admin:      string | null;
  justificatifs:    Justificatif[];
  created_at:       string;
  updated_at:       string;
}

export interface DepensePayload {
  technicien_id: number;
  chantier_id?:  number | null;
  type_depense:  string;
  description:   string;
  montant:       number;
  date_depense:  string;
}

export interface DepenseStats {
  total:         number;
  en_attente:    number;
  approuvees:    number;
  refusees:      number;
  remboursees:   number;
  montant_total: number;
}

export interface PaginatedResponse<T> {
  count:    number;
  next:     string | null;
  previous: string | null;
  results:  T[];
}

const BASE = "/depenses-terrain/";

const depensesTerrainService = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<DepenseTerrain>>(BASE, { params }).then(r => r.data),

  create: (data: DepensePayload) =>
    api.post<DepenseTerrain>(BASE, data).then(r => r.data),

  update: (id: number, data: Partial<DepensePayload>) =>
    api.patch<DepenseTerrain>(`${BASE}${id}/`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`${BASE}${id}/`),

  addJustificatif: (id: number, file: File) => {
    const fd = new FormData();
    fd.append("fichier", file);
    fd.append("nom", file.name);
    return api.post<Justificatif>(`${BASE}${id}/justificatifs/`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data);
  },

  deleteJustificatif: (depenseId: number, justifId: number) =>
    api.delete(`${BASE}${depenseId}/justificatifs/${justifId}/`),

  approuver:  (id: number) =>
    api.post<DepenseTerrain>(`${BASE}${id}/approuver/`).then(r => r.data),

  refuser: (id: number, notes?: string) =>
    api.post<DepenseTerrain>(`${BASE}${id}/refuser/`, { notes_admin: notes }).then(r => r.data),

  rembourser: (id: number) =>
    api.post<DepenseTerrain>(`${BASE}${id}/rembourser/`).then(r => r.data),

  stats: (params?: Record<string, string>) =>
    api.get<DepenseStats>(`${BASE}stats/`, { params }).then(r => r.data),
};

export default depensesTerrainService;
