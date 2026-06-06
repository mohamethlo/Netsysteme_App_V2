import api from "./api";

export type InterventionStatut   = "planifiee" | "en_cours" | "terminee" | "annulee";
export type InterventionPriorite = "basse" | "normale" | "haute" | "urgente";

export interface InterventionMaterial {
  id:               number;
  article:          number | null;
  article_name:     string | null;
  nom_article:      string | null;
  quantite:         number;
  quantite_utilisee:number;
}

export interface Intervention {
  id:                       number;
  titre:                    string | null;
  description:              string | null;
  client:                   number | null;
  client_nom:               string | null;
  client_libre_nom:         string | null;
  client_libre_telephone:   string | null;
  technicien:               number | null;
  technicien_nom:           string | null;
  responsable:              number | null;
  responsable_nom:          string | null;
  autres_intervenants:      number[];
  autres_intervenants_detail: { id: number; nom: string }[];
  date_prevue:              string;
  date_realisation:         string | null;
  duree_estimee:            number | null;
  duree_reelle:             number | null;
  statut:                   InterventionStatut;
  statut_display:           string;
  priorite:                 InterventionPriorite;
  priorite_display:         string;
  adresse:                  string | null;
  notes:                    string | null;
  created_by:               number | null;
  created_by_nom:           string | null;
  created_at:               string;
  updated_at:               string;
  type_intervention:        string | null;
  societe:                  string | null;
  representant:             string | null;
  telephone:                string | null;
  taches_realisees:         string | null;
  heure_arrivee:            string | null;
  heure_depart:             string | null;
  duree_intervention:       string | null;
  observations_technicien:  string | null;
  id_dvr_nvr:               string | null;
  mdp_dvr_nvr:              string | null;
  signature_data:           string | null;
  materiels:                InterventionMaterial[];
}

export interface InterventionDashboard {
  total:         number;
  planifiees:    number;
  en_cours:      number;
  terminees:     number;
  annulees:      number;
  aujourd_hui:   number;
  cette_semaine: number;
  urgentes:      number;
  recent:        Intervention[];
}

export interface PaginatedInterventions {
  count:    number;
  next:     string | null;
  previous: string | null;
  results:  Intervention[];
}

export interface Technicien {
  id:  number;
  nom: string;
}

function normalize(data: any): PaginatedInterventions {
  if (Array.isArray(data)) return { results: data, count: data.length, next: null, previous: null };
  return data;
}

export const interventionsService = {

  getAll: (params?: Record<string, any>) =>
    api.get<any>("/interventions/", { params }).then(r => normalize(r.data)),

  getById: (id: number) =>
    api.get<Intervention>(`/interventions/${id}/`).then(r => r.data),

  getDashboard: () =>
    api.get<InterventionDashboard>("/interventions/dashboard/").then(r => r.data),

  getTechnicians: () =>
    api.get<Technicien[]>("/interventions/technicians/").then(r => r.data),

  getResponsables: () =>
    api.get<Technicien[]>("/interventions/responsables/").then(r => r.data),

  assignerTechnicien: (id: number, technicien: number) =>
    api.patch<Intervention>(`/interventions/${id}/assigner-technicien/`, { technicien }).then(r => r.data),

  create: (data: Partial<Intervention> & { materiels_data?: any[] }) =>
    api.post<Intervention>("/interventions/", data).then(r => r.data),

  update: (id: number, data: Partial<Intervention> & { materiels_data?: any[] }) =>
    api.patch<Intervention>(`/interventions/${id}/`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/interventions/${id}/`).then(r => r.data),

  changeStatus: (id: number, statut: InterventionStatut, signature_data?: string) =>
    api.patch<Intervention>(`/interventions/${id}/change-status/`, {
      statut,
      ...(signature_data ? { signature_data } : {}),
    }).then(r => r.data),

  getPdfUrl: (id: number) =>
    `${api.defaults.baseURL}/interventions/${id}/pdf/`,

  downloadPdf: async (id: number, clientNom?: string | null) => {
    const token = localStorage.getItem("access_token");
    const resp  = await fetch(`${api.defaults.baseURL}/interventions/${id}/pdf/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob    = await resp.blob();
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement("a");
    a.href        = url;
    const safeName = clientNom ? clientNom.replace(/[^a-zA-Z0-9 _\-]/g, " ").trim() : String(id);
    a.download    = `Fiche Intervention ${safeName}.pdf`;
    a.target      = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 15_000);
  },
};
