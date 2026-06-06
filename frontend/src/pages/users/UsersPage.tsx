// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/users/UsersPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import { usersService, type User, type Role, type UserStats } from "../../services/usersService";
import { useSwal } from "../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../theme";
import UserFormModal   from "./components/UserFormModal";
import UserDetailModal from "./components/UserDetailModal";

// ── Permission labels ─────────────────────────────────────────────────────────
const PERM_LABELS: Record<string, string> = {
  interventions: "Interventions",
  inventory:     "Stock",
  expenses:      "Dépenses",
  clients:       "Clients",
  installations: "Installations",
  billing:       "Facturation",
  attendance:    "Présences",
  messaging:     "Messagerie",
  advances:      "Avances",
  all:           "Toutes",
};

// ── Role badge colors ─────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  administrateur: { bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
  commercial:     { bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  technicien:     { bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
  administration: { bg: "rgba(139,92,246,0.12)",  text: "#8b5cf6" },
};
const getRoleColor = (name = "") =>
  ROLE_COLORS[name.toLowerCase()] ?? { bg: "rgba(100,116,139,0.12)", text: "#64748b" };

// ── Tiny components ───────────────────────────────────────────────────────────
function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.3, fontWeight: 700, color: "#fff",
      flexShrink: 0, fontFamily: FONTS.display,
    }}>{initials}</div>
  );
}

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: bg, color: text, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function IconBtn({ title, color, onClick, children }: { title: string; color?: string; onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button title={title} onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 30, height: 30, borderRadius: RADIUS.md,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: hov ? (color ? color + "18" : "rgba(100,116,139,0.12)") : "transparent",
        border: `1px solid ${hov ? (color ?? "#94a3b8") + "44" : "rgba(100,116,139,0.15)"}`,
        color: color ?? "#64748b", cursor: "pointer", transition: "all 0.15s",
      }}
    >{children}</button>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon, theme }: { label: string; value: number; color: string; icon: string; theme: LayoutContext["theme"] }) {
  return (
    <div style={{
      background: theme.cardBg, border: `1px solid ${theme.border}`,
      borderRadius: "14px", padding: "0.85rem 1rem",
      display: "flex", alignItems: "center", gap: "0.7rem",
      minWidth: 0, overflow: "hidden",
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: "10px",
        background: color + "18",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "1.1rem", flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
        <div style={{
          fontSize: "0.68rem", color: theme.textMuted,
          textTransform: "uppercase", letterSpacing: "0.05em",
          marginBottom: 2,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {label}
        </div>
        <div style={{
          fontSize: "1.4rem", fontWeight: 700,
          fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1,
        }}>
          {value}
        </div>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const Ico = ({ d, s = 16 }: { d: string; s?: number }) => (
  <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const I = {
  plus:    "M12 4.5v15m7.5-7.5h-15",
  search:  "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z",
  eye:     "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  edit:    "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z",
  userX:   "M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z",
  userChk: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  trash:   "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0",
  key:     "M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z",
  chevL:   "M15.75 19.5L8.25 12l7.5-7.5",
  chevR:   "M8.25 4.5l7.5 7.5-7.5 7.5",
  filter:  "M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75l4.5 4.5m0 0l-4.5 4.5m4.5-4.5H11.25",
};

// ── UsersPage ─────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { theme, dark }     = useOutletContext<LayoutContext>();
  const swal                = useSwal();

  // State
  const [users,   setUsers]   = useState<User[]>([]);
  const [roles,   setRoles]   = useState<Role[]>([]);
  const [stats,   setStats]   = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [total,   setTotal]   = useState(0);

  // Filters
  const [search,    setSearch]    = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage]           = useState(1);
  const PAGE_SIZE = 10;

  // Modals
  const [showForm,       setShowForm]       = useState(false);
  const [showDetail,     setShowDetail]     = useState(false);
  const [editingUser,    setEditingUser]    = useState<User | null>(null);
  const [detailUser,     setDetailUser]     = useState<User | null>(null);
  const [availablePerms, setAvailablePerms] = useState<string[]>([]);

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
      if (search)      params.search    = search;
      if (roleFilter)  params.role__name__iexact = roleFilter;
      if (statusFilter) params.is_active = statusFilter === "active" ? "true" : "false";

      const [usersRes, statsRes, rolesRes, permsRes] = await Promise.all([
        usersService.getAll(params),
        usersService.getStats(),
        usersService.getRoles(),
        usersService.getAvailablePermissions(),
      ]);
      setUsers(usersRes.results);
      setTotal(usersRes.count);
      setStats(statsRes);
      setRoles(rolesRes);
      setAvailablePerms(permsRes);
    } catch {
      swal.serverError();
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Debounce search
  useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleToggleActive = async (user: User) => {
    const action = user.is_active ? "désactiver" : "activer";
    const ok = await swal.confirm({ title: `${action.charAt(0).toUpperCase() + action.slice(1)} ${user.full_name} ?`, confirmText: action.charAt(0).toUpperCase() + action.slice(1), icon: "question" });
    if (!ok) return;
    try {
      await usersService.toggleActive(user.id);
      swal.success(`Utilisateur ${user.is_active ? "désactivé" : "activé"} avec succès`);
      load();
    } catch { swal.serverError(); }
  };

  const handleDelete = async (user: User) => {
    const ok = await swal.confirmDelete(user.full_name);
    if (!ok) return;
    try {
      await usersService.delete(user.id);
      swal.deleted("L'utilisateur");
      load();
    } catch { swal.serverError(); }
  };

  const handleResetPassword = async (user: User) => {
    const pwd = await swal.prompt({ title: `Nouveau mot de passe pour ${user.prenom}`, placeholder: "Min. 6 caractères", confirmText: "Réinitialiser", validator: (v) => v.length < 6 ? "Minimum 6 caractères." : null });
    if (!pwd) return;
    try {
      await usersService.resetPassword(user.id, pwd);
      swal.success("Mot de passe réinitialisé");
    } catch { swal.serverError(); }
  };

  const handleSaved = () => { setShowForm(false); setEditingUser(null); load(); };

  // ── Pagination ───────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: FONTS.body }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .usr-header { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.75rem; }
        @media (min-width: 480px) {
          .usr-header { flex-direction: row; justify-content: space-between; align-items: flex-start; }
        }
        /* Grille des stats : 2 col mobile → 3 col tablette → 6 col large */
        .usr-stat-grid { grid-template-columns: repeat(2, 1fr); }
        @media (min-width: 600px)  { .usr-stat-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1100px) { .usr-stat-grid { grid-template-columns: repeat(6, 1fr); } }
      `}</style>

      {/* ── Page header ── */}
      <div className="usr-header">
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontSize: "1.5rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>
            Gestion des utilisateurs
          </h1>
          <p style={{ fontSize: "0.85rem", color: theme.textMuted, marginTop: 3 }}>
            Créer, modifier et gérer les comptes de l'équipe
          </p>
        </div>
        <button
          onClick={() => { setEditingUser(null); setShowForm(true); }}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, border: "none", borderRadius: RADIUS.md, padding: "0.6rem 1.25rem", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap" }}
        >
          <Ico d={I.plus} /> Nouvel utilisateur
        </button>
      </div>

      {/* ── Stats ── */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.75rem" }} className="usr-stat-grid">
          <StatCard label="Total"          value={stats.total}           color={PALETTE.primary} icon="👥" theme={theme} />
          <StatCard label="Actifs"         value={stats.actifs}          color={PALETTE.success} icon="✅" theme={theme} />
          <StatCard label="Administrateurs" value={stats.administrateurs} color={PALETTE.danger}  icon="🛡" theme={theme} />
          <StatCard label="Commerciaux"    value={stats.commerciaux}     color={PALETTE.success} icon="💼" theme={theme} />
          <StatCard label="Techniciens"    value={stats.techniciens}     color={PALETTE.warning} icon="🔧" theme={theme} />
          <StatCard label="Inactifs"       value={stats.inactifs}        color={PALETTE.danger}  icon="🚫" theme={theme} />
        </div>
      )}

      {/* ── Filtres ── */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", padding: "1rem 1.25rem", marginBottom: "1rem", display: "flex", gap: "0.85rem", flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <div style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted }}>
            <Ico d={I.search} />
          </div>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, email, username…"
            style={{ width: "100%", paddingLeft: "2.5rem", padding: "0.55rem 0.75rem 0.55rem 2.5rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", outline: "none", fontFamily: FONTS.body }}
          />
        </div>

        {/* Role filter */}
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          style={{ padding: "0.55rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
          <option value="">Tous les rôles</option>
          {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
        </select>

        {/* Status filter */}
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "0.55rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
          <option value="">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
        </select>

        <span style={{ fontSize: "0.8rem", color: theme.textMuted, marginLeft: "auto" }}>
          {total} utilisateur{total > 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table ── */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: theme.textMuted }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>👥</div>
            <div style={{ fontWeight: 500, color: theme.textSecondary }}>Aucun utilisateur trouvé</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  {["Utilisateur", "Email", "Téléphone", "Rôle", "Permissions", "Dernière connexion", "Statut", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.72rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => {
                  const rc = getRoleColor(user.role?.name);
                  const isLast = idx === users.length - 1;
                  return (
                    <tr key={user.id}
                      style={{ borderBottom: isLast ? "none" : `1px solid ${theme.border}`, transition: "background 0.12s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = theme.cardBgHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Utilisateur */}
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                          <Avatar initials={user.initials} size={34} />
                          <div>
                            <div style={{ fontWeight: 600, color: theme.textPrimary }}>{user.full_name}</div>
                            <div style={{ fontSize: "0.75rem", color: theme.textMuted }}>@{user.username}</div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td style={{ padding: "0.85rem 1rem", color: theme.textSecondary, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {user.email}
                      </td>

                      {/* Téléphone */}
                      <td style={{ padding: "0.85rem 1rem", color: user.telephone ? theme.textSecondary : theme.textMuted }}>
                        {user.telephone ?? "—"}
                      </td>

                      {/* Rôle */}
                      <td style={{ padding: "0.85rem 1rem" }}>
                        {user.role ? <Badge label={user.role.name} {...rc} /> : <span style={{ color: theme.textMuted }}>—</span>}
                      </td>

                      {/* Permissions */}
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", maxWidth: 200 }}>
                          {user.permissions_list.length === 0 ? (
                            <span style={{ color: theme.textMuted, fontSize: "0.8rem" }}>Aucune</span>
                          ) : user.permissions_list.includes("all") ? (
                            <Badge label="Toutes" bg="rgba(239,68,68,0.12)" text="#ef4444" />
                          ) : (
                            user.permissions_list.slice(0, 3).map((p) => (
                              <Badge key={p} label={PERM_LABELS[p] ?? p} bg={dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"} text={theme.textSecondary} />
                            ))
                          )}
                          {user.permissions_list.length > 3 && !user.permissions_list.includes("all") && (
                            <Badge label={`+${user.permissions_list.length - 3}`} bg={dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"} text={theme.textMuted} />
                          )}
                        </div>
                      </td>

                      {/* Dernière connexion */}
                      <td style={{ padding: "0.85rem 1rem", color: theme.textMuted, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        {user.last_login
                          ? new Date(user.last_login).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                          : "Jamais"}
                      </td>

                      {/* Statut */}
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <Badge
                          label={user.is_active ? "Actif" : "Inactif"}
                          bg={user.is_active ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)"}
                          text={user.is_active ? "#10b981" : "#ef4444"}
                        />
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                          <IconBtn title="Voir détails" color="#06b6d4" onClick={() => { setDetailUser(user); setShowDetail(true); }}>
                            <Ico d={I.eye} s={14} />
                          </IconBtn>
                          <IconBtn title="Modifier" color="#3b82f6" onClick={() => { setEditingUser(user); setShowForm(true); }}>
                            <Ico d={I.edit} s={14} />
                          </IconBtn>
                          <IconBtn title="Réinitialiser mot de passe" color="#f59e0b" onClick={() => handleResetPassword(user)}>
                            <Ico d={I.key} s={14} />
                          </IconBtn>
                          <IconBtn
                            title={user.is_active ? "Désactiver" : "Activer"}
                            color={user.is_active ? "#f59e0b" : "#10b981"}
                            onClick={() => handleToggleActive(user)}
                          >
                            <Ico d={user.is_active ? I.userX : I.userChk} s={14} />
                          </IconBtn>
                          {!user.is_active && (
                            <IconBtn title="Supprimer" color="#ef4444" onClick={() => handleDelete(user)}>
                              <Ico d={I.trash} s={14} />
                            </IconBtn>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1.25rem", borderTop: `1px solid ${theme.border}` }}>
            <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>
              Page {page} / {totalPages} — {total} résultat{total > 1 ? "s" : ""}
            </span>
            <div style={{ display: "flex", gap: "0.35rem" }}>
              {[...Array(totalPages)].map((_, i) => {
                const p = i + 1;
                const isActive = p === page;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    style={{ width: 32, height: 32, borderRadius: RADIUS.md, border: `1px solid ${isActive ? PALETTE.primary : theme.border}`, background: isActive ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : "transparent", color: isActive ? "#fff" : theme.textMuted, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body }}>
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showForm && (
        <UserFormModal
          dark={dark} theme={theme}
          user={editingUser}
          roles={roles}
          availablePerms={availablePerms}
          onClose={() => { setShowForm(false); setEditingUser(null); }}
          onSaved={handleSaved}
        />
      )}
      {showDetail && detailUser && (
        <UserDetailModal
          dark={dark} theme={theme}
          user={detailUser}
          onClose={() => { setShowDetail(false); setDetailUser(null); }}
          onEdit={() => { setShowDetail(false); setEditingUser(detailUser); setShowForm(true); }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}