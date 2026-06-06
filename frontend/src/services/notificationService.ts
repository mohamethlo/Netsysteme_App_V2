// src/services/notificationService.ts
import api from "./api";

export interface Notification {
  id:         number;
  message:    string;
  is_read:    boolean;
  created_at: string;
  time_ago:   string;
}

export const notificationService = {
  getAll: () =>
    api.get<any>("/messaging/notifications/").then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : (d.results ?? []) as Notification[];
    }),

  getUnreadCount: () =>
    api.get<{ count: number }>("/messaging/notifications/unread-count/").then(r => r.data),

  markRead: (id: number) =>
    api.post<Notification>(`/messaging/notifications/${id}/read/`).then(r => r.data),

  markAllRead: () =>
    api.post<{ updated: number }>("/messaging/notifications/mark-all-read/").then(r => r.data),

  delete: (id: number) =>
    api.delete(`/messaging/notifications/${id}/`).then(r => r.data),
};

export function getNotifColor(message: string, is_read: boolean): string {
  if (is_read) return "#6b7280";
  const m = message.toLowerCase();
  if (m.includes("erreur") || m.includes("échoué") || m.includes("échec") || m.includes("alerte"))
    return "#ef4444";
  if (m.includes("paiement") || m.includes("rappel") || m.includes("reliquat") || m.includes("retard"))
    return "#f59e0b";
  if (m.includes("validé") || m.includes("envoyé") || m.includes("succès") || m.includes("terminé") || m.includes("généré"))
    return "#10b981";
  return "#06b6d4";
}
