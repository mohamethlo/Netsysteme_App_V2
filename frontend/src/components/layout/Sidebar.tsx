// ─────────────────────────────────────────────────────────────────────────────
//  src/components/layout/Sidebar.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { NavLink, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { getTheme, GRADIENT_PRIMARY, FONTS, RADIUS, MODULE_COLORS } from "../../theme";

// ── Types ─────────────────────────────────────────────────────────────────────
interface NavItem {
  key:          string;
  label:        string;
  path:         string;
  perm:         string | null;   // permission requise (null = aucune restriction par permission)
  roles?:       string[];        // rôles autorisés (en plus des admins qui voient tout)
  exceptRoles?: string[];        // rôles exclus même s'ils ont la permission
  exact?:       boolean;
}

// ── Navigation config ─────────────────────────────────────────────────────────
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Principal",
    items: [
      { key: "dashboard",    label: "Dashboard",                  path: "/dashboard",          exact: true, perm: "all" },
      { key: "tech-dashboard", label: "Dashboard RT",            path: "/dashboard/tech",     perm: null, roles: ["Responsable Technique"] },
    ],
  },

  {
    label: "Gestion commerciale",
    items: [
      { key: "clients",       label: "Prospects",     path: "/dashboard/clients",       perm: "clients"       },
      { key: "interventions", label: "Interventions", path: "/dashboard/interventions", perm: "interventions", roles: ["Responsable Technique"] },
      { key: "installations", label: "Installations", path: "/dashboard/installations", perm: "all"           },
      { key: "devis",         label: "Devis",         path: "/dashboard/devis",         perm: "all",           roles: ["Responsable Technique", "Commercial", "commercial", "Technicien", "technicien"] },
      { key: "calendar",      label: "Calendrier",    path: "/dashboard/calendar",      perm: null,            roles: ["commercial"] },
    ],
  },
  {
    label: "Responsable Technique",
    items: [
      { key: "chantiers",          label: "Chantiers",             path: "/dashboard/chantiers",          perm: "chantiers", roles: ["Responsable Technique"] },
      { key: "outillage",          label: "Outillage",             path: "/dashboard/outillage",          perm: "outillage", roles: ["Responsable Technique"] },
      { key: "depenses-terrain",   label: "Dépenses terrain",      path: "/dashboard/depenses-terrain",   perm: "depenses_terrain", roles: ["Responsable Technique"] },
      { key: "assignments",        label: "Affectations",          path: "/dashboard/assignments",        perm: "all",       roles: ["Responsable Technique"] },
      { key: "attendance",         label: "Pointage",              path: "/dashboard/attendance",         perm: null,        roles: ["Responsable Technique"] },
      { key: "tech-locations",     label: "Localisation équipe",   path: "/dashboard/tech-locations",     perm: null,        roles: ["Responsable Technique"] },
    ],
  },
  {
    label: "Espace Technicien",
    items: [
      { key: "outillage",        label: "Mes réservations d'outils", path: "/dashboard/outillage",        perm: null, roles: ["Technicien", "technicien"] },
      { key: "depenses-terrain", label: "Mes dépenses terrain",      path: "/dashboard/depenses-terrain", perm: null, roles: ["Technicien", "technicien"] },
    ],
  },
  {
    label: "Finance & Stock",
    items: [
      { key: "billing",   label: "Facturation", path: "/dashboard/billing",   perm: "billing"   },
      { key: "expenses",  label: "Dépenses",    path: "/dashboard/expenses",  perm: "expenses"  },
      { key: "inventory", label: "Stock",       path: "/dashboard/inventory", perm: "inventory" },
    ],
  },
  {
    label: "Gestion RH",
    items: [
      { key: "attendance",     label: "Pointage",        path: "/dashboard/attendance",     perm: "attendance", exceptRoles: ["Responsable Technique"] },
      { key: "work-locations", label: "Zones de travail",path: "/dashboard/work-locations", perm: "all"        },
      { key: "sms",            label: "SMS",             path: "/dashboard/sms",            perm: "all"        },
      { key: "assignments",    label: "Affectations Techniciens",    path: "/dashboard/assignments",    perm: "all" },
      { key: "reports",        label: "Rapports Mensuels", path: "/dashboard/monthly", perm: "all" },
      { key: "users",          label: "Utilisateurs",    path: "/dashboard/users",          perm: "all"        },
      { key: "roles",          label: "Rôles & Permissions", path: "/dashboard/roles",       perm: "all"        },
      { key: "advances",       label: "Avance Salaire",     path: "/dashboard/advances",    perm: "all" },
    ],
  }
  
];

