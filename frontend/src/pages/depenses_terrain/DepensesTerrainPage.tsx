// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/depenses_terrain/DepensesTerrainPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import depensesTerrainService, {
  type DepenseTerrain, type DepenseStats, type Justificatif,
} from "../../services/depensesTerrainService";
import chantiersService, { type Chantier } from "../../services/chantiersService";
import { useAuthStore } from "../../store/authStore";
import { useSwal } from "../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../theme";

const fmtDate  = (s: string | null) => s ? new Date(s).toLocaleDateString("fr-FR") : "—";
const fmtMoney = (v: string | number) => Number(v).toLocaleString("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });

const TYPE_LABELS: Record<string, string> = {
  cable:      "Câble / Fil",
  puce:       "Puce / Composant",
  transport:  "Transport",
  repas:      "Repas",
  outil:      "Outil / Matériel",
  fourniture: "Fourniture",
  autre:      "Autre",
};

const STATUT_CFG = {
  en_attente: { label: "En attente",  bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
  approuvee:  { label: "Approuvée",   bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  refusee:    { label: "Refusée",     bg: "rgba(204,34,34,0.12)",   text: "#cc2222" },
  remboursee: { label: "Remboursée",  bg: "rgba(107,114,128,0.12)", text: "#6b7280" },
} as const;

function StatutBadge({ statut }: { statut: string }) {
  const cfg = STATUT_CFG[statut as keyof typeof STATUT_CFG] ?? STATUT_CFG.en_attente;
  return (
    <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "3px 9px", borderRadius: RADIUS.full, background: cfg.bg, color: cfg.text, whiteSpace: "nowrap" }}>
      {cfg.label}
    </span>
  );
}

const CSS = `
  @keyframes dt-spin { to { transform: rotate(360deg); } }
  .dt-stats { display: grid; grid-template-columns: repeat(2,1fr); gap: 0.65rem; margin-bottom: 1.5rem; }
  @media (min-width: 640px) { .dt-stats { grid-template-columns: repeat(3,1fr); gap: 0.85rem; } }
  @media (min-width: 960px) { .dt-stats { grid-template-columns: repeat(5,1fr); } }
  .dt-filters { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; align-items: center; }
  .dt-table-wrap { display: none; }
  .dt-cards-wrap { display: flex; flex-direction: column; gap: 0.65rem; }
  @media (min-width: 768px) { .dt-table-wrap { display: block; } .dt-cards-wrap { display: none; } }
  .dt-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 500; display: flex; align-items: flex-end; justify-content: center; }
  @media (min-width: 640px) { .dt-overlay { align-items: center; padding: 0.5rem; } }
  .dt-modal { width: 100%; max-height: 96vh; overflow-y: auto; border-radius: 18px 18px 0 0; }
  @media (min-width: 640px) { .dt-modal { max-width: 560px; border-radius: 18px; } }
  .dt-modal-body { padding: 1rem; }
  @media (min-width: 640px) { .dt-modal-body { padding: 1.5rem; } }
  .dt-footer { display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; border-top: 1px solid; }
  @media (min-width: 480px) { .dt-footer { flex-direction: row; justify-content: flex-end; } }
  .dt-drop-zone { border: 2px dashed; border-radius: 10px; padding: 1.25rem; text-align: center; cursor: pointer; transition: all 0.2s; }
  .dt-drop-zone:hover { opacity: 0.8; }
  .dt-justif-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 0.5rem; margin-top: 0.75rem; }
  .dt-justif-thumb { position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 1px solid; }
  .dt-justif-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .dt-justif-del { position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; border-radius: 50%; border: none; background: rgba(204,34,34,0.85); color: #fff; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
`;

// ── Modal dépense ─────────────────────────────────────────────────────────────
function DepenseModal({ theme, depense, chantiers, userId, onClose, onSaved }: {
  theme: LayoutContext["theme"];
  depense:   DepenseTerrain | null;
  chantiers: Chantier[];
  userId:    number;
  onClose:   () => void;
  onSaved:   () => void;
}) {
  const swal   = useSwal();
  const isEdit = !!depense;
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [justifs,   setJustifs]   = useState<Justificatif[]>(depense?.justificatifs ?? []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    type_depense: depense?.type_depense ?? "transport",
    description:  depense?.description ?? "",
    montant:      depense?.montant      ?? "",
    date_depense: depense?.date_depense ?? "",
    chantier_id:  depense?.chantier     ?? 0,
  });
  const setF = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.65rem 0.9rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.9rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };
  const lbl: React.CSSProperties = { fontSize: "0.8rem", fontWeight: 600, color: theme.textSecondary, marginBottom: 4, display: "block" };

  const isImage = (name: string) => /\.(jpg|jpeg|png|webp)$/i.test(name);
  const isPdf   = (name: string) => /\.pdf$/i.test(name);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    if (isEdit) {
      uploadFiles(depense!.id, arr);
    } else {
      setPendingFiles(prev => [...prev, ...arr]);
    }
  };

  const uploadFiles = async (depId: number, files: File[]) => {
    setUploading(true);
    for (const f of files) {
      try {
        const j = await depensesTerrainService.addJustificatif(depId, f);
        setJustifs(prev => [...prev, j]);
      } catch { swal.error("Erreur", `Impossible d'envoyer ${f.name}.`); }
    }
    setUploading(false);
  };

  const handleDeleteJustif = async (justif: Justificatif) => {
    if (!isEdit || !depense) return;
    try {
      await depensesTerrainService.deleteJustificatif(depense.id, justif.id);
      setJustifs(prev => prev.filter(j => j.id !== justif.id));
    } catch { swal.error("Erreur", "Impossible de supprimer le fichier."); }
  };

  const handleSave = async () => {
    if (!form.type_depense || !form.description.trim() || !form.montant || !form.date_depense) {
      swal.error("Champs obligatoires", "Type, description, montant et date sont requis."); return;
    }
    if (Number(form.montant) <= 0) {
      swal.error("Montant invalide", "Le montant doit être supérieur à 0."); return;
    }
    setSaving(true);
    try {
      const payload = {
        technicien_id: userId,
        chantier_id:   Number(form.chantier_id) || null,
        type_depense:  form.type_depense,
        description:   form.description.trim(),
        montant:       Number(form.montant),
        date_depense:  form.date_depense,
      };
      let saved: DepenseTerrain;
      if (isEdit) {
        saved = await depensesTerrainService.update(depense!.id, payload);
      } else {
        saved = await depensesTerrainService.create(payload);
        // Upload pending files after creation
        if (pendingFiles.length > 0) {
          await uploadFiles(saved.id, pendingFiles);
        }
      }
      onSaved();
      swal.success(isEdit ? "Dépense modifiée." : "Dépense soumise.");
    } catch { swal.error("Erreur", "Une erreur est survenue."); }
    finally  { setSaving(false); }
  };

  return (
    <div className="dt-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dt-modal" style={{ background: theme.cardBg }}>
        <div style={{ padding: "1.25rem 1.5rem 0.75rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: theme.textPrimary }}>
            {isEdit ? "Modifier la dépense" : "Nouvelle dépense terrain"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted, fontSize: "1.2rem" }}>✕</button>
        </div>

        <div className="dt-modal-body">
          {/* Type + Date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
            <div>
              <label style={lbl}>Type *</label>
              <select style={inp} value={form.type_depense} onChange={e => setF("type_depense", e.target.value)}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Date *</label>
              <input type="date" style={inp} value={form.date_depense} onChange={e => setF("date_depense", e.target.value)} />
            </div>
          </div>

          {/* Montant + Chantier */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
            <div>
              <label style={lbl}>Montant (FCFA) *</label>
              <input type="number" min="0" step="100" style={inp} value={form.montant} onChange={e => setF("montant", e.target.value)} placeholder="Ex: 5000" />
            </div>
            <div>
              <label style={lbl}>Chantier (optionnel)</label>
              <select style={inp} value={form.chantier_id} onChange={e => setF("chantier_id", Number(e.target.value))}>
                <option value={0}>— Aucun —</option>
                {chantiers.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={lbl}>Description *</label>
            <textarea
              style={{ ...inp, minHeight: 72, resize: "vertical" }}
              value={form.description}
              onChange={e => setF("description", e.target.value)}
              placeholder="Décrivez la dépense (ex: achat d'un câble RJ45 pour chantier Dakar Centre)…"
            />
          </div>

          {/* Justificatifs */}
          <div>
            <label style={lbl}>Justificatifs (photos, factures — JPG, PNG, PDF)</label>

            {/* Zone drop */}
            <div
              className="dt-drop-zone"
              style={{ borderColor: theme.border, color: theme.textMuted }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            >
              <div style={{ fontSize: "1.5rem", marginBottom: 4 }}>📎</div>
              <div style={{ fontSize: "0.82rem" }}>Cliquez ou glissez-déposez vos fichiers ici</div>
              <div style={{ fontSize: "0.72rem", marginTop: 2, opacity: 0.7 }}>JPG, PNG, PDF · max 10 Mo par fichier</div>
              {uploading && <div style={{ fontSize: "0.78rem", color: PALETTE.primary, marginTop: 6 }}>Envoi en cours…</div>}
            </div>
            <input
              ref={fileRef} type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.webp"
              style={{ display: "none" }}
              onChange={e => handleFiles(e.target.files)}
            />

            {/* Fichiers en attente (avant création) */}
            {!isEdit && pendingFiles.length > 0 && (
              <div style={{ marginTop: "0.75rem" }}>
                <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginBottom: 4 }}>Fichiers à envoyer après création :</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {pendingFiles.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: RADIUS.md, background: "rgba(0,175,212,0.1)", fontSize: "0.75rem", color: PALETTE.primary }}>
                      {isPdf(f.name) ? "📄" : "🖼️"} {f.name}
                      <button onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#cc2222", fontSize: "0.7rem", padding: 0 }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fichiers déjà uploadés */}
            {justifs.length > 0 && (
              <div className="dt-justif-grid">
                {justifs.map(j => (
                  <div key={j.id} className="dt-justif-thumb" style={{ borderColor: theme.border }}>
                    {isImage(j.nom) ? (
                      <img src={j.url ?? j.fichier} alt={j.nom} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.04)", fontSize: "1.8rem" }}>
                        📄
                        <span style={{ fontSize: "0.55rem", color: theme.textMuted, marginTop: 2, textAlign: "center", padding: "0 2px" }}>{j.nom}</span>
                      </div>
                    )}
                    {isEdit && (
                      <button className="dt-justif-del" onClick={() => handleDeleteJustif(j)}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="dt-footer" style={{ borderTopColor: theme.border }}>
          <button onClick={onClose} style={{ padding: "0.6rem 1.2rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textPrimary, cursor: "pointer", fontFamily: FONTS.body }}>
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "0.6rem 1.4rem", borderRadius: RADIUS.md, border: "none", background: PALETTE.primary, color: "#fff", cursor: "pointer", fontWeight: 600, fontFamily: FONTS.body, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Enregistrement…" : isEdit ? "Modifier" : "Soumettre"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal refus (avec note) ────────────────────────────────────────────────────
function RefusModal({ theme, onClose, onConfirm }: {
  theme: LayoutContext["theme"]; onClose: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const inp: React.CSSProperties = { width: "100%", padding: "0.65rem 0.9rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.9rem", fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" as const };
  return (
    <div className="dt-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dt-modal" style={{ background: theme.cardBg, maxWidth: 420 }}>
        <div style={{ padding: "1.25rem 1.5rem 0.75rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "#cc2222" }}>Refuser la dépense</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted, fontSize: "1.2rem" }}>✕</button>
        </div>
        <div className="dt-modal-body">
          <label style={{ fontSize: "0.8rem", fontWeight: 600, color: theme.textSecondary, marginBottom: 4, display: "block" }}>Motif du refus (optionnel)</label>
          <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Expliquez pourquoi la dépense est refusée…" />
        </div>
        <div className="dt-footer" style={{ borderTopColor: theme.border }}>
          <button onClick={onClose} style={{ padding: "0.6rem 1.2rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textPrimary, cursor: "pointer", fontFamily: FONTS.body }}>Annuler</button>
          <button onClick={() => onConfirm(notes)} style={{ padding: "0.6rem 1.4rem", borderRadius: RADIUS.md, border: "none", background: "#cc2222", color: "#fff", cursor: "pointer", fontWeight: 600, fontFamily: FONTS.body }}>Refuser</button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function DepensesTerrainPage() {
  const { theme } = useOutletContext<LayoutContext>();
  const { user }  = useAuthStore();
  const swal      = useSwal();

  const isAdmin   = user?.permissions?.includes("all") || user?.is_staff;
  const canManage = isAdmin
    || (user?.role ?? "").toLowerCase().includes("responsable")
    || user?.permissions?.includes("depenses_terrain");

  const [depenses,     setDepenses]     = useState<DepenseTerrain[]>([]);
  const [chantiers,    setChantiers]    = useState<Chantier[]>([]);
  const [stats,        setStats]        = useState<DepenseStats>({ total: 0, en_attente: 0, approuvees: 0, refusees: 0, remboursees: 0, montant_total: 0 });
  const [loading,      setLoading]      = useState(false);
  const [filterStatut, setFilterStatut] = useState("");
  const [filterType,   setFilterType]   = useState("");
  const [modal,        setModal]        = useState<DepenseTerrain | "create" | null>(null);
  const [refusModal,   setRefusModal]   = useState<DepenseTerrain | null>(null);
  const [detail,       setDetail]       = useState<DepenseTerrain | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p: Record<string, string> = {};
      if (filterStatut) p.statut       = filterStatut;
      if (filterType)   p.type_depense = filterType;
      const [res, st] = await Promise.all([
        depensesTerrainService.list(p),
        depensesTerrainService.stats(p),
      ]);
      setDepenses(res.results);
      setStats(st);
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, [filterStatut, filterType]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    chantiersService.list().then(r => setChantiers(r.results)).catch(() => {});
  }, []);

  const handleApprouver = async (d: DepenseTerrain) => {
    try {
      await depensesTerrainService.approuver(d.id);
      load();
      swal.success("Dépense approuvée.");
    } catch { swal.error("Erreur", "Impossible d'approuver."); }
  };

  const handleRefuser = async (notes: string) => {
    if (!refusModal) return;
    try {
      await depensesTerrainService.refuser(refusModal.id, notes);
      setRefusModal(null);
      load();
      swal.info("Dépense refusée.");
    } catch { swal.error("Erreur", "Une erreur est survenue."); }
  };

  const handleRembourser = async (d: DepenseTerrain) => {
    const ok = await swal.confirm({ title: "Marquer comme remboursée ?", confirmText: "Rembourser" });
    if (!ok) return;
    try {
      await depensesTerrainService.rembourser(d.id);
      load();
      swal.success("Dépense marquée remboursée.");
    } catch { swal.error("Erreur", "Une erreur est survenue."); }
  };

  const handleDelete = async (d: DepenseTerrain) => {
    const ok = await swal.confirmDelete(`la dépense "${d.type_display}" du ${fmtDate(d.date_depense)}`);
    if (!ok) return;
    try {
      await depensesTerrainService.delete(d.id);
      load();
      swal.success("Dépense supprimée.");
    } catch { swal.error("Erreur", "Impossible de supprimer."); }
  };

  const card: React.CSSProperties = { background: theme.cardBg, borderRadius: RADIUS.lg, border: `1px solid ${theme.border}`, padding: "1rem 1.25rem" };
  const btn:  React.CSSProperties = { padding: "0.6rem 1.25rem", borderRadius: RADIUS.md, border: "none", background: PALETTE.primary, color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, fontSize: "0.88rem" };
  const sBtn  = (color: string, border: string): React.CSSProperties => ({ fontSize: "0.72rem", padding: "3px 9px", borderRadius: RADIUS.md, border: `1px solid ${border}`, background: "transparent", color, cursor: "pointer" });

  const isImage = (name: string) => /\.(jpg|jpeg|png|webp)$/i.test(name);

  return (
    <>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap" as const, gap: "0.75rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: theme.textPrimary }}>
            {canManage ? "Dépenses terrain" : "Mes dépenses terrain"}
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: theme.textMuted }}>
            {canManage ? "Suivi et validation des dépenses des techniciens" : "Soumettez vos achats et frais avec justificatifs"}
          </p>
        </div>
        <button style={btn} onClick={() => setModal("create")}>+ Nouvelle dépense</button>
      </div>

      {/* Stats */}
      <div className="dt-stats">
        {[
          { label: "En attente",   value: stats.en_attente,  color: "#f59e0b"       },
          { label: "Approuvées",   value: stats.approuvees,  color: "#10b981"       },
          { label: "Remboursées",  value: stats.remboursees, color: "#6b7280"       },
          { label: "Refusées",     value: stats.refusees,    color: "#cc2222"       },
          { label: "Montant total", value: fmtMoney(stats.montant_total), color: PALETTE.primary, wide: true },
        ].map(s => (
          <div key={s.label} style={{ ...card, textAlign: "center" as const }}>
            <div style={{ fontSize: typeof s.value === "string" ? "1rem" : "1.6rem", fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="dt-filters">
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          style={{ padding: "0.6rem 0.9rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.88rem", fontFamily: FONTS.body, outline: "none" }}>
          <option value="">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="approuvee">Approuvée</option>
          <option value="refusee">Refusée</option>
          <option value="remboursee">Remboursée</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ padding: "0.6rem 0.9rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.88rem", fontFamily: FONTS.body, outline: "none" }}>
          <option value="">Tous les types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Table desktop */}
      <div className="dt-table-wrap" style={{ ...card, padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid ${theme.border}`, borderTopColor: PALETTE.primary, animation: "dt-spin 0.8s linear infinite" }} />
          </div>
        ) : depenses.length === 0 ? (
          <div style={{ textAlign: "center" as const, padding: "3rem", color: theme.textMuted }}>Aucune dépense.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {(canManage ? ["Technicien", "Type", "Description", "Montant", "Date", "Justif.", "Statut", "Actions"] : ["Type", "Description", "Montant", "Date", "Justif.", "Statut", "Actions"]).map(h => (
                  <th key={h} style={{ padding: "0.8rem 1rem", textAlign: "left" as const, fontSize: "0.72rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.05em", whiteSpace: "nowrap" as const }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {depenses.map((d, i) => (
                <tr key={d.id} style={{ borderBottom: i < depenses.length - 1 ? `1px solid ${theme.border}` : "none" }}>
                  {canManage && (
                    <td style={{ padding: "0.8rem 1rem", fontSize: "0.82rem", color: theme.textSecondary, whiteSpace: "nowrap" as const }}>
                      {d.technicien_detail.full_name}
                    </td>
                  )}
                  <td style={{ padding: "0.8rem 1rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: "rgba(0,175,212,0.1)", color: PALETTE.primary }}>
                      {d.type_display}
                    </span>
                  </td>
                  <td style={{ padding: "0.8rem 1rem", fontSize: "0.82rem", color: theme.textPrimary, maxWidth: 200 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }} title={d.description}>{d.description}</div>
                    {d.chantier_nom && <div style={{ fontSize: "0.7rem", color: theme.textMuted, marginTop: 1 }}>Chantier: {d.chantier_nom}</div>}
                  </td>
                  <td style={{ padding: "0.8rem 1rem", fontWeight: 700, color: theme.textPrimary, whiteSpace: "nowrap" as const }}>{fmtMoney(d.montant)}</td>
                  <td style={{ padding: "0.8rem 1rem", fontSize: "0.82rem", color: theme.textSecondary, whiteSpace: "nowrap" as const }}>{fmtDate(d.date_depense)}</td>
                  <td style={{ padding: "0.8rem 1rem", textAlign: "center" as const }}>
                    {d.justificatifs.length > 0 ? (
                      <button onClick={() => setDetail(d)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: PALETTE.primary, textDecoration: "underline" }}>
                        {d.justificatifs.length} fichier{d.justificatifs.length > 1 ? "s" : ""}
                      </button>
                    ) : (
                      <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "0.8rem 1rem" }}><StatutBadge statut={d.statut} /></td>
                  <td style={{ padding: "0.8rem 1rem" }}>
                    <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" as const }}>
                      {canManage && d.statut === "en_attente" && (
                        <>
                          <button onClick={() => handleApprouver(d)} style={sBtn("#10b981", "rgba(16,185,129,0.3)")}>Approuver</button>
                          <button onClick={() => setRefusModal(d)}   style={sBtn("#cc2222", "rgba(204,34,34,0.3)")}>Refuser</button>
                        </>
                      )}
                      {canManage && d.statut === "approuvee" && (
                        <button onClick={() => handleRembourser(d)} style={sBtn("#6b7280", theme.border)}>Rembourser</button>
                      )}
                      {d.statut === "en_attente" && (
                        <button onClick={() => setModal(d)} style={sBtn(PALETTE.primary, theme.border)}>Modifier</button>
                      )}
                      {(d.statut === "en_attente" || d.statut === "refusee") && (
                        <button onClick={() => handleDelete(d)} style={sBtn("#cc2222", "rgba(204,34,34,0.3)")}>Suppr.</button>
                      )}
                      {d.notes_admin && (
                        <button onClick={() => swal.info(`Motif : ${d.notes_admin}`)} style={sBtn("#f59e0b", "rgba(245,158,11,0.3)")}>Note</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Cards mobile */}
      <div className="dt-cards-wrap">
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: `3px solid ${theme.border}`, borderTopColor: PALETTE.primary, animation: "dt-spin 0.8s linear infinite" }} />
          </div>
        ) : depenses.length === 0 ? (
          <div style={{ textAlign: "center" as const, padding: "2rem", color: theme.textMuted }}>Aucune dépense.</div>
        ) : (
          depenses.map(d => (
            <div key={d.id} style={{ ...card, display: "flex", flexDirection: "column" as const, gap: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  {canManage && <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginBottom: 2 }}>{d.technicien_detail.full_name}</div>}
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: "rgba(0,175,212,0.1)", color: PALETTE.primary }}>{d.type_display}</span>
                </div>
                <StatutBadge statut={d.statut} />
              </div>
              <div style={{ fontSize: "0.82rem", color: theme.textPrimary }}>{d.description}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: theme.textPrimary }}>{fmtMoney(d.montant)}</span>
                <span style={{ fontSize: "0.75rem", color: theme.textMuted }}>{fmtDate(d.date_depense)}</span>
              </div>
              {d.justificatifs.length > 0 && (
                <button onClick={() => setDetail(d)} style={{ background: "none", border: `1px solid ${theme.border}`, borderRadius: RADIUS.md, padding: "0.35rem 0.75rem", cursor: "pointer", fontSize: "0.75rem", color: PALETTE.primary, textAlign: "left" as const }}>
                  📎 {d.justificatifs.length} justificatif{d.justificatifs.length > 1 ? "s" : ""}
                </button>
              )}
              {d.notes_admin && (
                <div style={{ fontSize: "0.75rem", padding: "0.4rem 0.6rem", borderRadius: RADIUS.md, background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                  Note : {d.notes_admin}
                </div>
              )}
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" as const }}>
                {canManage && d.statut === "en_attente" && (
                  <>
                    <button onClick={() => handleApprouver(d)} style={sBtn("#10b981", "rgba(16,185,129,0.3)")}>Approuver</button>
                    <button onClick={() => setRefusModal(d)}   style={sBtn("#cc2222", "rgba(204,34,34,0.3)")}>Refuser</button>
                  </>
                )}
                {canManage && d.statut === "approuvee" && (
                  <button onClick={() => handleRembourser(d)} style={sBtn("#6b7280", theme.border)}>Rembourser</button>
                )}
                {d.statut === "en_attente" && (
                  <button onClick={() => setModal(d)} style={sBtn(PALETTE.primary, theme.border)}>Modifier</button>
                )}
                {(d.statut === "en_attente" || d.statut === "refusee") && (
                  <button onClick={() => handleDelete(d)} style={sBtn("#cc2222", "rgba(204,34,34,0.3)")}>Supprimer</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal détail justificatifs */}
      {detail && (
        <div className="dt-overlay" onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div className="dt-modal" style={{ background: theme.cardBg, maxWidth: 480 }}>
            <div style={{ padding: "1.25rem 1.5rem 0.75rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: "1rem", color: theme.textPrimary }}>Justificatifs</span>
              <button onClick={() => setDetail(null)} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted, fontSize: "1.2rem" }}>✕</button>
            </div>
            <div className="dt-modal-body">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.75rem" }}>
                {detail.justificatifs.map(j => (
                  <a key={j.id} href={j.url ?? j.fichier} target="_blank" rel="noreferrer"
                    style={{ display: "block", borderRadius: 10, overflow: "hidden", border: `1px solid ${theme.border}`, textDecoration: "none" }}>
                    {isImage(j.nom) ? (
                      <img src={j.url ?? j.fichier} alt={j.nom} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                    ) : (
                      <div style={{ aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.04)", fontSize: "2.5rem" }}>
                        📄
                        <span style={{ fontSize: "0.65rem", color: theme.textMuted, marginTop: 4, textAlign: "center", padding: "0 4px" }}>{j.nom}</span>
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal création/édition */}
      {modal !== null && user && (
        <DepenseModal
          theme={theme}
          depense={modal === "create" ? null : modal}
          chantiers={chantiers}
          userId={user.id}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}

      {/* Modal refus */}
      {refusModal && (
        <RefusModal
          theme={theme}
          onClose={() => setRefusModal(null)}
          onConfirm={handleRefuser}
        />
      )}
    </>
  );
}
