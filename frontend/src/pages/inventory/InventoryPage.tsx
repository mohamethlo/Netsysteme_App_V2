import { useState, useEffect, useCallback, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import {
  inventoryService,
  type InventoryItem,
  type InventoryCategory,
  type InventoryStats,
} from "../../services/inventoryService";
import { useSwal } from "../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../theme";

const fmt     = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtPrix = (n: number | null) => n != null ? `${fmt(n)} F` : "—";

const STOCK_CFG = {
  ok:      { label: "En stock",    bg: "rgba(16,185,129,0.12)", text: "#10b981", icon: "🟢" },
  faible:  { label: "Stock faible",bg: "rgba(245,158,11,0.12)", text: "#f59e0b", icon: "🟡" },
  rupture: { label: "Rupture",     bg: "rgba(239,68,68,0.12)",  text: "#ef4444", icon: "🔴" },
} as const;

const CSS = `
  @keyframes inv-spin { to { transform: rotate(360deg); } }

  .inv-header {
    display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;
  }
  @media (min-width: 480px) {
    .inv-header { flex-direction: row; justify-content: space-between; align-items: flex-start; }
  }

  .inv-stats {
    display: grid; grid-template-columns: repeat(2,1fr); gap: 0.65rem; margin-bottom: 1.5rem;
  }
  @media (min-width: 480px) { .inv-stats { grid-template-columns: repeat(3,1fr); } }
  @media (min-width: 900px) { .inv-stats { grid-template-columns: repeat(6,1fr); gap: 0.85rem; } }

  .inv-filters {
    display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; align-items: center;
  }
  .inv-search { position: relative; flex: 1 1 180px; min-width: 150px; }
  .inv-select  { flex: 1 1 130px; min-width: 110px; }
  .inv-count   { flex: 0 0 auto; margin-left: auto; font-size: 0.78rem; white-space: nowrap; }

  .inv-view-toggle {
    display: flex; background: transparent; border: none; gap: 0.25rem;
  }

  /* Tableau / grille */
  .inv-table-wrap { display: none; }
  .inv-grid-wrap  { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px,1fr)); gap: 0.85rem; }
  @media (min-width: 768px) {
    .inv-table-wrap { display: block; }
    .inv-grid-wrap  { display: none; }
  }

  /* Modal overlay */
  .inv-modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    z-index: 500; display: flex; align-items: flex-end; justify-content: center;
  }
  @media (min-width: 640px) {
    .inv-modal-overlay { align-items: center; padding: 0.5rem; }
  }

  .inv-modal {
    width: 100%; max-height: 98vh; overflow-y: auto; border-radius: 18px 18px 0 0;
  }
  @media (min-width: 640px) {
    .inv-modal { max-width: 680px; border-radius: 18px; max-height: 96vh; }
  }

  .inv-modal-body { padding: 1rem; }
  @media (min-width: 640px) { .inv-modal-body { padding: 1.5rem; } }

  .inv-form-grid2 { display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
  @media (min-width: 480px) { .inv-form-grid2 { grid-template-columns: 1fr 1fr; } }

  .inv-form-grid3 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  @media (min-width: 640px) { .inv-form-grid3 { grid-template-columns: repeat(3,1fr); } }

  .inv-footer {
    display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; border-top: 1px solid;
  }
  @media (min-width: 480px) {
    .inv-footer { flex-direction: row; justify-content: flex-end; }
  }
`;

function StatCard({ label, value, color, icon, onClick, theme }: {
  label: string; value: number | string; color: string; icon: string;
  onClick?: () => void; theme: LayoutContext["theme"];
}) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov && onClick ? theme.cardBgHover : theme.cardBg, border: `1px solid ${hov && onClick ? color + "44" : theme.border}`, borderRadius: "14px", padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "0.65rem", cursor: onClick ? "pointer" : "default", transition: "all 0.18s", transform: hov && onClick ? "translateY(-1px)" : "none" }}>
      <div style={{ width: 38, height: 38, borderRadius: "10px", background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "0.65rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        <div style={{ fontSize: "1.2rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1 }}>{value}</div>
      </div>
    </div>
  );
}

function StockBadge({ status }: { status: string }) {
  const cfg = STOCK_CFG[status as keyof typeof STOCK_CFG] ?? STOCK_CFG.ok;
  return <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: cfg.bg, color: cfg.text, whiteSpace: "nowrap" }}>{cfg.icon} {cfg.label}</span>;
}

