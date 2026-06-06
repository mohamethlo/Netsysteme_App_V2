// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/products/components/ProductFormModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { productsService, type Product } from "../../../services/productsService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark:    boolean;
  theme:   LayoutContext["theme"];
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  name:           string;
  description:    string;
  qty:            string;
  prix:           string;
  fournisseur:    string;
  alert_quantity: string;
}

export default function ProductFormModal({ dark, theme, product, onClose, onSaved }: Props) {
  const swal   = useSwal();
  const isEdit = !!product;
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({
    name:           product?.name           ?? "",
    description:    product?.description    ?? "",
    qty:            product?.quantity.toString()       ?? "0",
    prix:           product?.unit_price.toString()     ?? "0",
    fournisseur:    product?.supplier       ?? "",
    alert_quantity: product?.alert_quantity.toString() ?? "5",
  });

  const [imgPreview, setImgPreview] = useState<string | null>(product?.image_url ?? null);
  const [imgFile,    setImgFile]    = useState<File | null>(null);
  const [errors,     setErrors]     = useState<Partial<FormState>>({});

  const set = (k: keyof FormState, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImgPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const validate = (): boolean => {
    const errs: Partial<FormState> = {};
    if (!form.name.trim() && !form.description.trim())
      errs.name = "Le nom ou la description est obligatoire.";
    if (isNaN(parseFloat(form.prix)) || parseFloat(form.prix) < 0)
      errs.prix = "Prix invalide.";
    if (isNaN(parseFloat(form.qty)) || parseFloat(form.qty) < 0)
      errs.qty = "Quantité invalide.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name",           form.name.trim());
      fd.append("description",    form.description.trim());
      fd.append("qty",            form.qty);
      fd.append("prix",           form.prix);
      fd.append("fournisseur",    form.fournisseur.trim());
      fd.append("alert_quantity", form.alert_quantity);
      if (imgFile) fd.append("img", imgFile);

      if (isEdit) {
        await productsService.update(product!.id, fd);
        swal.updated("Le produit");
      } else {
        await productsService.create(fd);
        swal.saved("Le produit");
      }
      onSaved();
    } catch (err: any) {
      swal.error("Erreur", err?.response?.data?.detail ?? "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  };

  const inp = (hasErr?: boolean): React.CSSProperties => ({
    width: "100%", padding: "0.62rem 0.85rem",
    borderRadius: RADIUS.md,
    border: `1px solid ${hasErr ? "#ef4444" : theme.border}`,
    background: hasErr ? "rgba(239,68,68,0.05)" : theme.inputBg,
    color: theme.textPrimary, fontSize: "0.875rem",
    fontFamily: FONTS.body, outline: "none",
    boxSizing: "border-box" as const,
  });
  const lbl: React.CSSProperties = {
    display: "block", fontSize: "0.73rem", fontWeight: 600,
    color: theme.textSecondary, marginBottom: "0.3rem",
    textTransform: "uppercase", letterSpacing: "0.05em",
  };
  const errMsg = (m?: string) => m
    ? <div style={{ fontSize: "0.72rem", color: "#ef4444", marginTop: 3 }}>{m}</div>
    : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 620, maxHeight: "94vh", overflowY: "auto", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.6)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: theme.popupBg, zIndex: 1, borderRadius: "18px 18px 0 0" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: theme.textPrimary, marginBottom: 2 }}>
              {isEdit ? `Modifier "${product!.name ?? product!.description}"` : "Nouveau produit"}
            </h2>
            <p style={{ fontSize: "0.78rem", color: theme.textMuted }}>
              {isEdit ? "Modifiez les informations du produit" : "Renseignez les informations du nouveau produit"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem", padding: 4, lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>

          {/* Image upload */}
          <div style={{ marginBottom: "1.5rem", display: "flex", gap: "1.25rem", alignItems: "flex-start" }}>
            {/* Preview */}
            <div
              onClick={() => fileRef.current?.click()}
              style={{ width: 110, height: 110, borderRadius: "14px", border: `2px dashed ${imgPreview ? PALETTE.primary + "55" : theme.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0, transition: "border-color 0.2s", background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = PALETTE.primary + "99")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = imgPreview ? PALETTE.primary + "55" : theme.border)}
            >
              {imgPreview ? (
                <img src={imgPreview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ textAlign: "center", color: theme.textMuted }}>
                  <div style={{ fontSize: "1.8rem", marginBottom: 4 }}>📷</div>
                  <div style={{ fontSize: "0.7rem" }}>Cliquez pour<br />ajouter une image</div>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />

            {/* Nom + Description */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label style={lbl}>Nom du produit <span style={{ color: "#ef4444" }}>*</span></label>
                <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Caméra IP 4K, Câble RJ45…" style={inp(!!errors.name)} />
                {errMsg(errors.name)}
              </div>
              <div>
                <label style={lbl}>Description</label>
                <input value={form.description} onChange={e => set("description", e.target.value)} placeholder="Détails supplémentaires…" style={inp()} />
              </div>
            </div>
          </div>

          {imgPreview && (
            <button type="button" onClick={() => { setImgPreview(null); setImgFile(null); if (fileRef.current) fileRef.current.value = ""; }}
              style={{ fontSize: "0.75rem", color: "#ef4444", background: "none", border: "none", cursor: "pointer", marginBottom: "1.25rem", padding: 0, fontFamily: FONTS.body }}>
              ✕ Supprimer l'image
            </button>
          )}

          {/* Séparateur */}
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ flex: 1, height: 1, background: theme.border }} />
            Stock & Tarif
            <div style={{ flex: 1, height: 1, background: theme.border }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem", marginBottom: "1.5rem" }}>
            <div>
              <label style={lbl}>Quantité en stock</label>
              <input type="number" min="0" step="0.01" value={form.qty} onChange={e => set("qty", e.target.value)} style={inp(!!errors.qty)} />
              {errMsg(errors.qty)}
            </div>
            <div>
              <label style={lbl}>Seuil d'alerte</label>
              <input type="number" min="0" step="0.01" value={form.alert_quantity} onChange={e => set("alert_quantity", e.target.value)} style={inp()} />
              <div style={{ fontSize: "0.7rem", color: theme.textMuted, marginTop: 3 }}>
                Alerte si quantité ≤ ce seuil
              </div>
            </div>
            <div>
              <label style={lbl}>Prix unitaire (FCFA) <span style={{ color: "#ef4444" }}>*</span></label>
              <input type="number" min="0" step="0.01" required value={form.prix} onChange={e => set("prix", e.target.value)} style={inp(!!errors.prix)} />
              {errMsg(errors.prix)}
            </div>
            <div>
              <label style={lbl}>Fournisseur</label>
              <input value={form.fournisseur} onChange={e => set("fournisseur", e.target.value)} placeholder="Nom du fournisseur" style={inp()} />
            </div>
          </div>

          {/* Aperçu stock */}
          {form.qty && form.alert_quantity && (
            <div style={{
              padding: "0.75rem 1rem", borderRadius: RADIUS.md, marginBottom: "1.25rem",
              background: parseFloat(form.qty) === 0
                ? "rgba(239,68,68,0.08)"
                : parseFloat(form.qty) <= parseFloat(form.alert_quantity)
                  ? "rgba(245,158,11,0.08)"
                  : "rgba(16,185,129,0.08)",
              border: `1px solid ${parseFloat(form.qty) === 0 ? "rgba(239,68,68,0.2)" : parseFloat(form.qty) <= parseFloat(form.alert_quantity) ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}`,
              display: "flex", alignItems: "center", gap: "0.65rem",
            }}>
              <span style={{ fontSize: "1.1rem" }}>
                {parseFloat(form.qty) === 0 ? "🔴" : parseFloat(form.qty) <= parseFloat(form.alert_quantity) ? "🟡" : "🟢"}
              </span>
              <span style={{ fontSize: "0.82rem", color: theme.textSecondary }}>
                {parseFloat(form.qty) === 0
                  ? "Rupture de stock"
                  : parseFloat(form.qty) <= parseFloat(form.alert_quantity)
                    ? `Stock faible — ${form.qty} unité(s) restante(s)`
                    : `Stock correct — ${form.qty} unité(s) disponible(s)`}
              </span>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "1rem", borderTop: `1px solid ${theme.border}` }}>
            <button type="button" onClick={onClose}
              style={{ padding: "0.65rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
              Annuler
            </button>
            <button type="submit" disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.65rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? "rgba(6,182,212,0.45)" : `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
              {saving
                ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> Enregistrement…</>
                : isEdit ? "Enregistrer les modifications" : "Créer le produit"
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}