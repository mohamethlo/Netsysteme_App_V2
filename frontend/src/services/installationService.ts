// ─────────────────────────────────────────────────────────────────────────────
//  src/services/installationsService.ts
// ─────────────────────────────────────────────────────────────────────────────
import api from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface UserInline {
  id:        number;
  prenom:    string;
  nom:       string;
  full_name: string;
}

export interface InstallationProduct {
  id:               number;
  product:          number | null;
  product_name:     string | null;
  product_image_url:string | null;
  quantity:         number;
  unit_price:       number;
  total_price:      number;
}

export interface PaymentScheduleItem {
  description: string;
  date:        string;
  montant:     number;
}

export type InstallationStatut   = "en_attente"|"en_cours"|"termine"|"annule";
export type InstallationMethode  = "cash"|"one_tranche"|"two_tranche"|"three_tranche"|"four_tranche"|"five_tranche"|"six_tranche";

export interface Installation {
  id:                      number;
  prenom:                  string | null;
  nom:                     string | null;
  telephone:               string;
  adresse:                 string | null;
  rccm:                    string | null;
  immatricule:             string | null;
  ninea:                   string | null;
  montant_total:           number;
  montant_avance:          number;
  montant_restant:         number;
  date_installation:       string | null;
  methode_paiement:        InstallationMethode | null;
  methode_display:         string;
  date_echeance:           string | null;
  contrat_path:            string | null;
  contrat_url:             string | null;
  statut:                  InstallationStatut;
  statut_display:          string;
  agent_commercial:        number | null;
  agent_commercial_detail: UserInline | null;
  techniciens:             number[];
  techniciens_detail:      UserInline[];
  products:                InstallationProduct[];
  client_name:             string;
  is_paid:                 boolean;
  payment_schedule:        PaymentScheduleItem[];
  created_at:              string;
  updated_at:              string;
}

export interface InstallationProductPayload {
  product_id:  number;
  quantity:    number;
  unit_price:  number;
  total_price: number;
}

export interface InstallationPayload {
  prenom?:          string;
  nom?:             string;
  telephone:        string;
  adresse?:         string | null;
  rccm?:            string | null;
  immatricule?:     string | null;
  ninea?:           string | null;
  montant_total:    number;
  montant_avance:   number;
  montant_restant?: number;
  date_installation?:string | null;
  methode_paiement?: InstallationMethode | null;
  date_echeance?:   string | null;
  statut?:          InstallationStatut;
  agent_commercial?:number | null;
  techniciens_ids?: number[];
  products_data?:   InstallationProductPayload[];
  invoice_id?:      number | null;
}

export interface InstallationDashboard {
  total_installations: number;
  en_attente:          number;
  en_cours:            number;
  terminees:           number;
  payees:              number;
  somme_total:         number;
  somme_restant:       number;
  somme_avance:        number;
}

export interface InvoiceOption {
  id:             number;
  invoice_number: string | null;
  date:           string | null;
  montant:        number;
  client:         string | null;
}

export interface FormData {
  agents_commerciaux: UserInline[];
  techniciens:        UserInline[];
  factures:           InvoiceOption[];
  products:           any[];
}

export interface PaginatedInstallations {
  count:    number;
  next:     string | null;
  previous: string | null;
  results:  Installation[];
}

const normalize = (data: any): PaginatedInstallations =>
  Array.isArray(data)
    ? { results: data, count: data.length, next: null, previous: null }
    : data;

