// src/services/smsService.ts
import api from "./api";

export type SMSStatus = "pending" | "success" | "failed";
export type SMSDomain = "NETSYSTEME" | "SSE";

export interface SMSHistoryEntry {
  id:                number;
  recipient_name:    string | null;
  phone:             string;
  message:           string;
  message_template:  string | null;
  status:            SMSStatus;
  error_message:     string | null;
  sent_at:           string;
  sent_at_str:       string | null;
  sent_by:           number | null;
  sent_by_name:      string | null;
  billing_client_id: number | null;
  installation_id:   number | null;
  provider:          string;
  message_id:        string | null;
  cost:              number;
  sender_domain:     SMSDomain;
  extra_data:        any;
}

export interface SMSTemplate {
  id:              number;
  name:            string;
  description:     string | null;
  content:         string;
  category:        string | null;
  is_active:       boolean;
  usage_count:     number;
  created_at:      string;
  created_by:      number | null;
  created_by_name: string | null;
}

export interface SMSStats {
  total:        number;
  success:      number;
  failed:       number;
  today:        number;
  month:        number;
  success_rate: number;
}

export interface SMSDomainInfo {
  value:       SMSDomain;
  label:       string;
  sender_name: string;
}

export interface PaginatedSMS {
  count:    number;
  next:     string | null;
  previous: string | null;
  results:  SMSHistoryEntry[];
}

export interface BulkRecipient {
  phone:   string;
  name?:   string;
  message: string;
}

// Normalise réponse paginée ou tableau brut
function normSMS(d: any): PaginatedSMS {
  if (Array.isArray(d)) return { results: d, count: d.length, next: null, previous: null };
  return d;
}

// ── JSON headers explicites ───────────────────────────────────────────────────
const JSON_HEADERS = { "Content-Type": "application/json" };

export const smsService = {

  // ── Historique ────────────────────────────────────────────────────────────
  getHistory: (params?: Record<string, any>) =>
    api.get<any>("/sms/", { params }).then(r => normSMS(r.data)),

  getById: (id: number) =>
    api.get<SMSHistoryEntry>(`/sms/${id}/`).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/sms/${id}/`).then(r => r.data),

  getStats: () =>
    api.get<SMSStats>("/sms/stats/").then(r => r.data),

  getDomains: () =>
    api.get<{ success: boolean; domains: SMSDomainInfo[] }>("/sms/domains/")
       .then(r => r.data.domains ?? []),

  // ── Envoi rapide — JSON explicite pour que Django parse correctement ───────
  sendQuick: (payload: {
    phone:           string;
    message:         string;
    recipient_name?: string;
    sender_domain?:  SMSDomain;
  }) => {
    // S'assurer que le payload est bien un objet JSON sérialisable
    const body = {
      phone:          String(payload.phone).trim(),
      message:        String(payload.message).trim(),
      recipient_name: payload.recipient_name ?? "Destinataire",
      sender_domain:  payload.sender_domain  ?? "NETSYSTEME",
    };
    return api
      .post<{ success: boolean; message: string; sender_domain: string }>(
        "/sms/send-quick/",
        body,
        { headers: JSON_HEADERS },
      )
      .then(r => r.data);
  },

  // ── Envoi groupé ──────────────────────────────────────────────────────────
  sendBulk: (payload: {
    recipients?:         BulkRecipient[];
    billing_client_ids?: number[];
    message_template?:   string;
    sender_domain?:      SMSDomain;
  }) =>
    api
      .post<{ success: boolean; message: string; results: any }>(
        "/sms/send-bulk/",
        payload,
        { headers: JSON_HEADERS },
      )
      .then(r => r.data),

  // ── Export CSV ────────────────────────────────────────────────────────────
  exportCsv: (params?: Record<string, any>) => {
    const token = localStorage.getItem("access_token");
    const query = params
      ? "?" + new URLSearchParams(
          Object.fromEntries(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
          )
        ).toString()
      : "";
    fetch(`${api.defaults.baseURL}/sms/export-csv/${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `sms_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      });
  },

  // ── Templates ─────────────────────────────────────────────────────────────
  templates: {
    getAll: (params?: Record<string, any>) =>
      api.get<any>("/sms/templates/", { params })
         .then(r => Array.isArray(r.data) ? r.data : (r.data.results ?? [])),

    getById: (id: number) =>
      api.get<SMSTemplate>(`/sms/templates/${id}/`).then(r => r.data),

    create: (data: Partial<SMSTemplate>) =>
      api.post<SMSTemplate>("/sms/templates/", data, { headers: JSON_HEADERS }).then(r => r.data),

    update: (id: number, data: Partial<SMSTemplate>) =>
      api.patch<SMSTemplate>(`/sms/templates/${id}/`, data, { headers: JSON_HEADERS }).then(r => r.data),

    delete: (id: number) =>
      api.delete(`/sms/templates/${id}/`).then(r => r.data),

    markUsed: (id: number) =>
      api.post(`/sms/templates/${id}/use/`).then(r => r.data),
  },
};