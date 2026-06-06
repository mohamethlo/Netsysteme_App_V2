// src/pages/clients/components/ClientDetailModal.tsx
import { useState } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { clientsService, type CRMClient } from "../../../services/clientsService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark: boolean; theme: LayoutContext["theme"];
  client: CRMClient; isAdmin: boolean;
  onClose: () => void; onEdit: () => void; onRefresh: () => void;
}

export default function ClientDetailModal({ dark, theme, client, isAdmin, onClose, onEdit, onRefresh }: Props) {
  const swal   = useSwal();
  const [busy, setBusy]     = useState(false);
  const [remindNote,  setRemindNote]  = useState("");
  const [remindDate,  setRemindDate]  = useState("");
  const [showRemind,  setShowRemind]  = useState(false);
  const [convertNote, setConvertNote] = useState("");
  const [showConvert, setShowConvert] = useState(false);

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.55rem 0", borderBottom: `1px solid ${theme.border}` }}>
      <span style={{ fontSize: "0.8rem", color: theme.textMuted, minWidth: 120 }}>{label}</span>
      <span style={{ fontSize: "0.875rem", color: theme.textPrimary, fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await clientsService.convert(client.id, convertNote);
      swal.success("Prospect converti en client !"); onRefresh(); onClose();
    } catch { swal.serverError(); } finally { setBusy(false); }
  };

  const handleRemind = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remindNote.trim()) { swal.error("Requis", "Veuillez saisir une note."); return; }
    setBusy(true);
    try {
      await clientsService.remind(client.id, remindNote, remindDate || undefined);
      swal.success("Rappel enregistré."); setShowRemind(false); onRefresh();
    } catch { swal.serverError(); } finally { setBusy(false); }
  };

  const inp: React.CSSProperties = { width: "100%", padding: "0.55rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" as const };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 560, maxHeight: "94vh", overflowY: "auto", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: 3 }}>
              <h2 style={{ fontFamily: FONTS.display, fontSize: "1.1rem", fontWeight: 700, color: theme.textPrimary }}>{client.display_name}</h2>
              <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: client.type_client === "client" ? "rgba(16,185,129,0.12)" : "rgba(6,182,212,0.1)", color: client.type_client === "client" ? "#10b981" : PALETTE.primary }}>
                {client.type_display}
              </span>
            </div>
            {client.entreprise && <div style={{ fontSize: "0.78rem", color: theme.textMuted }}>🏢 {client.entreprise}</div>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
        </div>

        {/* Infos */}
        <div style={{ padding: "1.25rem 1.5rem" }}>
          {client.telephone  && <Row label="Téléphone" value={<a href={`tel:${client.telephone}`} style={{ color: PALETTE.primary, textDecoration: "none" }}>📞 {client.telephone}</a>} />}
          {client.email      && <Row label="Email"     value={<a href={`mailto:${client.email}`} style={{ color: PALETTE.primary, textDecoration: "none" }}>✉ {client.email}</a>} />}
          {client.adresse    && <Row label="Adresse"   value={client.adresse} />}
          {client.ville      && <Row label="Ville"     value={`${client.ville}${client.code_postal ? ` (${client.code_postal})` : ""}`} />}
          <Row label="Créé le"  value={client.created_at_str ?? "—"} />
          {client.assigned_to_name && <Row label="Commercial" value={client.assigned_to_name} />}
          {client.converted_by_name && <Row label="Converti par" value={`${client.converted_by_name}${client.note_conversion ? ` — ${client.note_conversion}` : ""}`} />}

          {/* Prochain rappel */}
          {client.next_reminder && (
            <div style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#f59e0b", marginBottom: 3 }}>🕐 Prochain rappel</div>
              <div style={{ fontSize: "0.82rem", color: theme.textSecondary }}>{client.next_reminder.notes}</div>
              {client.next_reminder.remind_at_str && <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 2 }}>{client.next_reminder.remind_at_str}</div>}
            </div>
          )}

          {/* Formulaire rappel */}
          {showRemind && (
            <form onSubmit={handleRemind} style={{ marginTop: "0.75rem", padding: "0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", marginBottom: "0.5rem" }}>Programmer un rappel</div>
              <textarea required rows={2} value={remindNote} onChange={e => setRemindNote(e.target.value)} placeholder="Note pour le rappel…" style={{ ...inp, resize: "vertical", marginBottom: "0.5rem" }} />
              <input type="datetime-local" value={remindDate} onChange={e => setRemindDate(e.target.value)} style={{ ...inp, marginBottom: "0.5rem" }} />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="submit" disabled={busy} style={{ flex: 1, padding: "0.52rem", borderRadius: RADIUS.md, border: "none", background: "#f59e0b", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>Enregistrer</button>
                <button type="button" onClick={() => setShowRemind(false)} style={{ flex: 1, padding: "0.52rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, fontSize: "0.82rem", cursor: "pointer", fontFamily: FONTS.body }}>Annuler</button>
              </div>
            </form>
          )}

          {/* Formulaire conversion */}
          {showConvert && client.type_client === "prospect" && (
            <form onSubmit={handleConvert} style={{ marginTop: "0.75rem", padding: "0.85rem", borderRadius: RADIUS.md, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.04)" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#10b981", textTransform: "uppercase", marginBottom: "0.5rem" }}>Convertir en client</div>
              <input value={convertNote} onChange={e => setConvertNote(e.target.value)} placeholder="Type d'intervention (optionnel)" style={{ ...inp, marginBottom: "0.5rem" }} />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="submit" disabled={busy} style={{ flex: 1, padding: "0.52rem", borderRadius: RADIUS.md, border: "none", background: "#10b981", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>✓ Valider</button>
                <button type="button" onClick={() => setShowConvert(false)} style={{ flex: 1, padding: "0.52rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, fontSize: "0.82rem", cursor: "pointer", fontFamily: FONTS.body }}>Annuler</button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "1rem 1.5rem", borderTop: `1px solid ${theme.border}`, display: "flex", gap: "0.4rem", flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <button onClick={() => setShowRemind(v => !v)}
              style={{ padding: "0.52rem 0.85rem", borderRadius: RADIUS.md, border: "1px solid rgba(245,158,11,0.4)", background: "transparent", color: "#f59e0b", fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body }}>
              🕐 Rappel
            </button>
            {client.type_client === "prospect" && (
              <button onClick={() => setShowConvert(v => !v)}
                style={{ padding: "0.52rem 0.85rem", borderRadius: RADIUS.md, border: "1px solid rgba(16,185,129,0.4)", background: "transparent", color: "#10b981", fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body }}>
                ✓ Convertir en client
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button onClick={onClose} style={{ padding: "0.55rem 1rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>Fermer</button>
            <button onClick={onEdit} style={{ padding: "0.55rem 1.2rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>✏️ Modifier</button>
          </div>
        </div>
      </div>
    </div>
  );
}