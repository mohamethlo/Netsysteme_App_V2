// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/users/components/UserDetailModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { type LayoutContext } from "../../../layouts/MainLayout";
import { type User } from "../../../services/usersService";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

const PERM_LABELS: Record<string, string> = {
  interventions: "Interventions", inventory: "Stock", expenses: "Dépenses",
  clients: "Clients", installations: "Installations", billing: "Facturation",
  attendance: "Présences", messaging: "Messagerie", advances: "Avances",
  all: "Toutes les permissions",
};

interface Props {
  dark:    boolean;
  theme:   LayoutContext["theme"];
  user:    User;
  onClose: () => void;
  onEdit:  () => void;
}

function Row({ label, value, theme }: { label: string; value: React.ReactNode; theme: LayoutContext["theme"] }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0.6rem 0", borderBottom: `1px solid ${theme.border}` }}>
      <span style={{ fontSize: "0.8rem", color: theme.textMuted, flexShrink: 0, minWidth: 140 }}>{label}</span>
      <span style={{ fontSize: "0.875rem", color: theme.textPrimary, textAlign: "right", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function UserDetailModal({ dark, theme, user, onClose, onEdit }: Props) {
  const roleName = user.role?.name?.toLowerCase() ?? "";
  const roleColors: Record<string, { bg: string; text: string }> = {
    administrateur: { bg: "rgba(239,68,68,0.12)", text: "#ef4444" },
    commercial:     { bg: "rgba(16,185,129,0.12)", text: "#10b981" },
    technicien:     { bg: "rgba(245,158,11,0.12)", text: "#f59e0b" },
  };
  const rc = roleColors[roleName] ?? { bg: "rgba(100,116,139,0.12)", text: "#64748b" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.6)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

        {/* Header avec avatar */}
        <div style={{ padding: "1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", gap: "1rem", alignItems: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", fontWeight: 700, color: "#fff", fontFamily: FONTS.display, flexShrink: 0 }}>
            {user.initials}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1.1rem", fontWeight: 700, color: theme.textPrimary }}>{user.full_name}</h2>
            <div style={{ fontSize: "0.8rem", color: theme.textMuted }}>@{user.username}</div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
              {user.role && (
                <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: rc.bg, color: rc.text }}>
                  {user.role.name}
                </span>
              )}
              <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: user.is_active ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", color: user.is_active ? "#10b981" : "#ef4444" }}>
                {user.is_active ? "Actif" : "Inactif"}
              </span>
              {user.site && (
                <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: "rgba(6,182,212,0.1)", color: PALETTE.primary }}>
                  {user.site}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.2rem", alignSelf: "flex-start", padding: 4 }}>✕</button>
        </div>

        {/* Détails */}
        <div style={{ padding: "1.25rem 1.5rem" }}>
          <Row label="Email"              value={user.email}     theme={theme} />
          <Row label="Téléphone"          value={user.telephone ?? "—"} theme={theme} />
          <Row label="Nom d'utilisateur"  value={`@${user.username}`}  theme={theme} />
          <Row label="Site"               value={user.site ?? "—"}     theme={theme} />
          <Row
            label="Créé le"
            value={new Date(user.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
            theme={theme}
          />
          <Row
            label="Dernière connexion"
            value={user.last_login
              ? new Date(user.last_login).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
              : "Jamais connecté"}
            theme={theme}
          />

          {/* Permissions */}
          <div style={{ marginTop: "1rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.6rem" }}>Permissions actives</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {user.permissions_list.length === 0 ? (
                <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>Aucune permission</span>
              ) : user.permissions_list.includes("all") ? (
                <span style={{ fontSize: "0.78rem", fontWeight: 600, padding: "3px 10px", borderRadius: RADIUS.full, background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                  Toutes les permissions (Administrateur)
                </span>
              ) : (
                user.permissions_list.map((p) => (
                  <span key={p} style={{ fontSize: "0.78rem", fontWeight: 500, padding: "3px 10px", borderRadius: RADIUS.full, background: `rgba(6,182,212,0.1)`, color: PALETTE.primary, border: `1px solid rgba(6,182,212,0.2)` }}>
                    {PERM_LABELS[p] ?? p}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "0.85rem 1.5rem", borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <button onClick={onClose}
            style={{ padding: "0.6rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
            Fermer
          </button>
          <button onClick={onEdit}
            style={{ padding: "0.6rem 1.25rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
            Modifier
          </button>
        </div>
      </div>
    </div>
  );
}