// ─────────────────────────────────────────────────────────────────────────────
//  src/services/chantiersService.ts
// ─────────────────────────────────────────────────────────────────────────────
import api from "./api";

export interface UserMini {
  id:        number;
  full_name: string;
  prenom:    string;
  nom:       string;
}

export interface Chantier {
  id:               number;
  nom:              string;
  description:      string | null;
  adresse:          string | null;
  date_debut:       string;
  date_fin_prevue:  string | null;
  date_fin_reelle:  string | null;
  statut:           "en_attente" | "en_cours" | "termine" | "suspendu";
  statut_display:   string;
  responsable:      number | null;
  responsable_detail: UserMini | null;
  techniciens:      number[];
  techniciens_detail: UserMini[];
  created_at:       string;
  updated_at:       string;
}

export interface ChantierPayload {
  nom:              string;
  description?:     string;
  adresse?:         string;
  date_debut:       string;
  date_fin_prevue?: string | null;
  statut?:          string;
  responsable_id?:  number | null;
  techniciens_ids?: number[];
}

export interface ChantierStats {
  total:      number;
  en_attente: number;
  en_cours:   number;
  termine:    number;
  suspendu:   number;
}

export interface PaginatedResponse<T> {
  count:    number;
  next:     string | null;
  previous: string | null;
  results:  T[];
}

const BASE = "/chantiers/";

const chantiersService = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Chantier>>(BASE, { params }).then(r => r.data),

  get: (id: number) =>
    api.get<Chantier>(`${BASE}${id}/`).then(r => r.data),

  create: (data: ChantierPayload) =>
    api.post<Chantier>(BASE, data).then(r => r.data),

  update: (id: number, data: Partial<ChantierPayload>) =>
    api.patch<Chantier>(`${BASE}${id}/`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`${BASE}${id}/`),

  affecter: (id: number, technicien_ids: number[]) =>
    api.post<Chantier>(`${BASE}${id}/affecter/`, { technicien_ids }).then(r => r.data),

  techniciensDispo: () =>
    api.get<UserMini[]>(`${BASE}techniciens-disponibles/`).then(r => r.data),

  stats: () =>
    api.get<ChantierStats>(`${BASE}stats/`).then(r => r.data),
};

export default chantiersService;
