// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/products/components/StockAdjustModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { productsService, type Product } from "../../../services/productsService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark:    boolean;
  theme:   LayoutContext["theme"];
  product: Product;
  onClose: () => void;
  onSaved: () => void;
}

type Operation = "add" | "remove" | "set";

const OPS: { key: Operation; label: string; icon: string; color: string; desc: string }[] = [
  { key: "add",    label: "Entrée",      icon: "➕", color: "#10b981", desc: "Ajouter au stock existant" },
  { key: "remove", label: "Sortie",      icon: "➖", color: "#ef4444", desc: "Retirer du stock existant" },
  { key: "set",    label: "Correction",  icon: "🔧", color: "#f59e0b", desc: "Définir une valeur exacte" },
];

export default function StockAdjustModal({ dark, theme, product, onClose, onSaved }: Props) {
  const swal = useSwal();
  const [operation, setOperation] = useState<Operation>("add");
  const [quantity,  setQuantity]  = useState("");
  const [note,      setNote]      = useState("");
  const [saving,    setSaving]    = useState(false);

  const selectedOp = OPS.find(o => o.key === operation)!;
  const qty        = parseFloat(quantity) || 0;

  // Préview du nouveau stock
  const preview = operation === "add"
    ? product.quantity + qty
    : operation === "remove"
      ? Math.max(0, product.quantity - qty)
      : qty;

  const isValid = qty > 0 && (operation !== "remove" || qty <= product.quantity);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    try {
      const result = await productsService.adjustStock(product.id, {
        operation, quantity: qty,
        note: note.trim() || undefined,
      });
      swal.success("Stock mis à jour", `Nouvelle quantité : ${result.new_quantity}`);
      onSaved();
    } catch (err: any) {
      swal.error("Erreur", err?.response?.data?.quantity?.[0] ?? err?.response?.data?.detail ?? "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  };

  const inp: React.CSSProperties = { width: "100%", padding: "0.62rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" as const };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 460, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.6)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: theme.textPrimary, marginBottom: 2 }}>
              Ajuster le stock
            </h2>
            <p style={{ fontSize: "0.78rem", color: theme.textMuted }}>
              {product.name ?? product.description}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem", padding: 4 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>

          {/* Stock actuel */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}`, marginBottom: "1.25rem" }}>
            <span style={{ fontSize: "0.82rem", color: theme.textMuted }}>Stock actuel</span>
            <span style={{ fontSize: "1.4rem", fontWeight: 700, fontFamily: FONTS.display, color: product.stock_status === "rupture" ? "#ef4444" : product.stock_status === "faible" ? "#f59e0b" : "#10b981" }}>
              {product.quantity}
              <span style={{ fontSize: "0.75rem", fontWeight: 400, color: theme.textMuted, marginLeft: 4 }}>unités</span>
            </span>
          </div>

          {/* Type d'opération */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ fontSize: "0.73rem", fontWeight: 600, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              Type d'opération
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {OPS.map(op => (
                <button key={op.key} type="button" onClick={() => setOperation(op.key)}
                  style={{ flex: 1, padding: "0.65rem 0.5rem", borderRadius: RADIUS.md, border: `2px solid ${operation === op.key ? op.color : theme.border}`, background: operation === op.key ? op.color + "14" : "transparent", color: operation === op.key ? op.color : theme.textMuted, cursor: "pointer", transition: "all 0.15s", fontFamily: FONTS.body }}>
                  <div style={{ fontSize: "1.2rem", marginBottom: 3 }}>{op.icon}</div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600 }}>{op.label}</div>
                  <div style={{ fontSize: "0.68rem", opacity: 0.75, marginTop: 1 }}>{op.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Quantité */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.73rem", fontWeight: 600, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>
              Quantité *
            </label>
            <input
              type="number" min="0.01" step="0.01" required
              value={quantity} onChange={e => setQuantity(e.target.value)}
              placeholder="0"
              style={{ ...inp, borderColor: operation === "remove" && qty > product.quantity ? "#ef4444" : theme.border }}
            />
            {operation === "remove" && qty > product.quantity && (
              <div style={{ fontSize: "0.72rem", color: "#ef4444", marginTop: 3 }}>
                Quantité insuffisante (max {product.quantity})
              </div>
            )}
          </div>

          {/* Note */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontSize: "0.73rem", fontWeight: 600, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>
              Note (optionnel)
            </label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Motif de l'ajustement…" style={inp} />
          </div>

          {/* Aperçu résultat */}
          {qty > 0 && (
            <div style={{ padding: "0.85rem 1rem", borderRadius: RADIUS.md, marginBottom: "1.25rem", background: preview === 0 ? "rgba(239,68,68,0.08)" : preview <= product.alert_quantity ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.08)", border: `1px solid ${preview === 0 ? "rgba(239,68,68,0.2)" : preview <= product.alert_quantity ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.82rem", color: theme.textMuted }}>
                Nouveau stock après {selectedOp.label.toLowerCase()}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.82rem", color: theme.textMuted, textDecoration: "line-through" }}>{product.quantity}</span>
                <span style={{ fontSize: "0.9rem" }}>→</span>
                <span style={{ fontSize: "1.2rem", fontWeight: 700, fontFamily: FONTS.display, color: preview === 0 ? "#ef4444" : preview <= product.alert_quantity ? "#f59e0b" : "#10b981" }}>
                  {preview}
                </span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.75rem", borderTop: `1px solid ${theme.border}` }}>
            <button type="button" onClick={onClose} style={{ padding: "0.65rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
              Annuler
            </button>
            <button type="submit" disabled={saving || !isValid}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.65rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: !isValid ? "rgba(100,116,139,0.3)" : saving ? "rgba(6,182,212,0.45)" : `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: !isValid || saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
              {saving
                ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> Enregistrement…</>
                : `${selectedOp.icon} Confirmer`
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}