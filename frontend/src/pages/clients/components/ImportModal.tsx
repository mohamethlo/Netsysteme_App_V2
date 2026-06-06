// src/pages/clients/components/ImportModal.tsx
import { useState } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { clientsService } from "../../../services/clientsService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark: boolean; theme: LayoutContext["theme"];
  onClose: () => void; onSaved: () => void;
}

export default function ImportModal({ dark, theme, onClose, onSaved }: Props) {
  const swal    = useSwal();
  const [file,   setFile]   = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ inserted: number; ignored: number; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { swal.error("Requis", "Sélectionnez un fichier Excel."); return; }
    setSaving(true);
    try {
      const r = await clientsService.importExcel(file);
      setResult(r);
      if (r.success) { setTimeout(() => onSaved(), 2000); }
    } catch (err: any) {
      swal.error("Erreur", err?.response?.data?.detail ?? "Erreur lors de l'import.");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 480, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: theme.textPrimary }}>⬆ Importer des clients</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: theme.textSecondary, marginBottom: "0.28rem", textTransform: "uppercase" }}>
              Fichier Excel (.xlsx, .xls) *
            </label>
            <input type="file" accept=".xlsx,.xls" onChange={e => setFile(e.target.files?.[0] ?? null)} required
              style={{ width: "100%", padding: "0.55rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" as const }} />
          </div>

          {/* Info box */}
          <div style={{ padding: "0.85rem 1rem", borderRadius: RADIUS.md, background: dark ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.2)", marginBottom: "1rem", fontSize: "0.8rem", color: theme.textSecondary, lineHeight: 1.6 }}>
            <strong style={{ color: "#3b82f6" }}>ℹ Format requis — colonnes Excel :</strong>
            <br />
            <code style={{ fontSize: "0.72rem" }}>nom</code> (obligatoire) ·
            <code style={{ fontSize: "0.72rem" }}> prenom</code> ·
            <code style={{ fontSize: "0.72rem" }}> entreprise</code> ·
            <code style={{ fontSize: "0.72rem" }}> email</code> ·
            <code style={{ fontSize: "0.72rem" }}> telephone</code> ·
            <code style={{ fontSize: "0.72rem" }}> adresse</code> ·
            <code style={{ fontSize: "0.72rem" }}> ville</code> ·
            <code style={{ fontSize: "0.72rem" }}> code_postal</code> ·
            <code style={{ fontSize: "0.72rem" }}> type_client</code>
            <br /><br />
            Les doublons de téléphone et les lignes sans numéro seront ignorés.
            Les prospects seront répartis automatiquement entre les commerciaux.
          </div>

          {result && (
            <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: result.inserted > 0 ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.08)", border: `1px solid ${result.inserted > 0 ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)"}`, marginBottom: "1rem", fontSize: "0.875rem", color: result.inserted > 0 ? "#10b981" : "#f59e0b", fontWeight: 600 }}>
              {result.message}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <button type="button" onClick={onClose} style={{ padding: "0.62rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>Annuler</button>
            <button type="submit" disabled={saving || !file} style={{ padding: "0.62rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: saving || !file ? "not-allowed" : "pointer", fontFamily: FONTS.body, opacity: saving || !file ? 0.7 : 1 }}>
              {saving ? "Import en cours…" : "Importer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}