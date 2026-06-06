// ─────────────────────────────────────────────────────────────────────────────
//  src/services/usersService.ts
// ─────────────────────────────────────────────────────────────────────────────
import api from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Role {
  id:               number;
  name:             string;
  permissions:      string | null;
  permissions_list: string[];
  users_count:      number;
  created_at:       string;
}

export interface User {
  id:               number;
  username:         string;
  email:            string;
  nom:              string;
  prenom:           string;
  telephone:        string | null;
  site:             string | null;
  role:             Role | null;
  permissions:      string | null;
  permissions_list: string[];
  is_active:        boolean;
  is_staff:         boolean;
  full_name:        string;
  initials:         string;
  last_login:       string | null;
  created_at:       string;
}

export interface UserStats {
  total:           number;
  actifs:          number;
  inactifs:        number;
  administrateurs: number;
  commerciaux:     number;
  techniciens:     number;
}

export interface UserCreatePayload {
  username:          string;
  email:             string;
  nom:               string;
  prenom:            string;
  telephone?:        string;
  site?:             string;
  role_id:           number;
  extra_permissions?: string[];
  password:          string;
}

export interface UserUpdatePayload {
  email?:             string;
  nom?:               string;
  prenom?:            string;
  telephone?:         string;
  site?:              string;
  role_id?:           number;
  extra_permissions?: string[];
  is_active?:         boolean;
}

export interface PaginatedUsers {
  count:    number;
  next:     string | null;
  previous: string | null;
  results:  User[];
}

// ── Permissions disponibles (miroir du backend) ────────────────────────────────
export const AVAILABLE_PERMISSIONS = [
  { key: "interventions", label: "Interventions" },
  { key: "inventory",     label: "Stock"          },
  { key: "expenses",      label: "Dépenses"       },
  { key: "clients",       label: "Clients"        },
  { key: "installations", label: "Installations"  },
  { key: "billing",       label: "Facturation"    },
  { key: "attendance",    label: "Présences"      },
  { key: "messaging",     label: "Messagerie"     },
  { key: "advances",      label: "Avances"        },
];

// ── Service ───────────────────────────────────────────────────────────────────
export const usersService = {

  // ── Utilisateurs ─────────────────────────────────────────────────────────
  getAll: (params?: Record<string, string | number>) =>
    api.get<PaginatedUsers>("/auth/users/", { params }).then(r => r.data),

  getById: (id: number) =>
    api.get<User>(`/auth/users/${id}/`).then(r => r.data),

  getStats: () =>
    api.get<UserStats>("/auth/users/stats/").then(r => r.data),

  getAvailablePermissions: () =>
    api.get<string[]>("/auth/users/available-permissions/").then(r => r.data),

  create: (payload: UserCreatePayload) =>
    api.post<User>("/auth/users/", payload).then(r => r.data),

  update: (id: number, payload: UserUpdatePayload) =>
    api.patch<User>(`/auth/users/${id}/`, payload).then(r => r.data),

  delete: (id: number) =>
    api.delete(`/auth/users/${id}/`).then(r => r.data),

  toggleActive: (id: number) =>
    api.post<User>(`/auth/users/${id}/toggle-active/`).then(r => r.data),

  resetPassword: (id: number, password: string) =>
    api.post(`/auth/users/${id}/reset-password/`, { password }).then(r => r.data),

  // Tous les employés actifs sans pagination (pour envoi SMS groupé)
  getAllForSms: (roleId?: number) =>
    api.get<User[]>("/auth/users/all-for-sms/", { params: roleId ? { role: roleId } : undefined })
       .then(r => r.data),

  // ── Rôles ─────────────────────────────────────────────────────────────────
  getRoles: () =>
    api.get<Role[]>("/auth/roles/").then(r => {
      const d = r.data;
      return Array.isArray(d) ? d : (d as any).results ?? [];
    }),

  getRoleById: (id: number) =>
    api.get<Role>(`/auth/roles/${id}/`).then(r => r.data),

  createRole: (name: string, permissions: string) =>
    api.post<Role>("/auth/roles/", { name, permissions }).then(r => r.data),

  updateRole: (id: number, name: string, permissions: string) =>
    api.patch<Role>(`/auth/roles/${id}/`, { name, permissions }).then(r => r.data),

  deleteRole: (id: number) =>
    api.delete(`/auth/roles/${id}/`).then(r => r.data),
};