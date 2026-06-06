// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/proformas/components/ProformaFormModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { proformasService, type Proforma, type ProformaItemPayload } from "../../../services/proformasService";
import { billingClientsService, type BillingClient } from "../../../services/billingClientsService";
import { productsService, type ProductSelect } from "../../../services/productsService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";
import { pdfService } from "../../../services/pdfService";
import { SearchableSelect } from "../../../components/SearchableSelect";


interface Props {
  dark:     boolean;
  theme:    LayoutContext["theme"];
  proforma: Proforma | null;
  clients:  BillingClient[];
  products: ProductSelect[];
  onClose:  () => void;
  onSaved: (created?: Proforma) => void;

}

interface LineItem {
  description:      string;
  quantity:         number;
  unit_price:       number;
  discount_percent: number;
  product:          number | null;
}

const emptyLine = (): LineItem => ({
  description: "", quantity: 1, unit_price: 0, discount_percent: 0, product: null,
});

const TAX_OPTIONS = [
  { value: "0",    label: "0% — Exonéré"       },
  { value: "0.18", label: "18% — TVA standard" },
  { value: "0.20", label: "20% — TVA majorée"  },
];

const defaultValidUntil = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
};

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  @keyframes pfm-spin { to { transform: rotate(360deg); } }

  .pfm-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 500;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0;
  }
  @media (min-width: 640px) {
    .pfm-overlay {
      align-items: center;
      padding: 0.5rem;
    }
  }

  .pfm-modal {
    width: 100%;
    max-height: 98vh;
    overflow-y: auto;
    border-radius: 18px 18px 0 0;
  }
  @media (min-width: 640px) {
    .pfm-modal {
      max-width: 880px;
      border-radius: 18px;
      max-height: 96vh;
    }
  }

  .pfm-tabs {
    display: flex;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    gap: 0;
  }
  .pfm-tabs::-webkit-scrollbar { display: none; }

  .pfm-tab-btn {
    flex-shrink: 0;
    padding: 0.7rem 0.9rem;
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
  }
  @media (min-width: 640px) {
    .pfm-tab-btn { padding: 0.8rem 1.25rem; font-size: 0.875rem; }
  }

  .pfm-body { padding: 1rem; }
  @media (min-width: 640px) {
    .pfm-body { padding: 1.5rem; }
  }

  /* Grille infos générales */
  .pfm-grid-info {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  @media (min-width: 480px) {
    .pfm-grid-info { grid-template-columns: 1fr 1fr; }
  }
  @media (min-width: 768px) {
    .pfm-grid-info { grid-template-columns: repeat(3, 1fr); }
  }

  /* Remise + Récap */
  .pfm-grid-recap {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }
  @media (min-width: 640px) {
    .pfm-grid-recap { grid-template-columns: 1fr 1fr; }
  }

  /* Footer */
  .pfm-footer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid;
  }
  @media (min-width: 480px) {
    .pfm-footer {
      flex-direction: row;
      justify-content: flex-end;
    }
  }

  /* Formulaire client/produit intégré */
  .pfm-inner-grid2 {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  @media (min-width: 480px) {
    .pfm-inner-grid2 { grid-template-columns: 1fr 1fr; }
  }

  .pfm-inner-grid4 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
`;

// ── Sous-formulaire client intégré ────────────────────────────────────────────
function InlineClientForm({theme, onCreated }: {
  dark: boolean; theme: LayoutContext["theme"];
  onCreated: (client: BillingClient) => void;
}) {
  const swal = useSwal();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: "", contact_name: "", email: "",
    phone: "", address: "", tax_id: "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.phone.trim()) { swal.error("Requis", "Le téléphone est obligatoire."); return; }
    if (!form.company_name.trim() && !form.contact_name.trim()) {
      swal.error("Requis", "Le nom de l'entreprise ou du contact est requis."); return;
    }
    setSaving(true);
    try {
      const created = await billingClientsService.create({
        company_name: form.company_name.trim() || null,
        contact_name: form.contact_name.trim() || null,
        email:        form.email.trim()         || null,
        phone:        form.phone.trim(),
        address:      form.address.trim()       || null,
        tax_id:       form.tax_id.trim()        || null,
      });
      swal.saved("Le client");
      onCreated(created);
    } catch (err: any) {
      const d = err?.response?.data;
      swal.error("Erreur", d?.phone?.[0] ?? d?.detail ?? "Une erreur est survenue.");
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(6,182,212,0.06)", border: `1px solid rgba(6,182,212,0.2)`, fontSize: "0.82rem", color: theme.textSecondary }}>
        💡 Le client sera automatiquement sélectionné dans le proforma après création.
      </div>

      <div className="pfm-inner-grid2">
        <div>
          <label style={lbl}>Nom de l'entreprise</label>
          <input value={form.company_name} onChange={e => set("company_name", e.target.value)} placeholder="ACME Corp" style={inp} />
        </div>
        <div>
          <label style={lbl}>Nom du contact</label>
          <input value={form.contact_name} onChange={e => set("contact_name", e.target.value)} placeholder="Jean Dupont" style={inp} />
        </div>
        <div>
          <label style={lbl}>Téléphone <span style={{ color: "#ef4444" }}>*</span></label>
          <input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="77 000 00 00" style={inp} />
        </div>
        <div>
          <label style={lbl}>Email</label>
          <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="contact@entreprise.com" style={inp} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>Adresse</label>
          <textarea value={form.address} onChange={e => set("address", e.target.value)} placeholder="Rue, quartier, ville…" rows={2} style={{ ...inp, resize: "vertical" }} />
        </div>
        <div>
          <label style={lbl}>NINEA / Numéro fiscal</label>
          <input value={form.tax_id} onChange={e => set("tax_id", e.target.value)} placeholder="Ex: 00123456 7Z3" style={inp} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "0.5rem", borderTop: `1px solid ${theme.border}` }}>
        <button type="submit" disabled={saving}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.62rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? `${PALETTE.primary}66` : `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
          {saving
            ? <><span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "pfm-spin 0.7s linear infinite", display: "inline-block" }} /> Création…</>
            : "✓ Créer le client"}
        </button>
      </div>
    </form>
  );
}

