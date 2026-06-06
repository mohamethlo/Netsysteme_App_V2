// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/users/RolesPage.tsx
//  Gestion des rôles et leurs permissions
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import { usersService, type Role, AVAILABLE_PERMISSIONS } from "../../services/usersService";
import { useSwal } from "../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../theme";

// ── Couleurs par rôle ─────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  administrateur: { bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
  commercial:     { bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  technicien:     { bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
  administration: { bg: "rgba(139,92,246,0.12)",  text: "#8b5cf6" },
};
const getRoleColor = (name = "") =>
  ROLE_COLORS[name.toLowerCase()] ?? { bg: "rgba(100,116,139,0.12)", text: "#64748b" };

// ── RoleFormModal ─────────────────────────────────────────────────────────────
function RoleFormModal({ dark, theme, role, onClose, onSaved }: {
  dark: boolean; theme: LayoutContext["theme"];
  role: Role | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const swal   = useSwal();
  const isEdit = !!role;
  const [saving, setSaving] = useState(false);
  const [name,   setName]   = useState(role?.name ?? "");
  const [selectedPerms, setSelectedPerms] = useState<string[]>(
    role?.permissions_list ?? []
  );

  const isAllSelected = selectedPerms.includes("all");

  const togglePerm = (key: string) => {
    if (key === "all") {
      setSelectedPerms(isAllSelected ? [] : ["all"]);
      return;
    }
    if (isAllSelected) return;
    setSelectedPerms(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { swal.error("Requis", "Le nom du rôle est obligatoire."); return; }
    setSaving(true);
    try {
      const permStr = isAllSelected ? "all" : selectedPerms.join(",");
      if (isEdit) {
        await usersService.updateRole(role!.id, name.trim(), permStr);
        swal.updated("Le rôle");
      } else {
        await usersService.createRole(name.trim(), permStr);
        swal.saved("Le rôle");
      }
      onSaved();
    } catch (err: any) {
      swal.error("Erreur", err?.response?.data?.detail ?? err?.response?.data?.name?.[0] ?? "Une erreur est survenue.");
    } finally { setSaving(false); }
  };

  const inp: React.CSSProperties = { width: "100%", padding: "0.62rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, outline: "none" };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.72rem", fontWeight: 600, color: theme.textSecondary, marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.05em" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 520, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.6)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: theme.textPrimary, marginBottom: 2 }}>
              {isEdit ? `Modifier « ${role!.name} »` : "Nouveau rôle"}
            </h2>
            <p style={{ fontSize: "0.78rem", color: theme.textMuted }}>Définissez les accès de ce rôle</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem", padding: 4 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={lbl}>Nom du rôle *</label>
            <input required value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Comptable, Manager…" style={inp} />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={lbl}>Permissions</label>

            {/* Toutes les permissions */}
            <div
              onClick={() => togglePerm("all")}
              style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.65rem 1rem", borderRadius: RADIUS.md, border: `2px solid ${isAllSelected ? "#ef4444" : theme.border}`, background: isAllSelected ? "rgba(239,68,68,0.06)" : "transparent", cursor: "pointer", marginBottom: "0.75rem", transition: "all 0.15s" }}>
              <div style={{ width: 18, height: 18, borderRadius: "4px", border: `2px solid ${isAllSelected ? "#ef4444" : theme.border}`, background: isAllSelected ? "#ef4444" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {isAllSelected && <span style={{ color: "#fff", fontSize: "0.7rem", fontWeight: 700 }}>✓</span>}
              </div>
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: isAllSelected ? "#ef4444" : theme.textPrimary }}>🛡 Toutes les permissions (Administrateur)</div>
                <div style={{ fontSize: "0.72rem", color: theme.textMuted }}>Accès complet à toutes les fonctionnalités</div>
              </div>
            </div>

            {/* Permissions individuelles */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", opacity: isAllSelected ? 0.35 : 1 }}>
              {AVAILABLE_PERMISSIONS.map(({ key, label }) => {
                const checked = selectedPerms.includes(key) && !isAllSelected;
                return (
                  <div key={key} onClick={() => togglePerm(key)}
                    style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.55rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${checked ? PALETTE.primary + "55" : theme.border}`, background: checked ? PALETTE.primary + "0a" : "transparent", cursor: isAllSelected ? "not-allowed" : "pointer", transition: "all 0.15s" }}>
                    <div style={{ width: 16, height: 16, borderRadius: "4px", border: `2px solid ${checked ? PALETTE.primary : theme.border}`, background: checked ? PALETTE.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {checked && <span style={{ color: "#fff", fontSize: "0.65rem", fontWeight: 700 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: "0.82rem", color: checked ? PALETTE.primary : theme.textSecondary, fontWeight: checked ? 600 : 400 }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Aperçu */}
          <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)", border: `1px solid ${theme.border}`, marginBottom: "1.25rem" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Permissions accordées</div>
            {isAllSelected ? (
              <span style={{ fontSize: "0.8rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>🛡 Toutes les permissions</span>
            ) : selectedPerms.length === 0 ? (
              <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>Aucune permission sélectionnée</span>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {selectedPerms.map(p => {
                  const label = AVAILABLE_PERMISSIONS.find(a => a.key === p)?.label ?? p;
                  return <span key={p} style={{ fontSize: "0.75rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: PALETTE.primary + "15", color: PALETTE.primary }}>{label}</span>;
                })}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.75rem", borderTop: `1px solid ${theme.border}` }}>
            <button type="button" onClick={onClose} style={{ padding: "0.62rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>Annuler</button>
            <button type="submit" disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.62rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? "rgba(6,182,212,0.45)" : `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
              {saving ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> Enregistrement…</> : isEdit ? "Enregistrer" : "Créer le rôle"}
            </button>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── RolesPage ─────────────────────────────────────────────────────────────────
export default function RolesPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const swal = useSwal();
  const [roles,    setRoles]    = useState<Role[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<Role | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRoles(await usersService.getRoles()); }
    catch { swal.serverError(); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (role: Role) => {
    if (role.users_count > 0) {
      swal.error("Impossible", `Ce rôle est utilisé par ${role.users_count} utilisateur(s).`);
      return;
    }
    if (!await swal.confirmDelete(`le rôle "${role.name}"`)) return;
    try { await usersService.deleteRole(role.id); swal.deleted("Le rôle"); load(); }
    catch (e: any) { swal.error("Erreur", e?.response?.data?.detail); }
  };

  return (
    <div style={{ fontFamily: FONTS.body }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem" }}>
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontSize: "1.5rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>Rôles & Permissions</h1>
          <p style={{ fontSize: "0.85rem", color: theme.textMuted, marginTop: 3 }}>Définissez les accès de chaque rôle</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.62rem 1.25rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
          + Nouveau rôle
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <div style={{ width: 34, height: 34, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
          {roles.map(role => {
            const rc = getRoleColor(role.name);
            return (
              <div key={role.id}
                style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "16px", overflow: "hidden", transition: "all 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = PALETTE.primary + "44")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = theme.border)}
              >
                {/* Header */}
                <div style={{ padding: "1.1rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "10px", background: rc.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
                      {role.permissions === "all" ? "🛡" : "👤"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem", color: theme.textPrimary }}>{role.name}</div>
                      <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "1px 7px", borderRadius: RADIUS.full, background: rc.bg, color: rc.text }}>
                        {role.users_count} utilisateur{role.users_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.3rem" }}>
                    <button onClick={() => { setEditing(role); setShowForm(true); }}
                      style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid rgba(59,130,246,0.3)`, background: "transparent", color: "#3b82f6", cursor: "pointer", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(59,130,246,0.1)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>✏️</button>
                    <button onClick={() => handleDelete(role)} disabled={role.users_count > 0}
                      style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid rgba(239,68,68,0.3)`, background: "transparent", color: "#ef4444", cursor: role.users_count > 0 ? "not-allowed" : "pointer", opacity: role.users_count > 0 ? 0.35 : 1, fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                      onMouseEnter={e => { if (role.users_count === 0) e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>🗑</button>
                  </div>
                </div>

                {/* Permissions */}
                <div style={{ padding: "1rem 1.25rem" }}>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.6rem" }}>Permissions</div>
                  {role.permissions === "all" || role.permissions_list.includes("all") ? (
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, padding: "3px 10px", borderRadius: RADIUS.full, background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>🛡 Toutes les permissions</span>
                  ) : role.permissions_list.length === 0 ? (
                    <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>Aucune permission</span>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                      {role.permissions_list.map(p => {
                        const label = AVAILABLE_PERMISSIONS.find(a => a.key === p)?.label ?? p;
                        return (
                          <span key={p} style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)", color: theme.textSecondary }}>
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {roles.length === 0 && !loading && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "3rem", color: theme.textMuted }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>👤</div>
              <div>Aucun rôle configuré. Créez votre premier rôle.</div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <RoleFormModal dark={dark} theme={theme} role={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}