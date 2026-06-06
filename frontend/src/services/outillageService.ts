// ─────────────────────────────────────────────────────────────────────────────
//  src/services/outillageService.ts
// ─────────────────────────────────────────────────────────────────────────────
import api from "./api";

export interface Outil {
  id:                 number;
  nom:                string;
  categorie:          string;
  categorie_display:  string;
  description:        string | null;
  quantite_totale:    number;
  quantite_disponible: number;
  numero_serie:       string | null;
  is_active:          boolean;
  created_at:         string;
}

export interface OutilPayload {
  nom:             string;
  categorie:       string;
  description?:    string;
  quantite_totale: number;
  numero_serie?:   string;
  is_active?:      boolean;
}

export interface UserMini {
  id:        number;
  full_name: string;
  prenom:    string;
  nom:       string;
}

export interface ReservationOutil {
  id:               number;
  outil:            number;
  outil_detail:     Outil;
  technicien:       number;
  technicien_detail: UserMini;
  chantier:         number | null;
  chantier_nom:     string | null;
  date_debut:       string;
  heure_debut:      string | null;
  date_fin:         string;
  heure_fin:        string | null;
  quantite:         number;
  statut:           "en_attente" | "approuvee" | "refusee" | "en_cours" | "retournee";
  statut_display:   string;
  notes:            string | null;
  created_at:       string;
  updated_at:       string;
}

export interface ReservationPayload {
  outil_id:      number;
  technicien_id: number;
  chantier_id?:  number | null;
  date_debut:    string;
  heure_debut?:  string | null;
  date_fin:      string;
  heure_fin?:    string | null;
  quantite:      number;
  notes?:        string;
}

export interface ReservationStats {
  total:      number;
  en_attente: number;
  approuvees: number;
  en_cours:   number;
  retournees: number;
  refusees:   number;
}

export interface PaginatedResponse<T> {
  count:    number;
  next:     string | null;
  previous: string | null;
  results:  T[];
}

const OUTILS_BASE = "/outillage/outils/";
const RESA_BASE   = "/outillage/reservations/";

const outillageService = {
  // Outils
  listOutils: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Outil>>(OUTILS_BASE, { params }).then(r => r.data),

  createOutil: (data: OutilPayload) =>
    api.post<Outil>(OUTILS_BASE, data).then(r => r.data),

  updateOutil: (id: number, data: Partial<OutilPayload>) =>
    api.patch<Outil>(`${OUTILS_BASE}${id}/`, data).then(r => r.data),

  deleteOutil: (id: number) =>
    api.delete(`${OUTILS_BASE}${id}/`),

  // Réservations
  listReservations: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<ReservationOutil>>(RESA_BASE, { params }).then(r => r.data),

  createReservation: (data: ReservationPayload) =>
    api.post<ReservationOutil>(RESA_BASE, data).then(r => r.data),

  updateReservation: (id: number, data: Partial<ReservationPayload>) =>
    api.patch<ReservationOutil>(`${RESA_BASE}${id}/`, data).then(r => r.data),

  approuver: (id: number) =>
    api.post<ReservationOutil>(`${RESA_BASE}${id}/approuver/`).then(r => r.data),

  refuser: (id: number) =>
    api.post<ReservationOutil>(`${RESA_BASE}${id}/refuser/`).then(r => r.data),

  remettre: (id: number) =>
    api.post<ReservationOutil>(`${RESA_BASE}${id}/remettre/`).then(r => r.data),

  confirmerReception: (id: number) =>
    api.post<ReservationOutil>(`${RESA_BASE}${id}/confirmer-reception/`).then(r => r.data),

  retourner: (id: number) =>
    api.post<ReservationOutil>(`${RESA_BASE}${id}/retourner/`).then(r => r.data),

  confirmerRetour: (id: number) =>
    api.post<ReservationOutil>(`${RESA_BASE}${id}/confirmer-retour/`).then(r => r.data),

  statsReservations: () =>
    api.get<ReservationStats>(`${RESA_BASE}stats/`).then(r => r.data),
};

export default outillageService;
