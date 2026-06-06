// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/outillage/OutillagePage.tsx
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import outillageService, {
  type Outil, type ReservationOutil, type ReservationStats,
} from "../../services/outillageService";
import chantiersService, { type Chantier } from "../../services/chantiersService";
import { useAuthStore } from "../../store/authStore";
import { useSwal } from "../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../theme";

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("fr-FR") : "—";

const STATUT_RESA = {
  en_attente:    { label: "En attente",          bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
  approuvee:     { label: "Approuvée",           bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  refusee:       { label: "Refusée",             bg: "rgba(204,34,34,0.12)",   text: "#cc2222" },
  remis:         { label: "Remis au technicien", bg: "rgba(6,182,212,0.12)",   text: "#06b6d4" },
  en_cours:      { label: "En cours",            bg: "rgba(0,119,182,0.12)",   text: "#0077b6" },
  retour_declare:{ label: "Retour déclaré",      bg: "rgba(139,92,246,0.12)",  text: "#8b5cf6" },
  retournee:     { label: "Retournée",           bg: "rgba(107,114,128,0.12)", text: "#6b7280" },
} as const;

const CATEGORIE_LABELS: Record<string, string> = {
  perceuse:  "Perceuse",
  viseuse:   "Viseuse",
  tournevis: "Tournevis",
  marteau:   "Marteau",
  niveau:    "Niveau",
  echelle:   "Échelle",
  cable:     "Câble / Rallonge",
  testeur:   "Testeur / Multimètre",
  autre:     "Autre",
};

function StatutBadge({ statut }: { statut: string }) {
  const cfg = STATUT_RESA[statut as keyof typeof STATUT_RESA] ?? STATUT_RESA.en_attente;
  return (
    <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "3px 9px", borderRadius: RADIUS.full, background: cfg.bg, color: cfg.text, whiteSpace: "nowrap" }}>
      {cfg.label}
    </span>
  );
}

const CSS = `
  @keyframes ou-spin { to { transform: rotate(360deg); } }
  .ou-tabs { display: flex; gap: 0; border-bottom: 2px solid; margin-bottom: 1.5rem; }
  .ou-tab { padding: 0.55rem 1.1rem; cursor: pointer; font-size: 0.88rem; border: none; background: none; border-bottom: 3px solid transparent; margin-bottom: -2px; }
  .ou-stats { display: grid; grid-template-columns: repeat(2,1fr); gap: 0.65rem; margin-bottom: 1.5rem; }
  @media (min-width: 640px) { .ou-stats { grid-template-columns: repeat(3,1fr); gap: 0.85rem; } }
  .ou-filters { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; align-items: center; }
  .ou-search { position: relative; flex: 1 1 180px; min-width: 150px; }
  .ou-table-wrap { display: none; }
  .ou-cards-wrap { display: flex; flex-direction: column; gap: 0.65rem; }
  @media (min-width: 768px) { .ou-table-wrap { display: block; } .ou-cards-wrap { display: none; } }
  .ou-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 500; display: flex; align-items: flex-end; justify-content: center; }
  @media (min-width: 640px) { .ou-overlay { align-items: center; padding: 0.5rem; } }
  .ou-modal { width: 100%; max-height: 96vh; overflow-y: auto; border-radius: 18px 18px 0 0; }
  @media (min-width: 640px) { .ou-modal { max-width: 520px; border-radius: 18px; } }
  .ou-modal-body { padding: 1rem; }
  @media (min-width: 640px) { .ou-modal-body { padding: 1.5rem; } }
  .ou-footer { display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; border-top: 1px solid; }
  @media (min-width: 480px) { .ou-footer { flex-direction: row; justify-content: flex-end; } }
`;

