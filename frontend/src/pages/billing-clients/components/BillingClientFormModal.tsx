// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/billing-clients/components/BillingClientFormModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { billingService, type BillingClient } from "../../../services/billingService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark:    boolean;
  theme:   LayoutContext["theme"];
  client:  BillingClient | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  company_name: string;
  contact_name: string;
  email:        string;
  phone:        string;
  address:      string;
  tax_id:       string;
}

export default function BillingClientFormModal({ dark, theme, client, onClose, onSaved }: Props) {
  const swal   = useSwal();
  const isEdit = !!client;
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormState>({
    company_name: client?.company_name ?? "",
    contact_name: client?.contact_name ?? "",
    email:        client?.email        ?? "",
    phone:        client?.phone        ?? "",
    address:      client?.address      ?? "",
    tax_id:       client?.tax_id       ?? "",
  });
  const [errors, setErrors] = useState<Partial<FormState>>({});

  const set = (k: keyof FormState, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }));
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: Partial<FormState> = {};
    if (!form.phone.trim())                         errs.phone = "Le numéro de téléphone est obligatoire.";
    if (!form.company_name.trim() && !form.contact_name.trim())
      errs.company_name = "Le nom de l'entreprise ou du contact est requis.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Format email invalide.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        company_name: form.company_name.trim()  || null,
        contact_name: form.contact_name.trim()  || null,
        email:        form.email.trim()          || null,
        phone:        form.phone.trim(),
        address:      form.address.trim()        || null,
        tax_id:       form.tax_id.trim()         || null,
      };
      if (isEdit) {
        await billingService.clients.update(client!.id, payload);
        swal.updated("Le client");
      } else {
        await billingService.clients.create(payload);
        swal.saved("Le client");
      }
      onSaved();
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.phone)   swal.error("Erreur", data.phone[0]);
      else if (data?.detail) swal.error("Erreur", data.detail);
      else swal.serverError();
    } finally {
      setSaving(false);
    }
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const inp = (hasError?: boolean): React.CSSProperties => ({
    width: "100%", padding: "0.62rem 0.85rem",
    borderRadius: RADIUS.md,
    border: `1px solid ${hasError ? "#ef4444" : theme.border}`,
    background: hasError ? "rgba(239,68,68,0.05)" : theme.inputBg,
    color: theme.textPrimary,
    fontSize: "0.875rem", fontFamily: FONTS.body, outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box" as const,
  });

  const lbl: React.CSSProperties = {
    display: "block",
    fontSize: "0.73rem", fontWeight: 600,
    color: theme.textSecondary,
    marginBottom: "0.3rem",
    textTransform: "uppercase", letterSpacing: "0.05em",
  };

  const errMsg = (msg?: string) => msg
    ? <div style={{ fontSize: "0.72rem", color: "#ef4444", marginTop: "0.25rem" }}>{msg}</div>
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: theme.popupBg,
        border: `1px solid ${theme.border}`,
        borderRadius: "18px",
        width: "100%", maxWidth: 580,
        maxHeight: "92vh", overflowY: "auto",
        boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.6)" : "0 24px 60px rgba(0,0,0,0.15)",
        fontFamily: FONTS.body,
      }}>

        {/* ── Header ── */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: theme.popupBg, zIndex: 1, borderRadius: "18px 18px 0 0" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: theme.textPrimary, marginBottom: 2 }}>
              {isEdit ? `Modifier ${client!.display_name}` : "Nouveau client facturation"}
            </h2>
            <p style={{ fontSize: "0.78rem", color: theme.textMuted }}>
              {isEdit ? "Modifiez les informations du client" : "Renseignez les informations du nouveau client"}
            </p>
          </div>
          <button onClick={onClose}
            style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem", padding: 4, lineHeight: 1, borderRadius: RADIUS.md, transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = theme.textPrimary)}
            onMouseLeave={e => (e.currentTarget.style.color = theme.textMuted)}
          >✕</button>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>

          {/* Section : Identité */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ flex: 1, height: 1, background: theme.border }} />
              Identité
              <div style={{ flex: 1, height: 1, background: theme.border }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
              <div>
                <label style={lbl}>Nom de l'entreprise</label>
                <input
                  value={form.company_name}
                  onChange={e => set("company_name", e.target.value)}
                  placeholder="ACME Corp"
                  style={inp(!!errors.company_name)}
                />
                {errMsg(errors.company_name)}
              </div>
              <div>
                <label style={lbl}>Nom du contact</label>
                <input
                  value={form.contact_name}
                  onChange={e => set("contact_name", e.target.value)}
                  placeholder="Jean Dupont"
                  style={inp()}
                />
              </div>
            </div>
          </div>

          {/* Section : Coordonnées */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ flex: 1, height: 1, background: theme.border }} />
              Coordonnées
              <div style={{ flex: 1, height: 1, background: theme.border }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
              <div>
                <label style={lbl}>Téléphone <span style={{ color: "#ef4444" }}>*</span></label>
                <input
                  value={form.phone}
                  onChange={e => set("phone", e.target.value)}
                  placeholder="77 000 00 00"
                  style={inp(!!errors.phone)}
                />
                {errMsg(errors.phone)}
              </div>
              <div>
                <label style={lbl}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set("email", e.target.value)}
                  placeholder="contact@entreprise.com"
                  style={inp(!!errors.email)}
                />
                {errMsg(errors.email)}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Adresse</label>
                <textarea
                  value={form.address}
                  onChange={e => set("address", e.target.value)}
                  placeholder="Rue, quartier, ville…"
                  rows={2}
                  style={{ ...inp(), height: 72, resize: "vertical" }}
                />
              </div>
            </div>
          </div>

          {/* Section : Informations fiscales */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ flex: 1, height: 1, background: theme.border }} />
              Informations fiscales
              <div style={{ flex: 1, height: 1, background: theme.border }} />
            </div>
            <div>
              <label style={lbl}>NINEA / Numéro fiscal</label>
              <input
                value={form.tax_id}
                onChange={e => set("tax_id", e.target.value)}
                placeholder="Ex: 00123456 7Z3"
                style={inp()}
              />
              <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: "0.25rem" }}>
                Numéro d'Identification Nationale des Entreprises et Associations
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "1rem", borderTop: `1px solid ${theme.border}` }}>
            <button type="button" onClick={onClose}
              style={{ padding: "0.65rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body, transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = theme.navHoverBg)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              Annuler
            </button>
            <button type="submit" disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.65rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? "rgba(6,182,212,0.45)" : `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body, transition: "opacity 0.2s" }}
            >
              {saving
                ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> Enregistrement…</>
                : isEdit ? "Enregistrer les modifications" : "Créer le client"
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}