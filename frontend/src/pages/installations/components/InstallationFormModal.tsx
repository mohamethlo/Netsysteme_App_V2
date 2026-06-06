// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/installations/components/InstallationFormModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import {
  installationsService, type Installation, type FormData,
  type InstallationProductPayload, type InstallationMethode,
} from "../../../services/installationService";
import { pdfService } from "../../../services/pdfService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark:         boolean;
  theme:        LayoutContext["theme"];
  installation: Installation | null;
  formData:     FormData;
  onClose:      () => void;
  onSaved:      () => void;
}

interface LineItem {
  product_id:  number | null;
  product_name:string;
  quantity:    number;
  unit_price:  number;
  total_price: number;
}

const emptyLine = (): LineItem => ({ product_id: null, product_name: "", quantity: 1, unit_price: 0, total_price: 0 });

const METHODE_OPTIONS: { value: InstallationMethode | ""; label: string }[] = [
  { value: "",              label: "— Sélectionner —"    },
  { value: "cash",          label: "Espèce (Comptant)"   },
  { value: "one_tranche",   label: "1 tranche"            },
  { value: "two_tranche",   label: "2 tranches"           },
  { value: "three_tranche", label: "3 tranches"           },
  { value: "four_tranche",  label: "4 tranches"           },
  { value: "five_tranche",  label: "5 tranches"           },
  { value: "six_tranche",   label: "6 tranches"           },
];

const AVANCE_RATIOS: Record<string, number> = {
  cash: 1, one_tranche: 0.5, two_tranche: 0.4,
  three_tranche: 0.3, four_tranche: 0.25,
  five_tranche: 0.2, six_tranche: 0.167,
};