// ── Modal Outil ────────────────────────────────────────────────────────────────
function OutilModal({ theme, outil, onClose, onSaved }: {
  theme: LayoutContext["theme"]; outil: Outil | null;
  onClose: () => void; onSaved: () => void;
}) {
  const swal   = useSwal();
  const [saving, setSaving] = useState(false);
  const isEdit = !!outil;
  const [form, setForm] = useState({
    nom:             outil?.nom ?? "",
    categorie:       outil?.categorie ?? "autre",
    description:     outil?.description ?? "",
    quantite_totale: outil?.quantite_totale ?? 1,
    numero_serie:    outil?.numero_serie ?? "",
  });
  const setF = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const inp: React.CSSProperties = {
    width: "100%", padding: "0.65rem 0.9rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.9rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };
  const lbl: React.CSSProperties = { fontSize: "0.8rem", fontWeight: 600, color: theme.textSecondary, marginBottom: 4, display: "block" };

  const handleSave = async () => {
    if (!form.nom.trim()) { swal.error("Champ obligatoire", "Le nom est obligatoire."); return; }
    setSaving(true);
    try {
      const payload = { ...form, quantite_totale: Number(form.quantite_totale), numero_serie: form.numero_serie || undefined, description: form.description || undefined };
      if (isEdit) await outillageService.updateOutil(outil!.id, payload);
      else        await outillageService.createOutil(payload);
      onSaved();
      swal.success(isEdit ? "Outil modifié." : "Outil créé.");
    } catch { swal.error("Erreur", "Une erreur est survenue."); }
    finally   { setSaving(false); }
  };

  return (
    <div className="ou-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ou-modal" style={{ background: theme.cardBg }}>
        <div style={{ padding: "1.25rem 1.5rem 0.75rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: theme.textPrimary }}>{isEdit ? "Modifier l'outil" : "Nouvel outil"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted, fontSize: "1.2rem" }}>✕</button>
        </div>
        <div className="ou-modal-body">
          <div style={{ marginBottom: "1rem" }}>
            <label style={lbl}>Nom *</label>
            <input style={inp} value={form.nom} onChange={e => setF("nom", e.target.value)} placeholder="Ex: Perceuse Bosch" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
            <div>
              <label style={lbl}>Catégorie</label>
              <select style={inp} value={form.categorie} onChange={e => setF("categorie", e.target.value)}>
                {Object.entries(CATEGORIE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Quantité totale</label>
              <input type="number" min="1" style={inp} value={form.quantite_totale} onChange={e => setF("quantite_totale", e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={lbl}>N° de série</label>
            <input style={inp} value={form.numero_serie} onChange={e => setF("numero_serie", e.target.value)} placeholder="Optionnel" />
          </div>
          <div>
            <label style={lbl}>Description</label>
            <textarea style={{ ...inp, minHeight: 64, resize: "vertical" }} value={form.description} onChange={e => setF("description", e.target.value)} placeholder="Description de l'outil…" />
          </div>
        </div>
        <div className="ou-footer" style={{ borderTopColor: theme.border }}>
          <button onClick={onClose} style={{ padding: "0.6rem 1.2rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textPrimary, cursor: "pointer", fontFamily: FONTS.body }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "0.6rem 1.4rem", borderRadius: RADIUS.md, border: "none", background: PALETTE.primary, color: "#fff", cursor: "pointer", fontWeight: 600, fontFamily: FONTS.body, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Enregistrement…" : isEdit ? "Modifier" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Quantité ────────────────────────────────────────────────────────────
function QuantiteModal({ theme, outil, onClose, onSaved }: {
  theme: LayoutContext["theme"]; outil: Outil;
  onClose: () => void; onSaved: () => void;
}) {
  const swal   = useSwal();
  const [ajout, setAjout] = useState(1);
  const [saving, setSaving] = useState(false);
  const inp: React.CSSProperties = {
    width: "100%", padding: "0.65rem 0.9rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.9rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };
  const lbl: React.CSSProperties = { fontSize: "0.8rem", fontWeight: 600, color: theme.textSecondary, marginBottom: 4, display: "block" };

  const handleSave = async () => {
    if (Number(ajout) < 1) { swal.error("Valeur invalide", "La quantité à ajouter doit être au moins 1."); return; }
    setSaving(true);
    try {
      const newQty = outil.quantite_totale + Number(ajout);
      await outillageService.updateOutil(outil.id, { quantite_totale: newQty });
      onSaved();
      swal.success(`Quantité mise à jour : ${newQty} au total.`);
    } catch { swal.error("Erreur", "Impossible de mettre à jour."); }
    finally { setSaving(false); }
  };

  return (
    <div className="ou-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ou-modal" style={{ background: theme.cardBg, maxWidth: 380 }}>
        <div style={{ padding: "1.25rem 1.5rem 0.75rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: theme.textPrimary }}>Augmenter la quantité</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted, fontSize: "1.2rem" }}>✕</button>
        </div>
        <div className="ou-modal-body">
          <div style={{ marginBottom: "1rem", padding: "0.75rem", borderRadius: RADIUS.md, background: theme.inputBg, border: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: "0.8rem", color: theme.textMuted }}>Outil</div>
            <div style={{ fontWeight: 600, color: theme.textPrimary }}>{outil.nom}</div>
            <div style={{ fontSize: "0.78rem", color: theme.textSecondary, marginTop: 2 }}>
              Quantité actuelle : <strong>{outil.quantite_totale}</strong>
            </div>
          </div>
          <div>
            <label style={lbl}>Quantité à ajouter *</label>
            <input type="number" min="1" style={inp} value={ajout} onChange={e => setAjout(Number(e.target.value))} />
            {Number(ajout) >= 1 && (
              <div style={{ fontSize: "0.78rem", color: "#10b981", marginTop: 4 }}>
                Nouvelle quantité totale : <strong>{outil.quantite_totale + Number(ajout)}</strong>
              </div>
            )}
          </div>
        </div>
        <div className="ou-footer" style={{ borderTopColor: theme.border }}>
          <button onClick={onClose} style={{ padding: "0.6rem 1.2rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textPrimary, cursor: "pointer", fontFamily: FONTS.body }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "0.6rem 1.4rem", borderRadius: RADIUS.md, border: "none", background: "#10b981", color: "#fff", cursor: "pointer", fontWeight: 600, fontFamily: FONTS.body, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Enregistrement…" : "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Réservation ──────────────────────────────────────────────────────────
function ReservationModal({ theme, outils, chantiers, userId, onClose, onSaved }: {
  theme: LayoutContext["theme"]; outils: Outil[]; chantiers: Chantier[]; userId: number;
  onClose: () => void; onSaved: () => void;
}) {
  const swal   = useSwal();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    outil_id:    outils[0]?.id ?? 0,
    chantier_id: 0,
    date_debut:  "",
    heure_debut: "",
    date_fin:    "",
    heure_fin:   "",
    quantite:    1,
    notes:       "",
  });
  const setF = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const inp: React.CSSProperties = {
    width: "100%", padding: "0.65rem 0.9rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.9rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };
  const lbl: React.CSSProperties = { fontSize: "0.8rem", fontWeight: 600, color: theme.textSecondary, marginBottom: 4, display: "block" };

  const handleSave = async () => {
    if (!form.outil_id || !form.date_debut || !form.date_fin) {
      swal.error("Champs obligatoires", "Outil, date début et date fin sont requis."); return;
    }
    setSaving(true);
    try {
      await outillageService.createReservation({
        outil_id:      form.outil_id,
        technicien_id: userId,
        chantier_id:   form.chantier_id || null,
        date_debut:    form.date_debut,
        heure_debut:   form.heure_debut || null,
        date_fin:      form.date_fin,
        heure_fin:     form.heure_fin || null,
        quantite:      Number(form.quantite),
        notes:         form.notes || undefined,
      });
      onSaved();
      swal.success("Réservation créée.");
    } catch { swal.error("Erreur", "Une erreur est survenue."); }
    finally   { setSaving(false); }
  };

  return (
    <div className="ou-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ou-modal" style={{ background: theme.cardBg }}>
        <div style={{ padding: "1.25rem 1.5rem 0.75rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: theme.textPrimary }}>Nouvelle réservation</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted, fontSize: "1.2rem" }}>✕</button>
        </div>
        <div className="ou-modal-body">
          <div style={{ marginBottom: "1rem" }}>
            <label style={lbl}>Outil *</label>
            <select style={inp} value={form.outil_id} onChange={e => setF("outil_id", Number(e.target.value))}>
              {outils.map(o => <option key={o.id} value={o.id}>{o.nom} ({o.categorie_display}) — {o.quantite_disponible} dispo.</option>)}
            </select>
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={lbl}>Chantier (optionnel)</label>
            <select style={inp} value={form.chantier_id} onChange={e => setF("chantier_id", Number(e.target.value))}>
              <option value={0}>— Aucun chantier —</option>
              {chantiers.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
            <div>
              <label style={lbl}>Date de début *</label>
              <input type="date" style={inp} value={form.date_debut} onChange={e => setF("date_debut", e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Heure de début</label>
              <input type="time" style={inp} value={form.heure_debut} onChange={e => setF("heure_debut", e.target.value)} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
            <div>
              <label style={lbl}>Date de fin *</label>
              <input type="date" style={inp} value={form.date_fin} onChange={e => setF("date_fin", e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Heure de fin</label>
              <input type="time" style={inp} value={form.heure_fin} onChange={e => setF("heure_fin", e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={lbl}>Quantité</label>
            <input type="number" min="1" style={inp} value={form.quantite} onChange={e => setF("quantite", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Notes</label>
            <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder="Précisions optionnelles…" />
          </div>
        </div>
        <div className="ou-footer" style={{ borderTopColor: theme.border }}>
          <button onClick={onClose} style={{ padding: "0.6rem 1.2rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textPrimary, cursor: "pointer", fontFamily: FONTS.body }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "0.6rem 1.4rem", borderRadius: RADIUS.md, border: "none", background: PALETTE.primary, color: "#fff", cursor: "pointer", fontWeight: 600, fontFamily: FONTS.body, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Enregistrement…" : "Réserver"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function OutillagePage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const { user } = useAuthStore();
  const swal     = useSwal();

  const isAdmin    = user?.permissions?.includes("all") || user?.is_staff;
  const canManage  = isAdmin
    || (user?.role ?? "").toLowerCase().includes("responsable")
    || user?.permissions?.includes("outillage");

  // Les techniciens démarrent directement sur l'onglet Réservations
  const [tab,           setTab]           = useState<"outils" | "reservations">(canManage ? "outils" : "reservations");
  const [outils,        setOutils]        = useState<Outil[]>([]);
  const [reservations,  setReservations]  = useState<ReservationOutil[]>([]);
  const [chantiers,     setChantiers]     = useState<Chantier[]>([]);
  const [stats,         setStats]         = useState<ReservationStats>({ total: 0, en_attente: 0, approuvees: 0, en_cours: 0, retournees: 0, refusees: 0 });
  const [loading,       setLoading]       = useState(false);
  const [filterStatut,  setFilterStatut]  = useState("");
  const [filterCat,     setFilterCat]     = useState("");
  const [showInactive,  setShowInactive]  = useState(false);
  const [outilModal,    setOutilModal]    = useState<Outil | "create" | null>(null);
  const [quantiteModal, setQuantiteModal] = useState<Outil | null>(null);
  const [resaModal,     setResaModal]     = useState(false);

  const loadOutils = useCallback(async () => {
    setLoading(true);
    try {
      const p: Record<string, string> = {};
      if (filterCat)    p.categorie = filterCat;
      if (!showInactive) p.is_active = "true";
      const res = await outillageService.listOutils(p);
      setOutils(res.results);
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, [filterCat, showInactive]);

  const loadReservations = useCallback(async () => {
    setLoading(true);
    try {
      const p: Record<string, string> = {};
      if (filterStatut) p.statut = filterStatut;
      const [res, st] = await Promise.all([
        outillageService.listReservations(p),
        outillageService.statsReservations(),
      ]);
      setReservations(res.results);
      setStats(st);
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, [filterStatut]);

  // Les outils sont toujours chargés (nécessaire pour le modal de réservation)
  useEffect(() => { loadOutils(); }, [loadOutils]);

  // Les réservations ne sont chargées que sur l'onglet correspondant
  useEffect(() => {
    if (tab === "reservations") loadReservations();
  }, [tab, loadReservations]);

  useEffect(() => {
    chantiersService.list().then(r => setChantiers(r.results)).catch(() => {});
  }, []);

  const handleApprouver = async (id: number) => {
    try {
      await outillageService.approuver(id);
      loadReservations();
      swal.success("Réservation approuvée.");
    } catch { swal.error("Erreur", "Impossible d'approuver."); }
  };

  const handleRefuser = async (id: number) => {
    const ok = await swal.confirm({ title: "Refuser cette réservation ?", danger: true, confirmText: "Refuser" });
    if (!ok) return;
    try {
      await outillageService.refuser(id);
      loadReservations();
      swal.info("Réservation refusée.");
    } catch { swal.error("Erreur", "Une erreur est survenue."); }
  };

  const handleRetourner = async (id: number) => {
    try {
      await outillageService.retourner(id);
      loadReservations();
      swal.success("Retour déclaré. En attente de confirmation du responsable.");
    } catch { swal.error("Erreur", "Une erreur est survenue."); }
  };

  const handleRemettre = async (id: number) => {
    try {
      await outillageService.remettre(id);
      loadReservations();
      swal.success("Matériel marqué comme remis au technicien.");
    } catch { swal.error("Erreur", "Une erreur est survenue."); }
  };

  const handleConfirmerReception = async (id: number) => {
    try {
      await outillageService.confirmerReception(id);
      loadReservations();
      swal.success("Réception confirmée — matériel en cours d'utilisation.");
    } catch { swal.error("Erreur", "Une erreur est survenue."); }
  };

  const handleConfirmerRetour = async (id: number) => {
    try {
      await outillageService.confirmerRetour(id);
      loadReservations();
      swal.success("Retour confirmé — outil remis en stock.");
    } catch { swal.error("Erreur", "Une erreur est survenue."); }
  };

  const handleToggleActive = async (o: Outil) => {
    const desactiver = o.is_active;
    const ok = await swal.confirm({
      title: desactiver ? `Désactiver "${o.nom}" ?` : `Réactiver "${o.nom}" ?`,
      text: desactiver ? "L'outil sera marqué hors service (panne ou perte)." : "L'outil sera remis en service.",
      confirmText: desactiver ? "Désactiver" : "Réactiver",
      danger: desactiver,
    });
    if (!ok) return;
    try {
      await outillageService.updateOutil(o.id, { is_active: !o.is_active });
      loadOutils();
      if (desactiver) swal.info("Outil désactivé.");
      else            swal.success("Outil réactivé.");
    } catch { swal.error("Erreur", "Impossible de modifier l'état de l'outil."); }
  };

  const card: React.CSSProperties = { background: theme.cardBg, borderRadius: RADIUS.lg, border: `1px solid ${theme.border}`, padding: "1rem 1.25rem" };
  const btn: React.CSSProperties  = { padding: "0.6rem 1.25rem", borderRadius: RADIUS.md, border: "none", background: PALETTE.primary, color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, fontSize: "0.88rem" };
  const smallBtn = (color: string, border: string): React.CSSProperties => ({ fontSize: "0.72rem", padding: "3px 9px", borderRadius: RADIUS.md, border: `1px solid ${border}`, background: "transparent", color, cursor: "pointer" });

  return (
    <>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap" as const, gap: "0.75rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: theme.textPrimary }}>
            {canManage ? "Outillage" : "Mes réservations d'outils"}
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: theme.textMuted }}>
            {canManage ? "Gestion des outils et des réservations des techniciens" : "Réservez et suivez l'état de vos demandes d'outils"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {canManage && tab === "outils" && (
            <button style={btn} onClick={() => setOutilModal("create")}>+ Nouvel outil</button>
          )}
          {tab === "reservations" && (
            <button style={btn} onClick={() => setResaModal(true)}>+ Réserver un outil</button>
          )}
        </div>
      </div>

      {/* Stats réservations */}
      {tab === "reservations" && (
        <div className="ou-stats">
          {[
            { label: "En attente", value: stats.en_attente, color: "#f59e0b" },
            { label: "Approuvées", value: stats.approuvees, color: "#10b981" },
            { label: "En cours",   value: stats.en_cours,   color: "#0077b6" },
          ].map(s => (
            <div key={s.label} style={{ ...card, textAlign: "center" as const }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs — l'onglet Outils est masqué pour les techniciens */}
      <div className="ou-tabs" style={{ borderBottomColor: theme.border }}>
        {(["outils", "reservations"] as const)
          .filter(t => canManage || t === "reservations")
          .map(t => (
            <button key={t} className="ou-tab"
              onClick={() => setTab(t)}
              style={{
                color: tab === t ? PALETTE.primary : theme.textMuted,
                borderBottomColor: tab === t ? PALETTE.primary : "transparent",
                fontWeight: tab === t ? 700 : 400,
                fontFamily: FONTS.body,
              }}>
              {t === "outils" ? "Outils" : "Mes réservations"}
            </button>
          ))}
      </div>

      {/* ── Onglet Outils ── */}
      {tab === "outils" && (
        <>
          <div className="ou-filters">
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              style={{ padding: "0.6rem 0.9rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.88rem", fontFamily: FONTS.body, outline: "none" }}>
              <option value="">Toutes catégories</option>
              {Object.entries(CATEGORIE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button
              onClick={() => setShowInactive(v => !v)}
              style={{ padding: "0.55rem 1rem", borderRadius: RADIUS.md, border: `1px solid ${showInactive ? "#f59e0b" : theme.border}`, background: showInactive ? "rgba(245,158,11,0.1)" : "transparent", color: showInactive ? "#f59e0b" : theme.textMuted, cursor: "pointer", fontSize: "0.82rem", fontFamily: FONTS.body }}>
              {showInactive ? "Masquer les inactifs" : "Afficher les inactifs"}
            </button>
          </div>

          {/* Table desktop */}
          <div className="ou-table-wrap" style={{ ...card, padding: 0, overflow: "hidden" }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid ${theme.border}`, borderTopColor: PALETTE.primary, animation: "ou-spin 0.8s linear infinite" }} />
              </div>
            ) : outils.length === 0 ? (
              <div style={{ textAlign: "center" as const, padding: "3rem", color: theme.textMuted }}>Aucun outil.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {["Nom", "Catégorie", "Qté totale", "Disponible", "N° série", "État", "Actions"].map(h => (
                      <th key={h} style={{ padding: "0.8rem 1rem", textAlign: "left" as const, fontSize: "0.72rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {outils.map((o, i) => (
                    <tr key={o.id} style={{ borderBottom: i < outils.length - 1 ? `1px solid ${theme.border}` : "none", opacity: o.is_active ? 1 : 0.55 }}>
                      <td style={{ padding: "0.8rem 1rem", fontWeight: 600, color: theme.textPrimary, fontSize: "0.88rem" }}>{o.nom}</td>
                      <td style={{ padding: "0.8rem 1rem", fontSize: "0.82rem", color: theme.textSecondary }}>{o.categorie_display}</td>
                      <td style={{ padding: "0.8rem 1rem", fontSize: "0.82rem", color: theme.textSecondary, textAlign: "center" as const }}>{o.quantite_totale}</td>
                      <td style={{ padding: "0.8rem 1rem", textAlign: "center" as const }}>
                        <span style={{
                          fontSize: "0.8rem", fontWeight: 700, padding: "2px 10px", borderRadius: RADIUS.full,
                          background: o.quantite_disponible > 0 ? "rgba(16,185,129,0.12)" : "rgba(204,34,34,0.12)",
                          color: o.quantite_disponible > 0 ? "#10b981" : "#cc2222",
                        }}>
                          {o.quantite_disponible}
                        </span>
                      </td>
                      <td style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", color: theme.textMuted }}>{o.numero_serie || "—"}</td>
                      <td style={{ padding: "0.8rem 1rem" }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: o.is_active ? "rgba(16,185,129,0.12)" : "rgba(107,114,128,0.12)", color: o.is_active ? "#10b981" : "#6b7280" }}>
                          {o.is_active ? "Actif" : "Inactif"}
                        </span>
                      </td>
                      <td style={{ padding: "0.8rem 1rem" }}>
                        {canManage && (
                          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" as const }}>
                            <button onClick={() => setOutilModal(o)} style={smallBtn(PALETTE.primary, theme.border)}>
                              Modifier
                            </button>
                            {o.is_active && (
                              <button onClick={() => setQuantiteModal(o)} style={smallBtn("#10b981", "rgba(16,185,129,0.3)")} title="Augmenter la quantité">
                                + Qté
                              </button>
                            )}
                            <button onClick={() => handleToggleActive(o)} style={smallBtn(o.is_active ? "#f59e0b" : "#10b981", o.is_active ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.3)")}>
                              {o.is_active ? "Désactiver" : "Réactiver"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Cards mobile */}
          <div className="ou-cards-wrap">
            {outils.map(o => (
              <div key={o.id} style={{ ...card, display: "flex", flexDirection: "column" as const, gap: "0.5rem", opacity: o.is_active ? 1 : 0.6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: theme.textPrimary }}>{o.nom}</div>
                    <div style={{ fontSize: "0.75rem", color: theme.textMuted }}>{o.categorie_display}</div>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: o.is_active ? "rgba(16,185,129,0.12)" : "rgba(107,114,128,0.12)", color: o.is_active ? "#10b981" : "#6b7280" }}>
                      {o.is_active ? "Actif" : "Inactif"}
                    </span>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, padding: "2px 10px", borderRadius: RADIUS.full, background: o.quantite_disponible > 0 ? "rgba(16,185,129,0.12)" : "rgba(204,34,34,0.12)", color: o.quantite_disponible > 0 ? "#10b981" : "#cc2222" }}>
                      {o.quantite_disponible}/{o.quantite_totale}
                    </span>
                  </div>
                </div>
                {canManage && (
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" as const }}>
                    <button onClick={() => setOutilModal(o)} style={smallBtn(PALETTE.primary, theme.border)}>Modifier</button>
                    {o.is_active && (
                      <button onClick={() => setQuantiteModal(o)} style={smallBtn("#10b981", "rgba(16,185,129,0.3)")}>+ Quantité</button>
                    )}
                    <button onClick={() => handleToggleActive(o)} style={smallBtn(o.is_active ? "#f59e0b" : "#10b981", o.is_active ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.3)")}>
                      {o.is_active ? "Désactiver" : "Réactiver"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Onglet Réservations ── */}
      {tab === "reservations" && (
        <>
          <div className="ou-filters">
            <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
              style={{ padding: "0.6rem 0.9rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.88rem", fontFamily: FONTS.body, outline: "none" }}>
              <option value="">Tous les statuts</option>
              <option value="en_attente">En attente</option>
              <option value="approuvee">Approuvée</option>
              <option value="remis">Remis au technicien</option>
              <option value="en_cours">En cours</option>
              <option value="retour_declare">Retour déclaré</option>
              <option value="retournee">Retournée</option>
              <option value="refusee">Refusée</option>
            </select>
          </div>

          {/* Table desktop */}
          <div className="ou-table-wrap" style={{ ...card, padding: 0, overflow: "hidden" }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid ${theme.border}`, borderTopColor: PALETTE.primary, animation: "ou-spin 0.8s linear infinite" }} />
              </div>
            ) : reservations.length === 0 ? (
              <div style={{ textAlign: "center" as const, padding: "3rem", color: theme.textMuted }}>Aucune réservation.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {["Outil", "Technicien", "Chantier", "Période", "Qté", "Statut", "Actions"].map(h => (
                      <th key={h} style={{ padding: "0.8rem 1rem", textAlign: "left" as const, fontSize: "0.72rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r, i) => (
                    <tr key={r.id} style={{ borderBottom: i < reservations.length - 1 ? `1px solid ${theme.border}` : "none" }}>
                      <td style={{ padding: "0.8rem 1rem", fontWeight: 600, color: theme.textPrimary, fontSize: "0.88rem" }}>{r.outil_detail.nom}</td>
                      <td style={{ padding: "0.8rem 1rem", fontSize: "0.82rem", color: theme.textSecondary }}>{r.technicien_detail.full_name}</td>
                      <td style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", color: theme.textMuted }}>{r.chantier_nom || "—"}</td>
                      <td style={{ padding: "0.8rem 1rem", fontSize: "0.78rem", color: theme.textSecondary, whiteSpace: "nowrap" as const }}>{fmtDate(r.date_debut)} → {fmtDate(r.date_fin)}</td>
                      <td style={{ padding: "0.8rem 1rem", textAlign: "center" as const, fontSize: "0.82rem", color: theme.textSecondary }}>{r.quantite}</td>
                      <td style={{ padding: "0.8rem 1rem" }}><StatutBadge statut={r.statut} /></td>
                      <td style={{ padding: "0.8rem 1rem" }}>
                        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" as const }}>
                          {canManage && r.statut === "en_attente" && (
                            <>
                              <button onClick={() => handleApprouver(r.id)} style={smallBtn("#10b981", "rgba(16,185,129,0.3)")}>Approuver</button>
                              <button onClick={() => handleRefuser(r.id)}   style={smallBtn("#cc2222", "rgba(204,34,34,0.3)")}>Refuser</button>
                            </>
                          )}
                          {r.statut === "approuvee" && canManage && (
                            <button onClick={() => handleRemettre(r.id)} style={smallBtn("#06b6d4", theme.border)}>📦 Remettre</button>
                          )}
                          {r.statut === "remis" && !canManage && (
                            <button onClick={() => handleConfirmerReception(r.id)} style={smallBtn("#0077b6", theme.border)}>✓ J'ai reçu</button>
                          )}
                          {r.statut === "en_cours" && !canManage && (
                            <button onClick={() => handleRetourner(r.id)} style={smallBtn("#8b5cf6", theme.border)}>Déclarer retour</button>
                          )}
                          {r.statut === "retour_declare" && canManage && (
                            <button onClick={() => handleConfirmerRetour(r.id)} style={smallBtn("#10b981", theme.border)}>✓ Confirmer retour</button>
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
          <div className="ou-cards-wrap">
            {reservations.map(r => (
              <div key={r.id} style={{ ...card, display: "flex", flexDirection: "column" as const, gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: theme.textPrimary }}>{r.outil_detail.nom}</span>
                  <StatutBadge statut={r.statut} />
                </div>
                <div style={{ fontSize: "0.78rem", color: theme.textSecondary }}>{r.technicien_detail.full_name} · {fmtDate(r.date_debut)} → {fmtDate(r.date_fin)}</div>
                {r.chantier_nom && <div style={{ fontSize: "0.75rem", color: theme.textMuted }}>Chantier : {r.chantier_nom}</div>}
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" as const }}>
                  {canManage && r.statut === "en_attente" && (
                    <>
                      <button onClick={() => handleApprouver(r.id)} style={smallBtn("#10b981", "rgba(16,185,129,0.3)")}>Approuver</button>
                      <button onClick={() => handleRefuser(r.id)}   style={smallBtn("#cc2222", "rgba(204,34,34,0.3)")}>Refuser</button>
                    </>
                  )}
                  {r.statut === "approuvee" && canManage && (
                    <button onClick={() => handleRemettre(r.id)} style={smallBtn("#06b6d4", theme.border)}>📦 Remettre</button>
                  )}
                  {r.statut === "remis" && !canManage && (
                    <button onClick={() => handleConfirmerReception(r.id)} style={smallBtn("#0077b6", theme.border)}>✓ J'ai reçu</button>
                  )}
                  {r.statut === "en_cours" && !canManage && (
                    <button onClick={() => handleRetourner(r.id)} style={smallBtn("#8b5cf6", theme.border)}>Déclarer retour</button>
                  )}
                  {r.statut === "retour_declare" && canManage && (
                    <button onClick={() => handleConfirmerRetour(r.id)} style={smallBtn("#10b981", theme.border)}>✓ Confirmer retour</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      {outilModal !== null && (
        <OutilModal
          theme={theme}
          outil={outilModal === "create" ? null : outilModal}
          onClose={() => setOutilModal(null)}
          onSaved={() => { setOutilModal(null); loadOutils(); }}
        />
      )}
      {quantiteModal !== null && (
        <QuantiteModal
          theme={theme}
          outil={quantiteModal}
          onClose={() => setQuantiteModal(null)}
          onSaved={() => { setQuantiteModal(null); loadOutils(); }}
        />
      )}
      {resaModal && user && (
        <ReservationModal
          theme={theme}
          outils={outils.filter(o => o.quantite_disponible > 0)}
          chantiers={chantiers}
          userId={user.id}
          onClose={() => setResaModal(false)}
          onSaved={() => { setResaModal(false); loadReservations(); }}
        />
      )}
    </>
  );
}