// ── Icons ─────────────────────────────────────────────────────────────────────
const ICON_PATHS: Record<string, string> = {
  dashboard:     "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
  clients:       "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
  interventions: "M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z",
  installations: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25",
  billing:       "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  inventory:     "M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z",
  expenses:      "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z",
  advances:      "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  attendance:    "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  sms:           "M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z",
  "work-locations": "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z",
  users:         "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  roles:         "M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z",
  assignments:   "M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z",
  reports:       "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  devis:         "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10",
  calendar:         "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z",
  "tech-dashboard":  "M3.75 3v11.25A2.25 2.25 0 006 16.5h12M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-12m12 0v3.75m-12 0v-3.75m0 3.75h12M3 12h18",
  "tech-locations":  "M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z",
  chantiers:        "M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z",
  outillage:          "M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z",
  "depenses-terrain": "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z",
};

function NavIcon({ name }: { name: string }) {
  return (
    <svg width={17} height={17} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
      <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[name] ?? ""} />
    </svg>
  );
}

interface SidebarProps {
  dark: boolean;
  mobileOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ dark, mobileOpen, onClose }: SidebarProps) {
  const { user, hasPermission } = useAuthStore();
  const location = useLocation();
  const t = getTheme(dark);

  return (
    <>
      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          onClick={onClose}
          className="mob-overlay"
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 49,
            display: "none", // affiché via CSS @media
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      <aside style={{
        width: 252,
        flexShrink: 0,
        height: "100%",
        background: t.sidebarBg,
        borderRight: `1px solid ${t.border}`,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        overflowX: "hidden",
        scrollbarWidth: "none",
        zIndex: 40,
        fontFamily: FONTS.body,
        transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
      }}>

        {/* ── Navigation ── */}
        <nav style={{ padding: "1rem 0.85rem 0", flex: 1 }}>
          {NAV_GROUPS.map((group) => {
            const visible = group.items.filter((it) => {
              if (it.exceptRoles?.includes(user?.role ?? "")) return false;       // rôle exclu explicitement
              if (hasPermission("all")) return true;                              // admin voit tout
              if (!it.perm && !it.roles) return true;                            // aucune restriction
              if (it.perm && hasPermission(it.perm)) return true;                // a la permission
              if (it.roles && it.roles.includes(user?.role ?? "")) return true;  // a le rôle requis
              return false;
            });
            if (!visible.length) return null;

            return (
              <div key={group.label} style={{ marginBottom: "1.25rem" }}>
                {/* Label du groupe */}
                <div
                  className="sb-group-label"
                  style={{
                    fontSize: "0.62rem", fontWeight: 700,
                    color: t.textMuted,
                    textTransform: "uppercase", letterSpacing: "0.12em",
                    padding: "0 0.5rem", marginBottom: "0.3rem",
                  }}
                >
                  {group.label}
                </div>

                {/* Items */}
                {visible.map((it) => {
                  const active =
                    it.exact
                      ? location.pathname === it.path
                      : location.pathname === it.path ||
                        (location.pathname.startsWith(it.path + "/") && it.path !== "/dashboard");

                  const accentColor = MODULE_COLORS[it.key] ?? t.navActiveAccent;

                  return (
                    <NavLink
                      key={it.key}
                      to={it.path}
                      onClick={onClose} // ferme le drawer mobile après navigation
                      data-label={it.label} // utilisé pour le tooltip tablette
                      className="sb-nav-item"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.65rem",
                        padding: "0.52rem 0.75rem",
                        borderRadius: RADIUS.md,
                        marginBottom: 2,
                        color: active ? accentColor : t.textPrimary,
                        background: active ? t.navActiveBg : "transparent",
                        textDecoration: "none",
                        fontSize: "0.865rem",
                        fontWeight: active ? 500 : 400,
                        transition: "all 0.15s",
                        position: "relative",
                      }}
                      onMouseEnter={(e) => {
                        if (!active) (e.currentTarget as HTMLElement).style.background = t.navHoverBg;
                      }}
                      onMouseLeave={(e) => {
                        if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                    >
                      {/* Indicateur actif */}
                      {active && (
                        <span style={{
                          position: "absolute", left: 0,
                          top: "18%", bottom: "18%",
                          width: 3, borderRadius: "0 3px 3px 0",
                          background: accentColor,
                        }} />
                      )}
                      <span style={{ opacity: active ? 1 : 0.5, flexShrink: 0 }}>
                        <NavIcon name={it.key} />
                      </span>
                      <span className="sb-label">{it.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* ── User card ── */}
        <div style={{ padding: "0.85rem", borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
          <div
            className="sb-user-card"
            style={{
              display: "flex", alignItems: "center", gap: "0.7rem",
              padding: "0.6rem 0.75rem",
              borderRadius: RADIUS.md,
              background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: GRADIENT_PRIMARY,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.72rem", fontWeight: 700, color: "#fff", flexShrink: 0,
            }}>
              {user ? `${user.prenom[0]}${user.nom[0]}`.toUpperCase() : "??"}
            </div>
            <div className="sb-user-info" style={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: "0.8rem", fontWeight: 600,
                color: t.textPrimary,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {user ? `${user.prenom} ${user.nom}` : "—"}
              </div>
              <div style={{ fontSize: "0.68rem", color: t.textMuted, textTransform: "capitalize" }}>
                {user?.role ?? "—"}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}