// ── Service ───────────────────────────────────────────────────────────────────
export const installationsService = {

  getAll: (params?: Record<string, string | number>) =>
    api.get<any>("/installations/", { params }).then(r => normalize(r.data)),

  getById: (id: number) =>
    api.get<Installation>(`/installations/${id}/`).then(r => r.data),

  getDashboard: () =>
    api.get<InstallationDashboard>("/installations/dashboard/").then(r => r.data),

  getFormData: () =>
    api.get<FormData>("/installations/form-data/").then(r => r.data),

  create: (payload: InstallationPayload, contratFile?: File, generateContract?: boolean) => {
    const fd = new FormData();
    // Champs texte
    Object.entries(payload).forEach(([k, v]) => {
      if (k === "products_data" || k === "techniciens_ids") {
        fd.append(k, JSON.stringify(v ?? []));
      } else if (v !== undefined && v !== null) {
        fd.append(k, String(v));
      }
    });
    if (contratFile)      fd.append("contrat", contratFile);
    if (generateContract) fd.append("generate_contract", "1");
    return api.post<Installation>("/installations/", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data);
  },

  update: (id: number, payload: Partial<InstallationPayload>, contratFile?: File) => {
    const fd = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (k === "products_data" || k === "techniciens_ids") {
        fd.append(k, JSON.stringify(v ?? []));
      } else if (v !== undefined && v !== null) {
        fd.append(k, String(v));
      }
    });
    if (contratFile) fd.append("contrat", contratFile);
    return api.patch<Installation>(`/installations/${id}/`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data);
  },

  delete: (id: number) =>
    api.delete(`/installations/${id}/`).then(r => r.data),

  versement: (id: number, montant: number) =>
    api.post<{ installation: Installation; recu_url: string | null }>(
      `/installations/${id}/versement/`, { montant_verse: montant }
    ).then(r => r.data),

  generateContract: (id: number) =>
    api.post<{ detail: string; contrat_path: string; installation: Installation }>(
      `/installations/${id}/generate-contract/`
    ).then(r => r.data),

  getContractPdfUrl: (id: number) =>
    `${api.defaults.baseURL}/installations/${id}/contract-pdf/`,

  // ── Rappels de paiement ───────────────────────────────────────────────────

  getRemindersDashboard: () =>
    api.get<ReminderDashboard>("/installations/payment-reminders/dashboard/").then(r => r.data),

  getRemindersSummary: () =>
    api.get<{ success: boolean; summary: ReminderSummary }>("/installations/payment-reminders/summary/").then(r => r.data),

  checkAndSendReminders: (dry_run = false) =>
    api.post<{ success: boolean; message: string; results: ReminderResults }>(
      "/installations/payment-reminders/check/", { dry_run }
    ).then(r => r.data),

  getUpcomingPayments: () =>
    api.get<{ success: boolean; data: UpcomingPayment[]; total: number }>(
      "/installations/payment-reminders/upcoming/"
    ).then(r => r.data),

  getRemindersHistory: (period = "all") =>
    api.get<{ success: boolean; data: ReminderHistory[]; statistics: ReminderStats }>(
      "/installations/payment-reminders/history/", { params: { period } }
    ).then(r => r.data),

  getRemindersStatistics: () =>
    api.get<{ success: boolean; statistics: ReminderStats }>(
      "/installations/payment-reminders/statistics/"
    ).then(r => r.data),

  sendManualReminder: (id: number, payment_date?: string) =>
    api.post<{ success: boolean; message?: string }>(
      `/installations/${id}/send-reminder/`, payment_date ? { payment_date } : {}
    ).then(r => r.data),

  previewReminder: (id: number) =>
    api.get<ReminderPreview>(`/installations/${id}/preview-reminder/`).then(r => r.data),
};

// ── Types rappels de paiement ─────────────────────────────────────────────────

export interface UpcomingPaymentEntry {
  client:          string;
  phone:           string;
  amount:          number;
  montant_restant: number;
  date:            string;
  label:           string;
  already_sent?:   boolean;
}

export interface ReminderSummary {
  j_minus_5:          UpcomingPaymentEntry[];
  j_minus_2:          UpcomingPaymentEntry[];
  j_day:              UpcomingPaymentEntry[];
  total_to_send:      number;
  total_already_sent: number;
  total_skipped:      number;
}

export interface ReminderDashboardEntry {
  installation_id: number;
  client:          string;
  phone:           string;
  payment_date:    string;
  payment_label:   string;
  payment_amount:  number;
  montant_restant: number;
}

export interface ReminderDashboard {
  j_minus_5:            ReminderDashboardEntry[];
  j_minus_2:            ReminderDashboardEntry[];
  j_day:                ReminderDashboardEntry[];
  reminders_sent_today: number;
  today:                string;
}

export interface UpcomingPayment {
  installation_id: number;
  client_name:     string;
  phone:           string;
  payment_date:    string;
  payment_amount:  number;
  payment_label:   string;
  days_until:      number;
  reminder_needed: boolean;
  reminder_type:   string | null;
}

export interface ReminderHistory {
  id:               number;
  recipient_name:   string | null;
  phone:            string;
  message_template: string;
  status:           string;
  sent_at:          string;
  installation_id:  number | null;
  extra_data:       Record<string, any> | null;
}

export interface ReminderStats {
  total:        number;
  success:      number;
  failed:       number;
  success_rate: number;
  today?:       number;
  week?:        number;
  month?:       number;
  by_type: {
    j_minus_5: number;
    j_minus_2: number;
    j_day:     number;
  };
}

export interface ReminderResults {
  j_minus_5:     { sent: number; failed: number; skipped: number };
  j_minus_2:     { sent: number; failed: number; skipped: number };
  j_day:         { sent: number; failed: number; skipped: number };
  total_sent:    number;
  total_failed:  number;
  total_skipped: number;
  details:       any[];
}

export interface ReminderPreview {
  success:      boolean;
  client_name:  string;
  phone:        string;
  next_payment: { date: string; amount: number; montant_restant: number; label: string };
  messages:     { j_5?: string; j_2?: string; j_day?: string };
}