export default function InstallationFormModal({ dark, theme, installation, formData, onClose, onSaved }: Props) {
  const swal   = useSwal();
  const isEdit = !!installation;
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [generatePdf, setGeneratePdf] = useState(false);
  const [contratFile, setContratFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    prenom:           installation?.prenom           ?? "",
    nom:              installation?.nom              ?? "",
    telephone:        installation?.telephone        ?? "",
    adresse:          installation?.adresse          ?? "",
    rccm:             installation?.rccm             ?? "",
    immatricule:      installation?.immatricule      ?? "",
    ninea:            installation?.ninea            ?? "",
    date_installation:installation?.date_installation ?? "",
    methode_paiement: (installation?.methode_paiement ?? "") as InstallationMethode | "",
    date_echeance:    installation?.date_echeance    ?? "",
    statut:           installation?.statut           ?? "en_attente",
    agent_commercial: installation?.agent_commercial?.toString() ?? "",
    invoice_id:       "" as string,
  });

  const [technicienIds, setTechnicienIds] = useState<number[]>(
    installation?.techniciens ?? []
  );
  const [lines, setLines] = useState<LineItem[]>(
    installation?.products?.length
      ? installation.products.map(p => ({
          product_id:   p.product,
          product_name: p.product_name ?? "",
          quantity:     p.quantity,
          unit_price:   p.unit_price,
          total_price:  p.total_price,
        }))
      : []
  );

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Calculs auto
  const totalHT = lines.reduce((s, l) => s + l.total_price, 0);
  const avanceAuto = form.methode_paiement
    ? Math.floor(totalHT * (AVANCE_RATIOS[form.methode_paiement] ?? 0))
    : 0;
  const restant = totalHT - avanceAuto;
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

  // Date échéance auto (date_installation + 30j)
  useEffect(() => {
    if (form.date_installation && !isEdit) {
      const d = new Date(form.date_installation);
      d.setDate(d.getDate() + 30);
      setF("date_echeance", d.toISOString().split("T")[0]);
    }
  }, [form.date_installation]);

  // Lignes produits
  const updateLine = (i: number, k: keyof LineItem, v: any) => {
    setLines(ls => ls.map((l, idx) => {
      if (idx !== i) return l;
      const nl = { ...l, [k]: v };
      if (k === "quantity" || k === "unit_price") nl.total_price = nl.quantity * nl.unit_price;
      return nl;
    }));
  };

  const selectProduct = (i: number, productId: string) => {
    const p = formData.products.find((p: any) => p.id === parseInt(productId));
    if (p) {
      setLines(ls => ls.map((l, idx) => idx === i ? {
        ...l, product_id: p.id, product_name: p.name ?? p.description ?? "",
        unit_price: p.unit_price, total_price: l.quantity * p.unit_price,
      } : l));
    }
  };

  const toggleTech = (id: number) => {
    setTechnicienIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.telephone.trim()) { swal.error("Requis", "Le téléphone est obligatoire."); return; }
    if (!form.prenom && !form.nom) { swal.error("Requis", "Prénom ou nom obligatoire."); return; }
    if (!form.date_installation) { swal.error("Requis", "La date d'installation est obligatoire."); return; }

    // Ouvrir l'onglet AVANT tout await (évite le popup blocker)
    const pdfTab = (!isEdit && generatePdf) ? window.open("", "_blank") : null;

    setSaving(true);
    try {
      const productsData: InstallationProductPayload[] = lines
        .filter(l => l.product_id && l.quantity > 0)
        .map(l => ({
          product_id:  l.product_id!,
          quantity:    l.quantity,
          unit_price:  l.unit_price,
          total_price: l.total_price,
        }));

      const payload = {
        prenom:            form.prenom || undefined,
        nom:               form.nom    || undefined,
        telephone:         form.telephone,
        adresse:           form.adresse    || null,
        rccm:              form.rccm       || null,
        immatricule:       form.immatricule|| null,
        ninea:             form.ninea      || null,
        montant_total:     totalHT,
        montant_avance:    avanceAuto,
        montant_restant:   restant,
        date_installation: form.date_installation || null,
        methode_paiement:  (form.methode_paiement || null) as InstallationMethode | null,
        date_echeance:     form.date_echeance     || null,
        statut:            form.statut as any,
        agent_commercial:  form.agent_commercial ? parseInt(form.agent_commercial) : null,
        techniciens_ids:   technicienIds,
        products_data:     productsData,
        invoice_id:        form.invoice_id ? parseInt(form.invoice_id) : null,
      };

      if (isEdit) {
        await installationsService.update(installation!.id, payload, contratFile ?? undefined);
        swal.updated("L'installation");
      } else {
        const created = await installationsService.create(payload, contratFile ?? undefined, generatePdf);
        const clientName = `${form.prenom} ${form.nom}`.trim() || undefined;
        swal.saved("L'installation");
        if (pdfTab) {
          pdfService.contract.viewInTab(pdfTab, created.id, clientName);
        }
      }
      onSaved();
    } catch (err: any) {
      pdfTab?.close();
      const d = err?.response?.data;
      const msg = d?.detail ?? d?.telephone?.[0] ?? "Une erreur est survenue.";
      swal.error("Erreur", msg);
    } finally { setSaving(false); }
  };

  const inp: React.CSSProperties = { width: "100%", padding: "0.6rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" as const };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.7rem", fontWeight: 600, color: theme.textSecondary, marginBottom: "0.28rem", textTransform: "uppercase", letterSpacing: "0.05em" };
  const sep = (t: string) => (
    <div style={{ fontSize: "0.68rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.85rem", marginTop: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ flex: 1, height: 1, background: theme.border }} />{t}<div style={{ flex: 1, height: 1, background: theme.border }} />
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 900, maxHeight: "96vh", overflowY: "auto", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: theme.popupBg, zIndex: 2, borderRadius: "18px 18px 0 0" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1.1rem", fontWeight: 700, color: theme.textPrimary, marginBottom: 2 }}>
              {isEdit ? `Modifier l'installation #${installation!.id}` : "Nouvelle installation"}
            </h2>
            <p style={{ fontSize: "0.78rem", color: theme.textMuted }}>SSE — Caméras de surveillance</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>

          {/* Informations client */}
          {sep("Informations client")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.85rem" }}>
            <div><label style={lbl}>Prénom *</label><input required value={form.prenom} onChange={e => setF("prenom", e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Nom *</label><input required value={form.nom} onChange={e => setF("nom", e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Téléphone *</label><input required value={form.telephone} onChange={e => setF("telephone", e.target.value)} style={inp} /></div>
            <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Adresse</label><input value={form.adresse} onChange={e => setF("adresse", e.target.value)} placeholder="Rue, quartier, ville…" style={inp} /></div>
            <div><label style={lbl}>N° RCCM</label><input value={form.rccm} onChange={e => setF("rccm", e.target.value)} placeholder="SN-DKR-2023-B-12345" style={inp} /></div>
            <div><label style={lbl}>N° Immatriculation</label><input value={form.immatricule} onChange={e => setF("immatricule", e.target.value)} style={inp} /></div>
            <div><label style={lbl}>NINEA</label><input value={form.ninea} onChange={e => setF("ninea", e.target.value)} placeholder="123456789" style={inp} /></div>
          </div>

          {/* Produits */}
          {sep("Produits / Services SSE")}
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: RADIUS.lg, overflow: "hidden", marginBottom: "0.75rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "3fr 0.8fr 1.2fr 1fr 30px", gap: "0.5rem", padding: "0.55rem 0.9rem", background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", borderBottom: `1px solid ${theme.border}`, fontSize: "0.68rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase" }}>
              <span>Produit</span><span>Qté</span><span>Prix (F)</span><span style={{ textAlign: "right" }}>Total (F)</span><span />
            </div>
            {lines.map((line, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 0.8fr 1.2fr 1fr 30px", gap: "0.5rem", padding: "0.5rem 0.9rem", borderBottom: i < lines.length - 1 ? `1px solid ${theme.border}` : "none", alignItems: "center" }}>
                <select value={line.product_id?.toString() ?? ""} onChange={e => selectProduct(i, e.target.value)} style={{ ...inp, padding: "0.42rem 0.65rem", fontSize: "0.82rem" }}>
                  <option value="">— Sélectionner —</option>
                  {formData.products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name ?? p.description}</option>
                  ))}
                </select>
                <input type="number" min="1" value={line.quantity} onChange={e => updateLine(i, "quantity", parseInt(e.target.value) || 1)} style={{ ...inp, padding: "0.5rem 0.65rem" }} />
                <input type="number" min="0" step="1" value={line.unit_price} onChange={e => updateLine(i, "unit_price", parseFloat(e.target.value) || 0)} style={{ ...inp, padding: "0.5rem 0.65rem" }} />
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: theme.textPrimary, textAlign: "right" }}>{fmt(line.total_price)}</span>
                <button type="button" onClick={() => setLines(ls => ls.filter((_, idx) => idx !== i))}
                  style={{ width: 28, height: 28, borderRadius: "7px", border: `1px solid rgba(239,68,68,0.3)`, background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
            ))}
            <div style={{ padding: "0.5rem 0.9rem", borderTop: lines.length > 0 ? `1px solid ${theme.border}` : "none" }}>
              <button type="button" onClick={() => setLines(ls => [...ls, emptyLine()])}
                style={{ fontSize: "0.82rem", color: PALETTE.primary, background: "none", border: "none", cursor: "pointer", fontFamily: FONTS.body, padding: 0 }}>
                + Ajouter un produit
              </button>
            </div>
          </div>

          {/* Détails installation */}
          {sep("Détails installation")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.85rem" }}>
            <div>
              <label style={lbl}>Date installation *</label>
              <input required type="date" value={form.date_installation} onChange={e => setF("date_installation", e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Méthode de paiement *</label>
              <select required value={form.methode_paiement} onChange={e => setF("methode_paiement", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                {METHODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Date échéance (1ère tranche)</label>
              <input type="date" value={form.date_echeance} onChange={e => setF("date_echeance", e.target.value)} style={{ ...inp, background: theme.inputBg }} readOnly />
            </div>
            {isEdit && (
              <div>
                <label style={lbl}>Statut</label>
                <select value={form.statut} onChange={e => setF("statut", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                  <option value="en_attente">En attente</option>
                  <option value="en_cours">En cours</option>
                  <option value="termine">Terminé</option>
                  <option value="annule">Annulé</option>
                </select>
              </div>
            )}
          </div>

          {/* Récap montants */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.85rem", marginTop: "0.85rem" }}>
            {[
              { l: "Montant total (F)", v: fmt(totalHT),    c: theme.textPrimary },
              { l: "Avance — 1ère tranche (F)", v: fmt(avanceAuto), c: PALETTE.primary },
              { l: "Restant à payer (F)", v: fmt(restant),  c: restant > 0 ? "#ef4444" : "#10b981" },
            ].map(r => (
              <div key={r.l} style={{ padding: "0.75rem 1rem", background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)", borderRadius: RADIUS.md, border: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: "0.7rem", color: theme.textMuted, marginBottom: 3 }}>{r.l}</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 700, fontFamily: FONTS.display, color: r.c }}>{r.v} F</div>
              </div>
            ))}
          </div>

          {/* Personnel */}
          {sep("Personnel")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
            <div>
              <label style={lbl}>Agent commercial *</label>
              <select required value={form.agent_commercial} onChange={e => setF("agent_commercial", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                <option value="">— Sélectionner un agent —</option>
                {formData.agents_commerciaux.map(a => (
                  <option key={a.id} value={a.id}>{a.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Techniciens</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", padding: "0.5rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, minHeight: "2.5rem" }}>
                {formData.techniciens.map(t => {
                  const selected = technicienIds.includes(t.id);
                  return (
                    <button key={t.id} type="button" onClick={() => toggleTech(t.id)}
                      style={{ padding: "2px 10px", borderRadius: RADIUS.full, border: `1px solid ${selected ? PALETTE.primary : theme.border}`, background: selected ? PALETTE.primary + "18" : "transparent", color: selected ? PALETTE.primary : theme.textMuted, fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body, transition: "all 0.15s" }}>
                      {selected ? "✓ " : ""}{t.full_name}
                    </button>
                  );
                })}
                {formData.techniciens.length === 0 && <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>Aucun technicien disponible</span>}
              </div>
            </div>
          </div>

          {/* Facture associée */}
          {sep("Facture associée")}
          <div>
            <label style={lbl}>Facture (optionnel)</label>
            <select value={form.invoice_id} onChange={e => setF("invoice_id", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              <option value="">Aucune facture</option>
              {formData.factures.map(f => (
                <option key={f.id} value={f.id}>
                  {f.invoice_number ?? `#${f.id}`} — {new Intl.NumberFormat("fr-FR").format(f.montant)} F
                  {f.date ? ` — ${f.date}` : ""}{f.client ? ` — ${f.client}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Contrat */}
          {sep("Contrat")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "start" }}>
            <div>
              <label style={lbl}>Uploader un contrat (PDF ou image)</label>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setContratFile(e.target.files?.[0] ?? null)}
                style={{ ...inp, padding: "0.45rem" }} />
              {installation?.contrat_path && (
                <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 4 }}>
                  Contrat actuel : <strong>{installation.contrat_path.split("/").pop()}</strong>
                  {installation.contrat_path.startsWith("uploads/contrats/contrat_") && (
                    <span style={{ marginLeft: 6, fontSize: "0.65rem", fontWeight: 600, padding: "1px 6px", borderRadius: RADIUS.full, background: "rgba(6,182,212,0.12)", color: PALETTE.primary }}>Auto-généré</span>
                  )}
                </div>
              )}
            </div>
            {!isEdit && (
              <div style={{ paddingTop: "1.6rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.85rem", color: theme.textSecondary }}>
                  <input type="checkbox" checked={generatePdf} onChange={e => setGeneratePdf(e.target.checked)} style={{ width: 16, height: 16 }} />
                  <span>⚡ Générer un contrat PDF automatiquement</span>
                </label>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "1.25rem", marginTop: "0.5rem", borderTop: `1px solid ${theme.border}` }}>
            <button type="button" onClick={onClose}
              style={{ padding: "0.65rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
              Annuler
            </button>
            <button type="submit" disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.65rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? "rgba(6,182,212,0.45)" : `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
              {saving
                ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> Enregistrement…</>
                : isEdit ? "Enregistrer les modifications" : "Créer l'installation"
              }
            </button>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}