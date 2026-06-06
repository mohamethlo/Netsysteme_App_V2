// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/billing-clients/components/BillingClientDetailModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { type LayoutContext } from "../../../layouts/MainLayout";
import { type BillingClient } from "../../../services/billingService";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark:     boolean;
  theme:    LayoutContext["theme"];
  client:   BillingClient;
  onClose:  () => void;
  onEdit:   () => void;
  onDelete: () => void;
}

function InfoRow({ icon, label, value, href, theme }: {
  icon: string; label: string; value: string | null | undefined;
  href?: string; theme: LayoutContext["theme"];
}) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: "0.85rem", alignItems: "flex-start", padding: "0.65rem 0", borderBottom: `1px solid ${theme.border}` }}>
      <span style={{ fontSize: "1.1rem", flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.7rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
        {href ? (
          <a href={href} style={{ fontSize: "0.9rem", color: PALETTE.primary, textDecoration: "none", wordBreak: "break-word" }}>{value}</a>
        ) : (
          <div style={{ fontSize: "0.9rem", color: theme.textPrimary, wordBreak: "break-word" }}>{value}</div>
        )}
      </div>
    </div>
  );
}

export default function BillingClientDetailModal({ dark, theme, client: c, onClose, onEdit, onDelete }: Props) {
  const initials = c.display_name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: theme.popupBg,
        border: `1px solid ${theme.border}`,
        borderRadius: "18px",
        width: "100%", maxWidth: 500,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.6)" : "0 24px 60px rgba(0,0,0,0.15)",
        fontFamily: FONTS.body,
      }}>

        {/* ── Header avec avatar ── */}
        <div style={{ padding: "1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", gap: "1rem", alignItems: "flex-start" }}>
          {/* Avatar */}
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", fontWeight: 700, color: "#fff", flexShrink: 0, fontFamily: FONTS.display }}>
            {initials || "?"}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1.15rem", fontWeight: 700, color: theme.textPrimary, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {c.company_name ?? c.contact_name ?? "—"}
            </h2>
            {c.company_name && c.contact_name && (
              <div style={{ fontSize: "0.82rem", color: theme.textMuted, marginBottom: 6 }}>{c.contact_name}</div>
            )}
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {c.tax_id && (
                <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
                  NINEA: {c.tax_id}
                </span>
              )}
              <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: c.can_delete ? "rgba(16,185,129,0.1)" : "rgba(59,130,246,0.1)", color: c.can_delete ? "#10b981" : "#3b82f6" }}>
                {c.can_delete ? "Aucune facture liée" : "Factures associées"}
              </span>
            </div>
          </div>

          <button onClick={onClose}
            style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem", flexShrink: 0, alignSelf: "flex-start", padding: 4, lineHeight: 1 }}>✕
          </button>
        </div>

        {/* ── Infos ── */}
        <div style={{ padding: "1.25rem 1.5rem" }}>
          <InfoRow icon="📞" label="Téléphone"   value={c.phone}        href={`tel:${c.phone}`}      theme={theme} />
          <InfoRow icon="📧" label="Email"        value={c.email}        href={`mailto:${c.email}`}   theme={theme} />
          <InfoRow icon="📍" label="Adresse"      value={c.address}                                   theme={theme} />
          <InfoRow icon="🏢" label="Entreprise"   value={c.company_name}                              theme={theme} />
          <InfoRow icon="👤" label="Contact"       value={c.contact_name}                              theme={theme} />
          <InfoRow icon="🔖" label="NINEA / Fiscal" value={c.tax_id}                                  theme={theme} />

          {/* Date création */}
          <div style={{ display: "flex", gap: "0.85rem", alignItems: "center", padding: "0.65rem 0", borderBottom: `1px solid ${theme.border}` }}>
            <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>📅</span>
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Client depuis</div>
              <div style={{ fontSize: "0.9rem", color: theme.textPrimary }}>
                {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ padding: "1rem 1.5rem", borderTop: `1px solid ${theme.border}`, display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
          {c.can_delete && (
            <button onClick={onDelete}
              style={{ padding: "0.6rem 1rem", borderRadius: RADIUS.md, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#ef4444", fontSize: "0.85rem", cursor: "pointer", fontFamily: FONTS.body, transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.07)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              🗑 Supprimer
            </button>
          )}
          <button onClick={onClose}
            style={{ padding: "0.6rem 1rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.85rem", cursor: "pointer", fontFamily: FONTS.body }}
          >
            Fermer
          </button>
          <button onClick={onEdit}
            style={{ padding: "0.6rem 1.25rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}
          >
            ✏️ Modifier
          </button>
        </div>
      </div>
    </div>
  );
}