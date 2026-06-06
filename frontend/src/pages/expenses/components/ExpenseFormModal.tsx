// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/expenses/components/ExpenseFormModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { expensesService, type Expense, type Site } from "../../../services/expensesService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark: boolean; theme: LayoutContext["theme"];
  site: Site; expense: Expense | null;
  onClose: () => void; onSaved: () => void;
}

const CATEGORIES = [
  { value: "Transport",   label: "Transport" },
  { value: "Carburant",   label: "Carburant" },
  { value: "Repas",       label: "Repas" },
  { value: "Hébergement", label: "Hébergement" },
  { value: "Matériel",    label: "Matériel" },
  { value: "Formation",   label: "Formation" },
  { value: "Salaire",     label: "Salaire" },
  { value: "Loyer",       label: "Loyer" },
  { value: "Eau",         label: "Facture eau" },
  { value: "Sonatel",     label: "Facture Sonatel" },
  { value: "MainOeuvre",  label: "Main d'œuvre mécanicien" },
  { value: "Autre",       label: "Autre" },
];

export default function ExpenseFormModal({ dark, theme, site, expense, onClose, onSaved }: Props) {
  const swal   = useSwal();
  const isEdit = !!expense;
  const [saving, setSaving] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    titre:        expense?.titre        ?? "",
    description:  expense?.description  ?? "",
    montant:      expense?.montant?.toString()  ?? "",
    categorie:    expense?.categorie    ?? "",
    date_depense: expense?.date_depense ?? today,
  });

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titre.trim())  { swal.error("Requis", "Le titre est obligatoire."); return; }
    if (!form.montant)       { swal.error("Requis", "Le montant est obligatoire."); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("titre",        form.titre.trim());
      fd.append("description",  form.description);
      fd.append("montant",      form.montant);
      fd.append("categorie",    form.categorie);
      fd.append("date_depense", form.date_depense);
      fd.append("site",         site);
      if (fichier) fd.append("facture", fichier);

      if (isEdit) { await expensesService.update(expense!.id, fd); swal.updated("La dépense"); }
      else        { await expensesService.create(fd);              swal.saved("La dépense");   }
      onSaved();
    } catch (err: any) {
      swal.error("Erreur", err?.response?.data?.detail ?? "Une erreur est survenue.");
    } finally { setSaving(false); }
  };

  const inp: React.CSSProperties = { width: "100%", padding: "0.62rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" as const };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.72rem", fontWeight: 600, color: theme.textSecondary, marginBottom: "0.28rem", textTransform: "uppercase", letterSpacing: "0.05em" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 560, maxHeight: "94vh", overflowY: "auto", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: theme.textPrimary }}>
              {isEdit ? "Modifier la dépense" : "Nouvelle dépense"}
            </h2>
            <p style={{ fontSize: "0.78rem", color: theme.textMuted }}>Site : <strong>{site}</strong></p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Titre *</label>
            <input required value={form.titre} onChange={e => setF("titre", e.target.value)} style={inp} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Description</label>
            <textarea rows={2} value={form.description} onChange={e => setF("description", e.target.value)} style={{ ...inp, resize: "vertical" }} />
          </div>
          <div>
            <label style={lbl}>Montant (F) *</label>
            <input required type="number" min="0" step="0.01" value={form.montant} onChange={e => setF("montant", e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Catégorie</label>
            <select value={form.categorie} onChange={e => setF("categorie", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              <option value="">Sélectionner…</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Date de dépense</label>
            <input type="date" value={form.date_depense} onChange={e => setF("date_depense", e.target.value)} style={inp} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Facture (PDF ou image)</label>
            <input type="file" accept=".pdf,image/*" onChange={e => setFichier(e.target.files?.[0] ?? null)} style={{ ...inp, padding: "0.45rem" }} />
            {expense?.justificatif_url && !fichier && (
              <a href={expense.justificatif_url} target="_blank" rel="noreferrer" style={{ fontSize: "0.75rem", color: PALETTE.primary }}>📎 Voir justificatif existant</a>
            )}
          </div>
          <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem", borderTop: `1px solid ${theme.border}` }}>
            <button type="button" onClick={onClose} style={{ padding: "0.62rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>Annuler</button>
            <button type="submit" disabled={saving} style={{ padding: "0.62rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}