// ── Sous-formulaire produit intégré ───────────────────────────────────────────
function InlineProductForm({ dark, theme, onCreated }: {
  dark: boolean; theme: LayoutContext["theme"];
  onCreated: (product: ProductSelect) => void;
}) {
  const swal    = useSwal();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving,     setSaving]     = useState(false);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [imgFile,    setImgFile]    = useState<File | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", qty: "0",
    prix: "0", fournisseur: "", alert_quantity: "5",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

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
    const reader = new FileReader();
    reader.onload = ev => setImgPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() && !form.description.trim()) {
      swal.error("Requis", "Le nom ou la description est obligatoire."); return;
    }
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

      const created = await productsService.create(fd);
      swal.saved("Le produit");
      // Convertir en ProductSelect pour l'ajouter à la liste
      const asSelect: ProductSelect = {
        id:           created.id,
        name:         created.name ?? created.description ?? "",
        description:  created.description ?? null,
        price:        created.unit_price,
        quantity:     created.quantity,
        is_low_stock: created.stock_status !== "ok",
      };
      onCreated(asSelect);
    } catch (err: any) {
      swal.error("Erreur", err?.response?.data?.detail ?? "Une erreur est survenue.");
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", fontSize: "0.82rem", color: theme.textSecondary }}>
        💡 Le produit sera automatiquement disponible dans la liste des articles du proforma.
      </div>

      {/* Image + Nom */}
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        <div
          onClick={() => fileRef.current?.click()}
          style={{ width: 90, height: 90, borderRadius: "12px", border: `2px dashed ${imgPreview ? PALETTE.primary + "55" : theme.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}>
          {imgPreview
            ? <img src={imgPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ textAlign: "center", color: theme.textMuted }}>
                <div style={{ fontSize: "1.5rem" }}>📷</div>
                <div style={{ fontSize: "0.65rem", marginTop: 2 }}>Image</div>
              </div>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div>
            <label style={lbl}>Nom du produit <span style={{ color: "#ef4444" }}>*</span></label>
            <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Caméra IP 4K…" style={inp} />
          </div>
          <div>
            <label style={lbl}>Description</label>
            <input value={form.description} onChange={e => set("description", e.target.value)} placeholder="Détails…" style={inp} />
          </div>
        </div>
      </div>

      <div className="pfm-inner-grid4">
        <div>
          <label style={lbl}>Quantité</label>
          <input type="number" min="0" step="0.01" value={form.qty} onChange={e => set("qty", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Seuil alerte</label>
          <input type="number" min="0" step="0.01" value={form.alert_quantity} onChange={e => set("alert_quantity", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Prix unitaire (F) <span style={{ color: "#ef4444" }}>*</span></label>
          <input type="number" min="0" step="0.01" value={form.prix} onChange={e => set("prix", e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Fournisseur</label>
          <input value={form.fournisseur} onChange={e => set("fournisseur", e.target.value)} placeholder="Fournisseur" style={inp} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "0.5rem", borderTop: `1px solid ${theme.border}` }}>
        <button type="submit" disabled={saving}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.62rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? "rgba(16,185,129,0.45)" : "linear-gradient(135deg,#10b981,#059669)", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
          {saving
            ? <><span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "pfm-spin 0.7s linear infinite", display: "inline-block" }} /> Création…</>
            : "✓ Créer le produit"}
        </button>
      </div>
    </form>
  );
}

// ── ProformaFormModal ─────────────────────────────────────────────────────────
type TabKey = "proforma" | "client" | "product";

export default function ProformaFormModal({ dark, theme, proforma, clients: initialClients, products: initialProducts, onClose, onSaved }: Props) {
  const swal   = useSwal();
  const isEdit = !!proforma;
  const [saving,   setSaving]   = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("proforma");

  // Listes locales (peuvent être enrichies sans recharger le parent)
  const [localClients,  setLocalClients]  = useState<BillingClient[]>(initialClients);
  const [localProducts, setLocalProducts] = useState<ProductSelect[]>(initialProducts);

  // Sync si le parent recharge
  useEffect(() => { setLocalClients(initialClients);  }, [initialClients]);
  useEffect(() => { setLocalProducts(initialProducts); }, [initialProducts]);

  const [form, setForm] = useState({
    proforma_number: proforma?.proforma_number  ?? "",
    billing_client:  proforma?.billing_client?.toString() ?? "",
    date:            proforma?.date             ?? new Date().toISOString().split("T")[0],
    valid_until:     proforma?.valid_until      ?? defaultValidUntil(),
    tax_rate:        proforma?.tax_rate?.toString() ?? "0.18",
    domaine:         proforma?.domaine          ?? "" as "" | "NETSYSTEME" | "SSE",
    notes:           proforma?.notes            ?? "",
    discount_type:   proforma?.discount_percent ? "percent"
                     : proforma?.discount_amount ? "amount" : "none",
    discount_value:  (proforma?.discount_percent ?? proforma?.discount_amount ?? 0).toString(),
  });

  const [lines, setLines] = useState<LineItem[]>(
    proforma?.items?.length
      ? proforma.items.map(it => ({
          description:      it.description ?? "",
          quantity:         it.quantity,
          unit_price:       it.unit_price,
          discount_percent: it.discount_percent,
          product:          it.product,
        }))
      : [emptyLine()]
  );

  useEffect(() => {
    if (!isEdit && !form.proforma_number) {
      proformasService.getNextNumber()
        .then(r => setForm(f => ({ ...f, proforma_number: r.number })))
        .catch(() => {});
    }
  }, []);

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setLine = (i: number, k: keyof LineItem, v: string | number | null) =>
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  const selectProduct = (idx: number, productId: string) => {
    const p = localProducts.find(p => p.id === parseInt(productId));
    if (p) {
      setLines(ls => ls.map((l, i) => i === idx ? {
        ...l, product: p.id,
        description: p.name ?? p.description ?? "",
        unit_price:  p.price,
      } : l));
    } else {
      setLine(idx, "product", null);
    }
  };

  // Callbacks création inline
  const handleClientCreated = (client: BillingClient) => {
    setLocalClients(prev => [...prev, client]);
    setF("billing_client", client.id.toString());
    setActiveTab("proforma");
  };

  const handleProductCreated = (product: ProductSelect) => {
    setLocalProducts(prev => [...prev, product]);
    setActiveTab("proforma");
  };

  // Calculs
  const taxRate  = parseFloat(form.tax_rate) || 0;
  const totalHT  = lines.reduce((s, l) => s + l.quantity * l.unit_price * (1 - l.discount_percent / 100), 0);
  const tva      = totalHT * taxRate;
  const totalTTC = totalHT + tva;
  const discVal  = form.discount_type === "percent"
    ? totalTTC * (parseFloat(form.discount_value) / 100)
    : form.discount_type === "amount" ? parseFloat(form.discount_value) || 0 : 0;
  const netTTC   = totalTTC - discVal;
  const fmt      = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

  const validUntilExpired = form.valid_until && new Date(form.valid_until) < new Date();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter(l => l.description.trim());
    if (!form.billing_client) { swal.error("Champ requis", "Sélectionnez un client.");       return; }
    if (!form.domaine)         { swal.error("Champ requis", "Sélectionnez un domaine.");      return; }
    if (!form.proforma_number) { swal.error("Champ requis", "Le numéro est obligatoire.");    return; }
    if (!validLines.length)    { swal.error("Champ requis", "Ajoutez au moins un article.");  return; }

    // Onglet vide ouvert synchrone avant tout await → contourne le popup blocker.
    const pdfTab = !isEdit ? window.open("", "_blank") : null;

    setSaving(true);
    try {
      const payload = {
        proforma_number:  form.proforma_number,
        billing_client:   parseInt(form.billing_client),
        date:             form.date,
        valid_until:      form.valid_until || null,
        tax_rate:         parseFloat(form.tax_rate),
        domaine:          form.domaine as "NETSYSTEME" | "SSE",
        notes:            form.notes || null,
        discount_percent: form.discount_type === "percent" ? parseFloat(form.discount_value) || 0 : 0,
        discount_amount:  form.discount_type === "amount"  ? parseFloat(form.discount_value) || 0 : 0,
        items:            validLines as ProformaItemPayload[],
      };
      if (isEdit) {
        await proformasService.update(proforma!.id, payload);
        swal.updated("Le proforma");
        if (pdfTab) pdfTab.close();
        onSaved();
      } else {
        const created    = await proformasService.create(payload);
        const clientName = localClients.find(c => c.id === parseInt(form.billing_client))?.display_name;
        swal.saved("Le proforma");
        if (pdfTab) pdfService.proforma.viewInTab(pdfTab, created.id, clientName, created.proforma_number);
        onSaved(created);
      }
    } catch (err: any) {
      const d = err?.response?.data;
      const msg = d?.detail ?? d?.proforma_number?.[0] ?? d?.billing_client?.[0] ?? d?.domaine?.[0] ?? d?.items?.[0] ?? "Une erreur est survenue.";
      swal.error("Erreur", typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally { setSaving(false); }
  };

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
  const sep = (title: string) => (
    <div style={{ fontSize: "0.68rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ flex: 1, height: 1, background: theme.border }} />
      {title}
      <div style={{ flex: 1, height: 1, background: theme.border }} />
    </div>
  );

  // Config onglets
  const TABS: { key: TabKey; label: string; icon: string; color: string }[] = [
    { key: "proforma", label: "Proforma",       icon: "📋", color: "#8b5cf6" },
    { key: "client",   label: "+ Nouveau client",  icon: "👤", color: PALETTE.primary },
    { key: "product",  label: "+ Nouveau produit", icon: "📦", color: "#10b981" },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="pfm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div
          className="pfm-modal"
          style={{
            background: theme.popupBg,
            border: `1px solid ${theme.border}`,
            boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)",
            fontFamily: FONTS.body,
          }}
        >
          {/* ── Header ── */}
          <div style={{ position: "sticky", top: 0, background: theme.popupBg, zIndex: 10, borderRadius: "18px 18px 0 0", borderBottom: `1px solid ${theme.border}` }}>
            {/* Titre + fermer */}
            <div style={{ padding: "1rem 1.25rem 0.75rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: theme.textPrimary, marginBottom: 2 }}>
                  {isEdit ? `Modifier ${proforma!.proforma_number}` : "Nouveau proforma"}
                </h2>
                <p style={{ fontSize: "0.75rem", color: theme.textMuted }}>
                  {activeTab === "proforma"
                    ? (isEdit ? "Modifiez les informations du proforma" : "Renseignez les informations du nouveau proforma")
                    : activeTab === "client"
                      ? "Créez un client qui sera automatiquement sélectionné"
                      : "Créez un produit qui sera disponible dans les articles"}
                </p>
              </div>
              <button onClick={onClose}
                style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1, flexShrink: 0 }}>
                ✕
              </button>
            </div>

            {/* Onglets */}
            <div className="pfm-tabs">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  className="pfm-tab-btn"
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    color: activeTab === tab.key ? tab.color : theme.textMuted,
                    borderBottomColor: activeTab === tab.key ? tab.color : "transparent",
                    fontFamily: FONTS.body,
                    fontWeight: activeTab === tab.key ? 600 : 400,
                    background: activeTab === tab.key
                      ? (dark ? tab.color + "10" : tab.color + "08")
                      : "transparent",
                  }}
                >
                  <span style={{ marginRight: "0.35rem" }}>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Onglet Proforma ── */}
          {activeTab === "proforma" && (
            <form onSubmit={handleSubmit}>
              <div className="pfm-body">

                {/* Informations générales */}
                <div style={{ marginBottom: "1.25rem" }}>
                  {sep("Informations générales")}
                  <div className="pfm-grid-info">
                    <div>
                      <label style={lbl}>Numéro *</label>
                      <input required value={form.proforma_number} onChange={e => setF("proforma_number", e.target.value)} style={inp} placeholder="PRO-20240101-1" />
                    </div>
                    <div>
                      <label style={lbl}>Client *</label>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <SearchableSelect
                          options={localClients.map(c => ({ value: c.id.toString(), label: c.display_name }))}
                          value={form.billing_client}
                          onChange={v => setF("billing_client", v)}
                          placeholder="Rechercher un client…"
                          theme={theme} dark={dark}
                          style={{ flex: 1 }}
                        />
                        <button type="button" onClick={() => setActiveTab("client")} title="Créer un client"
                          style={{ flexShrink: 0, width: 36, height: 36, borderRadius: RADIUS.md, border: `1px solid ${PALETTE.primary}44`, background: "transparent", color: PALETTE.primary, cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          +
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Domaine *</label>
                      <select required value={form.domaine} onChange={e => setF("domaine", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                        <option value="">— Sélectionner —</option>
                        <option value="NETSYSTEME">NETSYSTEME</option>
                        <option value="SSE">SSE</option>
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Date *</label>
                      <input required type="date" value={form.date} onChange={e => setF("date", e.target.value)} style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>
                        Valide jusqu'au
                        {validUntilExpired && <span style={{ color: "#ef4444", marginLeft: 6, fontSize: "0.65rem" }}>⚠ Dépassée</span>}
                      </label>
                      <input type="date" value={form.valid_until}
                        onChange={e => setF("valid_until", e.target.value)}
                        style={{ ...inp, borderColor: validUntilExpired ? "#ef4444" : theme.border }} />
                    </div>
                    <div>
                      <label style={lbl}>Taux TVA</label>
                      <select value={form.tax_rate} onChange={e => setF("tax_rate", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                        {TAX_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Articles */}
                <div style={{ marginBottom: "1.25rem" }}>
                  {sep("Articles")}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                    {lines.map((line, i) => {
                      const lineTotal = line.quantity * line.unit_price * (1 - line.discount_percent / 100);
                      return (
                        <div key={i} style={{ border: `1px solid ${theme.border}`, borderRadius: RADIUS.lg, overflow: "hidden", background: dark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.01)" }}>
                          {/* Barre titre */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.85rem", background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", borderBottom: `1px solid ${theme.border}` }}>
                            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              Article {i + 1}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: PALETTE.primary }}>
                                {fmt(lineTotal)} F
                              </span>
                              <button type="button"
                                onClick={() => setLines(ls => ls.filter((_, idx) => idx !== i))}
                                disabled={lines.length === 1}
                                style={{ width: 26, height: 26, borderRadius: "7px", border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#ef4444", cursor: lines.length === 1 ? "not-allowed" : "pointer", opacity: lines.length === 1 ? 0.3 : 1, fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Champs */}
                          <div style={{ padding: "0.75rem 0.85rem", display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                            {/* Produit catalogue */}
                            <div>
                              <label style={lbl}>Produit catalogue</label>
                              <div style={{ display: "flex", gap: "0.4rem" }}>
                                <SearchableSelect
                                  options={[
                                    { value: "", label: "Saisie libre…" },
                                    ...localProducts.map(p => ({
                                      value: p.id.toString(),
                                      label: `${p.name ?? p.description ?? ""}${p.is_low_stock ? " ⚠" : ""}`,
                                      sub: `${new Intl.NumberFormat("fr-FR").format(Math.round(p.price ?? 0))} F`,
                                    })),
                                  ]}
                                  value={line.product?.toString() ?? ""}
                                  onChange={v => selectProduct(i, v)}
                                  placeholder="Rechercher un produit…"
                                  theme={theme} dark={dark}
                                  style={{ flex: 1, fontSize: "0.85rem" } as React.CSSProperties}
                                />
                                <button type="button" onClick={() => setActiveTab("product")} title="Créer un produit"
                                  style={{ flexShrink: 0, width: 36, height: 36, borderRadius: RADIUS.md, border: "1px solid rgba(16,185,129,0.4)", background: "transparent", color: "#10b981", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Description */}
                            <div>
                              <label style={lbl}>Description *</label>
                              <textarea value={line.description} onChange={e => setLine(i, "description", e.target.value)}
                                placeholder="Description de l'article…" rows={2} style={{ ...inp, resize: "vertical", minHeight: 60 }} />
                            </div>

                            {/* Qté + Prix */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem" }}>
                              <div>
                                <label style={lbl}>Quantité</label>
                                <input type="number" min="0.01" step="0.01" value={line.quantity}
                                  onChange={e => setLine(i, "quantity", parseFloat(e.target.value) || 0)} style={inp} />
                              </div>
                              <div>
                                <label style={lbl}>Prix unitaire (F)</label>
                                <input type="number" min="0" step="0.01" value={line.unit_price}
                                  onChange={e => setLine(i, "unit_price", parseFloat(e.target.value) || 0)} style={inp} />
                              </div>
                            </div>

                            {/* Remise + Total */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem", alignItems: "end" }}>
                              <div>
                                <label style={lbl}>Remise (%)</label>
                                <input type="number" min="0" max="100" step="0.01" value={line.discount_percent}
                                  onChange={e => setLine(i, "discount_percent", parseFloat(e.target.value) || 0)} style={inp} />
                              </div>
                              <div style={{ padding: "0.5rem 0.85rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", border: `1px solid ${theme.border}` }}>
                                <div style={{ fontSize: "0.65rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Total HT</div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: theme.textPrimary }}>{fmt(lineTotal)} F</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Ajouter une ligne */}
                    <button type="button" onClick={() => setLines(ls => [...ls, emptyLine()])}
                      style={{ width: "100%", padding: "0.65rem", borderRadius: RADIUS.md, border: `1px dashed ${PALETTE.primary}66`, background: "transparent", color: PALETTE.primary, fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = PALETTE.primary + "0d")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      + Ajouter un article
                    </button>
                  </div>
                </div>

                {/* Remise & Notes + Récap */}
                <div className="pfm-grid-recap">
                  {/* Gauche */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {sep("Remise & Notes")}
                    <div>
                      <label style={lbl}>Type de remise</label>
                      <select value={form.discount_type} onChange={e => setF("discount_type", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                        <option value="none">Aucune remise</option>
                        <option value="percent">En pourcentage (%)</option>
                        <option value="amount">Montant fixe (FCFA)</option>
                      </select>
                    </div>
                    {form.discount_type !== "none" && (
                      <div>
                        <label style={lbl}>{form.discount_type === "percent" ? "Remise (%)" : "Remise (FCFA)"}</label>
                        <input type="number" min="0" step="0.01" value={form.discount_value}
                          onChange={e => setF("discount_value", e.target.value)} style={inp} />
                      </div>
                    )}
                    <div>
                      <label style={lbl}>Notes</label>
                      <textarea value={form.notes} onChange={e => setF("notes", e.target.value)}
                        rows={3} style={{ ...inp, resize: "vertical", minHeight: 76 }}
                        placeholder="Conditions, remarques, délais…" />
                    </div>
                  </div>

                  {/* Droite — récap */}
                  <div>
                    {sep("Récapitulatif")}
                    <div style={{ background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)", borderRadius: RADIUS.lg, border: `1px solid ${theme.border}`, overflow: "hidden" }}>
                      {[
                        { label: "Total HT",                             value: totalHT,  bold: false },
                        { label: `TVA (${(taxRate * 100).toFixed(0)}%)`, value: tva,      bold: false },
                        { label: "Total TTC",                            value: totalTTC, bold: true  },
                        ...(discVal > 0 ? [{ label: "Remise", value: -discVal, bold: false }] : []),
                      ].map((row, i, arr) => (
                        <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 1rem", borderBottom: i < arr.length - 1 ? `1px solid ${theme.border}` : "none" }}>
                          <span style={{ fontSize: "0.82rem", color: theme.textMuted }}>{row.label}</span>
                          <span style={{ fontSize: row.bold ? "0.95rem" : "0.88rem", fontWeight: row.bold ? 700 : 500, color: row.value < 0 ? "#10b981" : row.bold ? theme.textPrimary : theme.textSecondary }}>
                            {row.value < 0 ? "- " : ""}{fmt(Math.abs(row.value))} F
                          </span>
                        </div>
                      ))}
                      <div style={{ padding: "0.85rem 1rem", background: dark ? "rgba(139,92,246,0.08)" : "rgba(139,92,246,0.05)", borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: theme.textPrimary }}>Net à payer</span>
                        <span style={{ fontSize: "1.25rem", fontWeight: 800, fontFamily: FONTS.display, color: "#8b5cf6" }}>
                          {fmt(netTTC)} F
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="pfm-footer" style={{ borderTopColor: theme.border, padding: "1rem" }}>
                <button type="submit" disabled={saving}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? "rgba(139,92,246,0.45)" : "linear-gradient(135deg,#8b5cf6,#6d28d9)", color: "#fff", fontSize: "0.9rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
                  {saving
                    ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "pfm-spin 0.7s linear infinite", display: "inline-block" }} /> Enregistrement…</>
                    : isEdit ? "Enregistrer les modifications" : "Créer le proforma"}
                </button>
                <button type="button" onClick={onClose}
                  style={{ width: "100%", padding: "0.7rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
                  Annuler
                </button>
              </div>
            </form>
          )}

          {/* ── Onglet Nouveau client ── */}
          {activeTab === "client" && (
            <div className="pfm-body">
              <InlineClientForm dark={dark} theme={theme} onCreated={handleClientCreated} />
            </div>
          )}

          {/* ── Onglet Nouveau produit ── */}
          {activeTab === "product" && (
            <div className="pfm-body">
              <InlineProductForm dark={dark} theme={theme} onCreated={handleProductCreated} />
            </div>
          )}

        </div>
      </div>
    </>
  );
}