// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/clients/components/ClientFormModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { clientsService, type CRMClient } from "../../../services/clientsService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark: boolean; theme: LayoutContext["theme"];
  client: CRMClient | null;
  onClose: () => void; onSaved: () => void;
}

export default function ClientFormModal({ dark, theme, client, onClose, onSaved }: Props) {
  const swal   = useSwal();
  const isEdit = !!client;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nom:         client?.nom         ?? "",
    prenom:      client?.prenom      ?? "",
    entreprise:  client?.entreprise  ?? "",
    email:       client?.email       ?? "",
    telephone:   client?.telephone   ?? "",
    adresse:     client?.adresse     ?? "",
    ville:       client?.ville       ?? "",
    code_postal: client?.code_postal ?? "",
    type_client: client?.type_client ?? "prospect",
  });
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim()) { swal.error("Requis", "Le nom est obligatoire."); return; }
    setSaving(true);
    try {
      if (isEdit) { await clientsService.update(client!.id, form); swal.updated("Le client"); }
      else        { await clientsService.create(form);              swal.saved("Le client");   }
      onSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.telephone?.[0] ?? err?.response?.data?.detail ?? "Erreur lors de l'enregistrement.";
      swal.error("Erreur", msg);
    } finally { setSaving(false); }
  };

  const inp: React.CSSProperties = { width: "100%", padding: "0.62rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" as const };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.72rem", fontWeight: 600, color: theme.textSecondary, marginBottom: "0.28rem", textTransform: "uppercase", letterSpacing: "0.05em" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 580, maxHeight: "94vh", overflowY: "auto", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: theme.textPrimary }}>
            {isEdit ? "Modifier le client" : "Nouveau client"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
          <div>
            <label style={lbl}>Nom *</label>
            <input required value={form.nom} onChange={e => setF("nom", e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Prénom</label>
            <input value={form.prenom} onChange={e => setF("prenom", e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Entreprise</label>
            <input value={form.entreprise} onChange={e => setF("entreprise", e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Type</label>
            <select value={form.type_client} onChange={e => setF("type_client", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              <option value="prospect">Prospect</option>
              <option value="client">Client</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Email</label>
            <input type="email" value={form.email} onChange={e => setF("email", e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Téléphone</label>
            <input type="tel" value={form.telephone} onChange={e => setF("telephone", e.target.value)} style={inp} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Adresse</label>
            <textarea rows={2} value={form.adresse} onChange={e => setF("adresse", e.target.value)} style={{ ...inp, resize: "vertical" }} />
          </div>
          <div>
            <label style={lbl}>Ville</label>
            <input value={form.ville} onChange={e => setF("ville", e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Code postal</label>
            <input value={form.code_postal} onChange={e => setF("code_postal", e.target.value)} style={inp} />
          </div>
          <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem", borderTop: `1px solid ${theme.border}` }}>
            <button type="button" onClick={onClose} style={{ padding: "0.62rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>Annuler</button>
            <button type="submit" disabled={saving} style={{ padding: "0.62rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}