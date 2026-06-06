// ─────────────────────────────────────────────────────────────────────────────
//  src/store/authStore.ts
// ─────────────────────────────────────────────────────────────────────────────
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id:          number;
  username:    string;
  email:       string;
  full_name:   string;
  prenom:      string;
  nom:         string;
  role:        string | null;
  role_id:     number | null;
  permissions: string[];      // toujours un tableau
  is_active:   boolean;
  is_staff:    boolean;
  site:        string | null; // site d'affectation : "Dakar" | "Mbour" | null
}

interface AuthState {
  user:            AuthUser | null;
  accessToken:     string | null;
  refreshToken:    string | null;
  isAuthenticated: boolean;

  login:         (user: AuthUser, access: string, refresh: string) => void;
  logout:        () => void;
  setTokens:     (access: string, refresh: string) => void;
  updateUser:    (patch: Partial<AuthUser>) => void;
  hasPermission: (perm: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:            null,
      accessToken:     null,
      refreshToken:    null,
      isAuthenticated: false,

      login: (user, access, refresh) =>
        set({
          user: {
            ...user,
            // ── Garde défensive : s'assure que permissions est toujours un tableau
            permissions: Array.isArray(user.permissions) ? user.permissions : [],
          },
          accessToken:     access,
          refreshToken:    refresh,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user:            null,
          accessToken:     null,
          refreshToken:    null,
          isAuthenticated: false,
        }),

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),

      updateUser: (patch) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...patch } : state.user,
        })),

      hasPermission: (perm: string): boolean => {
        const user = get().user;
        if (!user) return false;

        // ── Garde défensive : permissions peut être undefined après hydratation
        const perms: string[] = Array.isArray(user.permissions)
          ? user.permissions
          : [];

        // Superadmin ou permission "all"
        if (user.is_staff)            return true;
        if (perms.includes("all"))    return true;
        if (perm === "all")           return perms.includes("all") || user.is_staff;

        return perms.includes(perm);
      },
    }),
    {
      name:    "netsys-auth",
      // Après hydratation depuis localStorage, normaliser permissions
      onRehydrateStorage: () => (state) => {
        if (state?.user && !Array.isArray(state.user.permissions)) {
          state.user.permissions = [];
        }
      },
    }
  )
);