// ── Modal formulaire article ───────────────────────────────────────────────────
function ItemFormModal({ dark, theme, item, categories, onClose, onSaved }: {
  dark: boolean; theme: LayoutContext["theme"];
  item: InventoryItem | null; categories: InventoryCategory[];
  onClose: () => void; onSaved: () => void;
}) {
  const swal   = useSwal();
  const isEdit = !!item;
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving,     setSaving]     = useState(false);
  const [imgPreview, setImgPreview] = useState<string | null>(item?.image_url ?? null);
  const [imgFile,    setImgFile]    = useState<File | null>(null);
  const [removeImg,  setRemoveImg]  = useState(false);

  const [form, setForm] = useState({
    name:         item?.name         ?? "",
    description:  item?.description  ?? "",
    reference:    item?.reference    ?? "",
    category:     item?.category?.toString() ?? "",
    quantity:     item?.quantity.toString()   ?? "0",
    unit:         item?.unit         ?? "pièce",
    prix_achat:   item?.prix_achat?.toString() ?? "",
    prix_vente:   item?.prix_vente?.toString()  ?? "",
    seuil_alerte: item?.seuil_alerte.toString() ?? "10",
    fournisseur:  item?.fournisseur  ?? "",
    emplacement:  item?.emplacement  ?? "",
  });

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.6rem 0.85rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: "0.7rem", fontWeight: 600,
    color: theme.textSecondary, marginBottom: "0.28rem",
    textTransform: "uppercase", letterSpacing: "0.05em",
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgFile(file);
    setRemoveImg(false);
    const reader = new FileReader();
    reader.onload = ev => setImgPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { swal.error("Requis", "Le nom est obligatoire."); return; }

    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v !== "") fd.append(k, v); });
      if (imgFile)    fd.append("image",        imgFile);
      if (removeImg)  fd.append("remove_image", "true");

      if (isEdit) { await inventoryService.update(item!.id, fd); swal.updated("L'article"); }
      else        { await inventoryService.create(fd);            swal.saved("L'article");   }
      onSaved();
    } catch (err: any) {
      swal.error("Erreur", err?.response?.data?.detail ?? "Une erreur est survenue.");
    } finally { setSaving(false); }
  };

  return (
    <div className="inv-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="inv-modal" style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

        <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: theme.popupBg, zIndex: 2, borderRadius: "18px 18px 0 0" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: theme.textPrimary, marginBottom: 2 }}>
              {isEdit ? `Modifier "${item!.name}"` : "Nouvel article"}
            </h2>
            <p style={{ fontSize: "0.75rem", color: theme.textMuted }}>
              {isEdit ? "Modifiez les informations de l'article" : "Renseignez les informations du nouvel article"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="inv-modal-body">

            {/* Image */}
            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", marginBottom: "1.25rem" }}>
              <div onClick={() => fileRef.current?.click()}
                style={{ width: 90, height: 90, borderRadius: "12px", border: `2px dashed ${imgPreview ? PALETTE.primary + "55" : theme.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}>
                {imgPreview && !removeImg
                  ? <img src={imgPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ textAlign: "center", color: theme.textMuted }}>
                      <div style={{ fontSize: "1.5rem" }}>📷</div>
                      <div style={{ fontSize: "0.65rem", marginTop: 2 }}>Image</div>
                    </div>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
              <div style={{ flex: 1 }}>
                <label style={lbl}>Nom *</label>
                <input required value={form.name} onChange={e => setF("name", e.target.value)} placeholder="Désignation de l'article" style={inp} />
                {isEdit && item?.image_url && (
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.5rem", cursor: "pointer", fontSize: "0.8rem", color: "#ef4444" }}>
                    <input type="checkbox" checked={removeImg} onChange={e => { setRemoveImg(e.target.checked); if (e.target.checked) setImgPreview(null); }} />
                    Supprimer l'image
                  </label>
                )}
              </div>
            </div>

            {/* Description + Référence */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
              <div>
                <label style={lbl}>Description</label>
                <textarea rows={2} value={form.description} onChange={e => setF("description", e.target.value)} style={{ ...inp, resize: "vertical" }} placeholder="Description optionnelle…" />
              </div>
              <div className="inv-form-grid2">
                <div>
                  <label style={lbl}>Référence</label>
                  <input value={form.reference} onChange={e => setF("reference", e.target.value)} placeholder="Réf. unique" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Catégorie</label>
                  <select value={form.category} onChange={e => setF("category", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                    <option value="">Sans catégorie</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Stock */}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ flex: 1, height: 1, background: theme.border }} />Stock & Tarif<div style={{ flex: 1, height: 1, background: theme.border }} />
              </div>
              <div className="inv-form-grid3">
                <div>
                  <label style={lbl}>Quantité</label>
                  <input type="number" min="0" value={form.quantity} onChange={e => setF("quantity", e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Unité</label>
                  <input value={form.unit} onChange={e => setF("unit", e.target.value)} placeholder="pièce, m, kg…" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Seuil alerte</label>
                  <input type="number" min="0" value={form.seuil_alerte} onChange={e => setF("seuil_alerte", e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Prix achat (F)</label>
                  <input type="number" min="0" step="1" value={form.prix_achat} onChange={e => setF("prix_achat", e.target.value)} placeholder="0" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Prix vente (F)</label>
                  <input type="number" min="0" step="1" value={form.prix_vente} onChange={e => setF("prix_vente", e.target.value)} placeholder="0" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Fournisseur</label>
                  <input value={form.fournisseur} onChange={e => setF("fournisseur", e.target.value)} placeholder="Fournisseur" style={inp} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={lbl}>Emplacement</label>
                  <input value={form.emplacement} onChange={e => setF("emplacement", e.target.value)} placeholder="Étagère, zone…" style={inp} />
                </div>
              </div>
            </div>
          </div>

          <div className="inv-footer" style={{ borderTopColor: theme.border }}>
            <button type="submit" disabled={saving}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? `${PALETTE.primary}66` : `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.9rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
              {saving
                ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "inv-spin 0.7s linear infinite", display: "inline-block" }} /> Enregistrement…</>
                : isEdit ? "Enregistrer les modifications" : "Créer l'article"}
            </button>
            <button type="button" onClick={onClose}
              style={{ width: "100%", padding: "0.7rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal ajustement stock ────────────────────────────────────────────────────
function StockAdjustModal({ dark, theme, item, onClose, onSaved }: {
  dark: boolean; theme: LayoutContext["theme"];
  item: InventoryItem; onClose: () => void; onSaved: () => void;
}) {
  const swal = useSwal();
  const [saving,    setSaving]    = useState(false);
  const [operation, setOperation] = useState<"add" | "remove" | "set">("add");
  const [quantity,  setQuantity]  = useState("1");
  const [raison,    setRaison]    = useState("");

  const RAISONS_SORTIE = ["Vente", "Perte", "Déchet", "Transfert", "Intervention", "Autre"];

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.6rem 0.85rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };

  const preview = () => {
    const q = parseInt(quantity) || 0;
    if (operation === "add")    return item.quantity + q;
    if (operation === "remove") return Math.max(0, item.quantity - q);
    return q;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseInt(quantity) || 0;
    if (q <= 0 && operation !== "set") { swal.error("Requis", "La quantité doit être positive."); return; }
    if (q < 0 && operation === "set") { swal.error("Requis", "La quantité ne peut pas être négative."); return; }
    setSaving(true);
    try {
      await inventoryService.adjustStock(item.id, { operation, quantity: q, raison: raison || undefined });
      swal.success("Stock mis à jour !");
      onSaved();
    } catch (err: any) {
      swal.error("Erreur", err?.response?.data?.detail ?? "Une erreur est survenue.");
    } finally { setSaving(false); }
  };

  const opColor = { add: "#10b981", remove: "#f59e0b", set: "#3b82f6" }[operation];

  return (
    <div className="inv-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="inv-modal" style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body, maxWidth: 480 }}>

        <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: theme.popupBg, zIndex: 2, borderRadius: "18px 18px 0 0" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: theme.textPrimary, marginBottom: 2 }}>⚡ Ajuster le stock</h2>
            <p style={{ fontSize: "0.75rem", color: theme.textMuted }}>{item.name} · Stock actuel : <strong style={{ color: theme.textPrimary }}>{item.quantity} {item.unit}</strong></p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="inv-modal-body">

            {/* Type opération */}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, color: theme.textSecondary, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Type d'opération</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                {([
                  { key: "add",    label: "➕ Entrée",    color: "#10b981" },
                  { key: "remove", label: "➖ Sortie",    color: "#f59e0b" },
                  { key: "set",    label: "🔄 Définir",   color: "#3b82f6" },
                ] as const).map(op => (
                  <button key={op.key} type="button" onClick={() => setOperation(op.key)}
                    style={{ padding: "0.6rem 0.5rem", borderRadius: RADIUS.md, border: `2px solid ${operation === op.key ? op.color : theme.border}`, background: operation === op.key ? op.color + "10" : "transparent", color: operation === op.key ? op.color : theme.textMuted, fontSize: "0.8rem", fontWeight: operation === op.key ? 600 : 400, cursor: "pointer", fontFamily: FONTS.body, transition: "all 0.15s" }}>
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantité */}
            <div style={{ marginBottom: "0.85rem" }}>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: theme.textSecondary, marginBottom: "0.28rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {operation === "set" ? "Nouvelle quantité" : "Quantité"}
              </label>
              <input required type="number" min={operation === "set" ? "0" : "1"} value={quantity}
                onChange={e => setQuantity(e.target.value)} style={inp} />
            </div>

            {/* Raison */}
            {operation === "remove" ? (
              <div style={{ marginBottom: "0.85rem" }}>
                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: theme.textSecondary, marginBottom: "0.28rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Raison</label>
                <select value={raison} onChange={e => setRaison(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                  <option value="">— Sélectionner —</option>
                  {RAISONS_SORTIE.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            ) : (
              <div style={{ marginBottom: "0.85rem" }}>
                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: theme.textSecondary, marginBottom: "0.28rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Note (optionnel)</label>
                <input value={raison} onChange={e => setRaison(e.target.value)} placeholder="Motif de l'ajustement…" style={inp} />
              </div>
            )}

            {/* Aperçu */}
            <div style={{ padding: "0.85rem 1rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)", border: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.82rem", color: theme.textMuted }}>Stock après opération</span>
              <span style={{ fontSize: "1.1rem", fontWeight: 700, color: opColor }}>{preview()} {item.unit}</span>
            </div>
          </div>

          <div className="inv-footer" style={{ borderTopColor: theme.border }}>
            <button type="submit" disabled={saving}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? opColor + "66" : opColor, color: "#fff", fontSize: "0.9rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
              {saving
                ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "inv-spin 0.7s linear infinite", display: "inline-block" }} /> Traitement…</>
                : "Confirmer"}
            </button>
            <button type="button" onClick={onClose}
              style={{ width: "100%", padding: "0.7rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function InventoryPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const swal = useSwal();

  const [items,      setItems]      = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [stats,      setStats]      = useState<InventoryStats | null>(null);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);

  const [search,   setSearch]   = useState("");
  const [catF,     setCatF]     = useState("");
  const [stockF,   setStockF]   = useState("");
  const [view,     setView]     = useState<"table" | "grid">("table");
  const [page,     setPage]     = useState(1);
  const PAGE_SIZE = 20;

  const [showForm,   setShowForm]   = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [editing,    setEditing]    = useState<InventoryItem | null>(null);
  const [adjusting,  setAdjusting]  = useState<InventoryItem | null>(null);
  const [imgModal,   setImgModal]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: PAGE_SIZE };
      if (search) params.search   = search;
      if (catF)   params.category = catF;

      const [res, cats, s] = await Promise.all([
        inventoryService.getAll(params),
        inventoryService.categories.getAll(),
        inventoryService.getStats(),
      ]);

      let items = res.results as InventoryItem[];
      if (stockF === "ok")      items = items.filter(i => i.stock_status === "ok");
      if (stockF === "faible")  items = items.filter(i => i.stock_status === "faible");
      if (stockF === "rupture") items = items.filter(i => i.stock_status === "rupture");

      setItems(items);
      setTotal(res.count);
      setCategories(cats);
      setStats(s);
    } catch { swal.serverError(); }
    finally   { setLoading(false); }
  }, [page, search, catF, stockF]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, catF, stockF]);

  const handleDelete = async (item: InventoryItem) => {
    if (!await swal.confirmDelete(item.name)) return;
    try { await inventoryService.delete(item.id); swal.deleted("L'article"); load(); }
    catch { swal.serverError(); }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.55rem 0.75rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };

  return (
    <div style={{ fontFamily: FONTS.body }}>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <div className="inv-header">
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontSize: "1.4rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>
            📦 Gestion de stock
          </h1>
          <p style={{ fontSize: "0.82rem", color: theme.textMuted, marginTop: 3 }}>
            Articles, catégories et mouvements de stock
          </p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.6rem 1.1rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap" }}>
          + Nouvel article
        </button>
      </div>

      {/* ── Stats ── */}
      {stats && (
        <div className="inv-stats">
          <StatCard label="Total articles" value={stats.total}        color={PALETTE.primary} icon="📦" theme={theme} onClick={() => setStockF("")} />
          <StatCard label="En stock"        value={stats.ok}          color="#10b981"         icon="🟢" theme={theme} onClick={() => setStockF("ok")} />
          <StatCard label="Stock faible"    value={stats.low_stock}   color="#f59e0b"         icon="🟡" theme={theme} onClick={() => setStockF("faible")} />
          <StatCard label="Rupture"         value={stats.rupture}     color="#ef4444"         icon="🔴" theme={theme} onClick={() => setStockF("rupture")} />
          <StatCard label="Catégories"      value={stats.categories}  color="#8b5cf6"         icon="🏷" theme={theme} />
          <StatCard label="Valeur stock"    value={`${fmt(stats.valeur_stock)} F`} color={PALETTE.warning} icon="💰" theme={theme} />
        </div>
      )}

      {/* ── Alerte stock faible ── */}
      {stats && (stats.low_stock > 0 || stats.rupture > 0) && (
        <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>⚠️</span>
          <span style={{ fontSize: "0.85rem", color: theme.textPrimary }}>
            <strong>{stats.rupture}</strong> article{stats.rupture > 1 ? "s" : ""} en rupture
            {stats.low_stock > 0 && <>, <strong>{stats.low_stock}</strong> en stock faible</>}.{" "}
            <button onClick={() => setStockF(stockF === "rupture" ? "" : "rupture")}
              style={{ color: PALETTE.primary, background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline", fontFamily: FONTS.body }}>
              Afficher
            </button>
          </span>
        </div>
      )}

      {/* ── Filtres ── */}
      <div className="inv-filters">
        <div className="inv-search">
          <span style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted, pointerEvents: "none" }}>
            <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, référence, fournisseur…"
            style={{ ...inp, paddingLeft: "2.2rem" }} />
        </div>

        <select className="inv-select" value={catF} onChange={e => setCatF(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
          <option value="">Toutes catégories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
          {(["", "ok", "faible", "rupture"] as const).map(f => {
            const cfg = f === "" ? { label: "Tous", color: theme.textMuted } : { label: STOCK_CFG[f].label, color: STOCK_CFG[f].text };
            return (
              <button key={f} onClick={() => setStockF(f)}
                style={{ padding: "0.45rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${stockF === f ? (f === "" ? PALETTE.primary : STOCK_CFG[f as keyof typeof STOCK_CFG]?.text ?? PALETTE.primary) : theme.border}`, background: stockF === f ? (f === "" ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : STOCK_CFG[f as keyof typeof STOCK_CFG]?.bg ?? "transparent") : "transparent", color: stockF === f ? (f === "" ? "#fff" : cfg.color) : theme.textMuted, fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap" }}>
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Toggle vue table/grille sur desktop */}
        <div style={{ display: "flex", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: RADIUS.md, padding: "2px", gap: "2px", marginLeft: "auto" }}>
          {(["table", "grid"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: "0.38rem 0.7rem", borderRadius: "7px", border: "none", background: view === v ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : "transparent", color: view === v ? "#fff" : theme.textMuted, fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body, transition: "all 0.15s" }}>
              {v === "table" ? "☰ Tableau" : "⊞ Grille"}
            </button>
          ))}
        </div>

        <span className="inv-count" style={{ color: theme.textMuted }}>{total} article{total > 1 ? "s" : ""}</span>
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <div style={{ width: 34, height: 34, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "inv-spin 0.8s linear infinite" }} />
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📦</div>
          <div style={{ fontWeight: 600, color: theme.textPrimary, marginBottom: "0.4rem" }}>
            {search || catF || stockF ? "Aucun résultat" : "Aucun article en stock"}
          </div>
          <div style={{ fontSize: "0.875rem", color: theme.textMuted, marginBottom: "1.25rem" }}>
            {search || catF || stockF ? "Modifiez vos filtres" : "Commencez par ajouter un article"}
          </div>
          {!search && !catF && !stockF && (
            <button onClick={() => setShowForm(true)}
              style={{ padding: "0.65rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
              + Ajouter un article
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── Tableau desktop ── */}
          <div className="inv-table-wrap" style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden", display: view === "table" ? "block" : "none" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {["Article", "Qté", "Prix achat", "Prix vente", "Emplacement", "Image", "Statut", "Actions"].map(h => (
                      <th key={h} style={{ padding: "0.7rem 0.85rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id}
                      style={{ borderBottom: i < items.length - 1 ? `1px solid ${theme.border}` : "none", transition: "background 0.12s", background: item.stock_status === "rupture" ? (dark ? "rgba(239,68,68,0.04)" : "rgba(239,68,68,0.02)") : "transparent" }}
                      onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = item.stock_status === "rupture" ? (dark ? "rgba(239,68,68,0.04)" : "rgba(239,68,68,0.02)") : "transparent")}
                    >
                      <td style={{ padding: "0.8rem 0.85rem" }}>
                        <div style={{ fontWeight: 600, color: theme.textPrimary }}>{item.name}</div>
                        {item.description && <div style={{ fontSize: "0.72rem", color: theme.textMuted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description.slice(0, 50)}{item.description.length > 50 ? "…" : ""}</div>}
                        {item.reference && <div style={{ fontSize: "0.7rem", color: PALETTE.primary }}>Réf: {item.reference}</div>}
                      </td>
                      <td style={{ padding: "0.8rem 0.85rem" }}>
                        <span style={{ fontWeight: 600, color: item.stock_status !== "ok" ? STOCK_CFG[item.stock_status as keyof typeof STOCK_CFG]?.text : theme.textPrimary }}>
                          {item.quantity} {item.unit}
                        </span>
                        {item.is_low_stock && item.quantity > 0 && <div style={{ fontSize: "0.68rem", color: "#f59e0b" }}>Seuil: {item.seuil_alerte}</div>}
                      </td>
                      <td style={{ padding: "0.8rem 0.85rem", color: theme.textSecondary }}>{fmtPrix(item.prix_achat)}</td>
                      <td style={{ padding: "0.8rem 0.85rem", color: theme.textSecondary }}>{fmtPrix(item.prix_vente)}</td>
                      <td style={{ padding: "0.8rem 0.85rem", color: theme.textMuted, fontSize: "0.82rem" }}>{item.emplacement ?? "—"}</td>
                      <td style={{ padding: "0.8rem 0.85rem" }}>
                        {item.image_url ? (
                          <img src={item.image_url} alt="" onClick={() => setImgModal(item.image_url)}
                            style={{ width: 44, height: 44, objectFit: "cover", borderRadius: "8px", cursor: "pointer", border: `1px solid ${theme.border}` }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: "8px", background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", opacity: 0.4 }}>📦</div>
                        )}
                      </td>
                      <td style={{ padding: "0.8rem 0.85rem" }}><StockBadge status={item.stock_status} /></td>
                      <td style={{ padding: "0.8rem 0.85rem" }}>
                        <div style={{ display: "flex", gap: "0.25rem" }}>
                          {[
                            { icon: "⚡", color: "#10b981", title: "Ajuster stock", action: () => { setAdjusting(item); setShowAdjust(true); } },
                            { icon: "✏️", color: "#3b82f6", title: "Modifier",      action: () => { setEditing(item);   setShowForm(true);   } },
                            { icon: "🗑",  color: "#ef4444", title: "Supprimer",    action: () => handleDelete(item) },
                          ].map(btn => (
                            <button key={btn.icon} onClick={btn.action} title={btn.title}
                              style={{ width: 28, height: 28, borderRadius: RADIUS.md, border: `1px solid ${btn.color}33`, background: "transparent", color: btn.color, cursor: "pointer", fontSize: "0.78rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
                              onMouseEnter={e => (e.currentTarget.style.background = btn.color + "18")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >{btn.icon}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Grille desktop + Vue mobile ── */}
          <div style={{ display: view === "grid" ? "grid" : "none", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: "0.85rem" }}
            className="inv-grid-wrap">
            {items.map(item => (
              <div key={item.id} style={{ background: theme.cardBg, border: `1px solid ${item.stock_status !== "ok" ? (item.stock_status === "rupture" ? "#ef444433" : "#f59e0b33") : theme.border}`, borderRadius: "14px", overflow: "hidden", transition: "all 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 4px 20px ${PALETTE.primary}18`)}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
              >
                {/* Image */}
                <div style={{ height: 130, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", cursor: item.image_url ? "pointer" : "default" }}
                  onClick={() => item.image_url && setImgModal(item.image_url)}>
                  {item.image_url
                    ? <img src={item.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: "3rem", opacity: 0.25 }}>📦</span>}
                  <div style={{ position: "absolute", top: 8, right: 8 }}><StockBadge status={item.stock_status} /></div>
                </div>
                {/* Body */}
                <div style={{ padding: "0.9rem" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: theme.textPrimary, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                  {item.description && <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginBottom: "0.65rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</div>}
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                    <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>Quantité</span>
                    <span style={{ fontWeight: 700, color: item.stock_status !== "ok" ? STOCK_CFG[item.stock_status as keyof typeof STOCK_CFG]?.text : theme.textPrimary }}>{item.quantity} {item.unit}</span>
                  </div>
                  {item.prix_vente && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.65rem" }}>
                      <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>Prix vente</span>
                      <span style={{ fontWeight: 600, color: PALETTE.primary }}>{fmtPrix(item.prix_vente)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "0.4rem", paddingTop: "0.65rem", borderTop: `1px solid ${theme.border}` }}>
                    <button onClick={() => { setAdjusting(item); setShowAdjust(true); }}
                      style={{ flex: 1, padding: "0.42rem", borderRadius: RADIUS.md, border: "1px solid rgba(16,185,129,0.3)", background: "transparent", color: "#10b981", fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body }}>⚡</button>
                    <button onClick={() => { setEditing(item); setShowForm(true); }}
                      style={{ flex: 1, padding: "0.42rem", borderRadius: RADIUS.md, border: "1px solid rgba(59,130,246,0.3)", background: "transparent", color: "#3b82f6", fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body }}>✏️</button>
                    <button onClick={() => handleDelete(item)}
                      style={{ width: 30, borderRadius: RADIUS.md, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#ef4444", fontSize: "0.85rem", cursor: "pointer" }}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Cartes mobiles (toujours visibles < 768px) ── */}
          <div className="inv-grid-wrap" style={{ display: "none" }}>
            {/* Géré par CSS — la classe inv-grid-wrap est visible sur mobile via le CSS */}
          </div>
        </>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", marginTop: "0.75rem", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px" }}>
          <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>{page}/{totalPages} — {total} résultat{total > 1 ? "s" : ""}</span>
          <div style={{ display: "flex", gap: "0.3rem" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: "0.35rem 0.65rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, fontFamily: FONTS.body, fontSize: "0.8rem" }}>←</button>
            {[...Array(Math.min(totalPages, 5))].map((_, i) => {
              const p = i + 1;
              return <button key={p} onClick={() => setPage(p)} style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid ${p === page ? PALETTE.primary : theme.border}`, background: p === page ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : "transparent", color: p === page ? "#fff" : theme.textMuted, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body }}>{p}</button>;
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ padding: "0.35rem 0.65rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontFamily: FONTS.body, fontSize: "0.8rem" }}>→</button>
          </div>
        </div>
      )}

      {/* ── Modal aperçu image ── */}
      {imgModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", cursor: "pointer" }}
          onClick={() => setImgModal(null)}>
          <img src={imgModal} alt="" style={{ maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain", borderRadius: "12px" }} />
        </div>
      )}

      {/* ── Modals ── */}
      {showForm && (
        <ItemFormModal dark={dark} theme={theme} item={editing} categories={categories}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }} />
      )}
      {showAdjust && adjusting && (
        <StockAdjustModal dark={dark} theme={theme} item={adjusting}
          onClose={() => { setShowAdjust(false); setAdjusting(null); }}
          onSaved={() => { setShowAdjust(false); setAdjusting(null); load(); }} />
      )}
    </div>
  );
}
