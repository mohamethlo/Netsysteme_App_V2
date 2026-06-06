// src/services/clientsService.ts
import api from "./api";

export type TypeClient = "prospect" | "client";

export interface NextReminder {
  id:            number;
  notes:         string;
  remind_at:     string | null;
  remind_at_str: string | null;
  created_at:    string;
}

// ── AJOUT ─────────────────────────────────────────────────────────────────────
export interface LastCallComment {
  resultat_appel:  "client_joint" | "client_non_joint";
  commentaires:    string | null;
  motif_principal: string | null;
  motif_refus:     string | null;
  date_appel_str:  string | null;
  created_by:      string | null;
}
// ──────────────────────────────────────────────────────────────────────────────

export interface CRMClient {
  id:                number;
  nom:               string;
  prenom:            string | null;
  display_name:      string;
  entreprise:        string | null;
  email:             string | null;
  telephone:         string | null;
  adresse:           string | null;
  ville:             string | null;
  code_postal:       string | null;
  type_client:       TypeClient;
  type_display:      string;
  assigned_to:       number | null;
  assigned_to_name:  string | null;
  is_blacklisted:    boolean;
  date_blacklisted:  string | null;
  note_conversion:   string | null;
  converted_by:      number | null;
  converted_by_name: string | null;
  converted_at:      string | null;
  next_reminder:     NextReminder | null;
  last_call_comment: LastCallComment | null;  // ← AJOUT
  created_at:        string;
  created_at_str:    string | null;
}

export interface CallHistoryEntry {
  id:                number;
  client:            number;
  created_by:        number | null;
  created_by_name:   string;
  nom:               string;
  prenom:            string | null;
  adresse:           string | null;
  contact_1:         string;
  contact_2:         string | null;
  resultat_appel:    "client_joint" | "client_non_joint";
  categorie:         string | null;
  motif_principal:   string | null;
  motif_refus:       string | null;
  motif_refus_detail:string | null;
  moratoire:         string | null;
  commentaires:      string | null;
  date_appel:        string;
  date_appel_str:    string | null;
  date_installation: string | null;
  date_maintenance_1:string | null;
  date_maintenance_2:string | null;
  created_at:        string;
}

export interface ClientStats {
  total:          number;
  total_clients:  number;
  total_prospects:number;
  blacklisted:    number;
}

export interface PaginatedClients {
  count:    number;
  next:     string | null;
  previous: string | null;
  results:  CRMClient[];
}

const normClients = (d: any): PaginatedClients =>
  Array.isArray(d)
    ? { results: d, count: d.length, next: null, previous: null }
    : d;

const normArray = <T>(d: any): T[] =>
  Array.isArray(d) ? d : (d?.results ?? []);

export const clientsService = {
  getAll: (params?: Record<string, any>) =>
    api.get<any>("/clients/", { params }).then(r => normClients(r.data)),

  getById: (id: number) =>
    api.get<CRMClient>(`/clients/${id}/`).then(r => r.data),

  create: (data: Partial<CRMClient>) =>
    api.post<CRMClient>("/clients/", data).then(r => r.data),

  update: (id: number, data: Partial<CRMClient>) =>
    api.patch<CRMClient>(`/clients/${id}/`, data).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/clients/${id}/`).then(r => r.data),

  getStats: () =>
    api.get<ClientStats>("/clients/stats/").then(r => r.data),

  convert: (id: number, note: string) =>
    api.post<CRMClient>(`/clients/${id}/convert/`, { note }).then(r => r.data),

  blacklist: (id: number) =>
    api.post<{ success: boolean; message: string }>(`/clients/${id}/blacklist/`).then(r => r.data),

  remind: (id: number, notes: string, remind_date?: string) =>
    api.post<{ success: boolean; message: string }>(
      `/clients/${id}/remind/`, { notes, remind_date }
    ).then(r => r.data),

  importExcel: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post<{ success: boolean; message: string; inserted: number; ignored: number }>(
      "/clients/import/",
      fd,
      { headers: { "Content-Type": "multipart/form-data" } },
    ).then(r => r.data);
  },

  deleteLastImport: () =>
    api.delete<{ success: boolean; message: string; count: number }>(
      "/clients/delete-last-import/"
    ).then(r => r.data),

  exportCsv: () => {
    const token = localStorage.getItem("access_token");
    const url   = `${api.defaults.baseURL}/clients/export-csv/`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `clients_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
      });
  },

  getBlacklisted: (params?: Record<string, any>) =>
    api.get<any>("/clients/", { params: { ...params, blacklisted: "1" } }).then(r => normClients(r.data)),

  calls: {
    getAll: (clientId: number, params?: Record<string, any>) =>
      api.get<any>("/clients/calls/", { params: { client_id: clientId, ...params } })
        .then(r => normArray<CallHistoryEntry>(r.data)),

    create: (data: Partial<CallHistoryEntry> & { client: number }) =>
      api.post<CallHistoryEntry>("/clients/calls/", data).then(r => r.data),

    delete: (id: number) =>
      api.delete(`/clients/calls/${id}/`).then(r => r.data),

    exportCsv: (clientId: number) => {
      const token = localStorage.getItem("access_token");
      const url   = `${api.defaults.baseURL}/clients/calls/export-csv/?client_id=${clientId}`;
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.blob())
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = `historique_appels_${clientId}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
        });
    },
  },
};