import React, { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import {
  devisService,
  type Devis,
  type DevisDashboard,
  type DevisTechnicien,
  type LigneDevisInput,
} from "../../services/devisService";
import { useSwal } from "../../hooks/useSwal";
import { useAuthStore } from "../../store/authStore";
import { FONTS, PALETTE, RADIUS } from "../../theme";

const fmt     = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("fr-FR");
const fmtTime = (s: string) => new Date(s).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const STATUS_CFG = {
  pending:   { label: "En attente", bg: "rgba(148,163,184,0.12)", text: "#94a3b8", icon: "🕐" },
  assigned:  { label: "Assigné",    bg: "rgba(245,158,11,0.12)",  text: "#f59e0b", icon: "👤" },
  completed: { label: "Complété",   bg: "rgba(16,185,129,0.12)",  text: "#10b981", icon: "✅" },
} as const;

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.pending;
  return (
    <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "3px 9px", borderRadius: RADIUS.full, background: cfg.bg, color: cfg.text, whiteSpace: "nowrap" }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Icônes SVG ────────────────────────────────────────────────────────────────
const ICONS = {
  assign:   "M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z",
  edit:     "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125",
  trash:    "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0",
  wrench:   "M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z",
  eye:      "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  currency: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  print:    "M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z",
};

function IBtn({ icon, color, title, onClick }: {
  icon: keyof typeof ICONS; color: string; title: string; onClick: () => void;
}) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 30, height: 30, borderRadius: "50%", border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        background: hov ? color + "22" : "transparent",
        color, transition: "background 0.15s",
      }}
    >
      <svg width={15} height={15} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[icon]} />
      </svg>
    </button>
  );
}

const CSS = `
  @keyframes dv-spin { to { transform: rotate(360deg); } }

  .dv-header {
    display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;
  }
  @media (min-width: 480px) {
    .dv-header { flex-direction: row; justify-content: space-between; align-items: flex-start; }
  }

  .dv-stats {
    display: grid; grid-template-columns: repeat(2,1fr); gap: 0.65rem; margin-bottom: 1.5rem;
  }
  @media (min-width: 640px) { .dv-stats { grid-template-columns: repeat(4,1fr); gap: 0.85rem; } }

  .dv-filters {
    display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; align-items: center;
  }
  .dv-search { position: relative; flex: 1 1 180px; min-width: 150px; }
  .dv-count  { flex: 0 0 auto; margin-left: auto; font-size: 0.78rem; white-space: nowrap; }

  .dv-table-wrap { display: none; }
  .dv-cards-wrap { display: flex; flex-direction: column; gap: 0.65rem; }
  @media (min-width: 768px) {
    .dv-table-wrap { display: block; }
    .dv-cards-wrap { display: none; }
  }

  .dv-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    z-index: 500; display: flex; align-items: flex-end; justify-content: center;
  }
  @media (min-width: 640px) {
    .dv-overlay { align-items: center; padding: 0.5rem; }
  }
  .dv-modal {
    width: 100%; max-height: 96vh; overflow-y: auto; border-radius: 18px 18px 0 0;
  }
  @media (min-width: 640px) {
    .dv-modal { max-width: 560px; border-radius: 18px; }
  }
  .dv-modal-body { padding: 1rem; }
  @media (min-width: 640px) { .dv-modal-body { padding: 1.5rem; } }

  .dv-footer {
    display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; border-top: 1px solid;
  }
  @media (min-width: 480px) {
    .dv-footer { flex-direction: row; justify-content: flex-end; }
  }
`;

// ── Modal nouveau devis (commercial only) ─────────────────────────────────────
function NewDevisModal({ theme, dark, onClose, onSaved }: {
  theme: LayoutContext["theme"]; dark: boolean;
  onClose: () => void; onSaved: () => void;
}) {
  const swal   = useSwal();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nom: "", prenom: "", telephone: "", commentaire: "" });
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.65rem 0.9rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.9rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: "0.72rem", fontWeight: 600,
    color: theme.textSecondary, marginBottom: "0.3rem",
    textTransform: "uppercase", letterSpacing: "0.05em",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim())       { swal.error("Requis", "Le nom est obligatoire.");       return; }
    if (!form.prenom.trim())    { swal.error("Requis", "Le prénom est obligatoire.");    return; }
    if (!form.telephone.trim()) { swal.error("Requis", "Le téléphone est obligatoire."); return; }
    setSaving(true);
    try {
      await devisService.create({
        nom:         form.nom.trim(),
        prenom:      form.prenom.trim(),
        telephone:   form.telephone.trim(),
        commentaire: form.commentaire.trim() || undefined,
      });
      swal.saved("Le devis");
      onSaved();
    } catch (err: any) {
      swal.error("Erreur", err?.response?.data?.detail ?? "Une erreur est survenue.");
    } finally { setSaving(false); }
  };

  return (
    <div className="dv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dv-modal" style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: theme.popupBg, zIndex: 2, borderRadius: "18px 18px 0 0" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: theme.textPrimary, marginBottom: 2 }}>
              📋 Nouveau devis
            </h2>
            <p style={{ fontSize: "0.75rem", color: theme.textMuted }}>Renseignez les informations du client</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dv-modal-body">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={lbl}>Nom <span style={{ color: "#ef4444" }}>*</span></label>
                  <input required value={form.nom} onChange={e => setF("nom", e.target.value)} placeholder="DIALLO" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Prénom <span style={{ color: "#ef4444" }}>*</span></label>
                  <input required value={form.prenom} onChange={e => setF("prenom", e.target.value)} placeholder="Amadou" style={inp} />
                </div>
              </div>
              <div>
                <label style={lbl}>Téléphone <span style={{ color: "#ef4444" }}>*</span></label>
                <input required value={form.telephone} onChange={e => setF("telephone", e.target.value)} placeholder="77 XXX XX XX" style={inp} />
              </div>
              <div>
                <label style={lbl}>Commentaire / Description de la demande</label>
                <textarea rows={4} value={form.commentaire} onChange={e => setF("commentaire", e.target.value)}
                  placeholder="Description de la demande, besoins, remarques…"
                  style={{ ...inp, resize: "vertical" as const }} />
              </div>
              <div style={{ padding: "0.7rem 0.9rem", borderRadius: RADIUS.md, background: "rgba(6,182,212,0.06)", border: `1px solid rgba(6,182,212,0.2)`, fontSize: "0.82rem", color: theme.textSecondary }}>
                💡 Le devis sera en attente jusqu'à ce que vous l'assigniez à un technicien.
              </div>
            </div>
          </div>

          <div className="dv-footer" style={{ borderTopColor: theme.border }}>
            <button type="submit" disabled={saving}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? `${PALETTE.primary}66` : `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.9rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
              {saving
                ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "dv-spin 0.7s linear infinite", display: "inline-block" }} /> Création…</>
                : "📋 Créer le devis"}
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

// ── Modal assignation (commercial propriétaire ou admin) ──────────────────────
function AssignModal({ theme, dark, devis, technicians, onClose, onSaved }: {
  theme: LayoutContext["theme"]; dark: boolean;
  devis: Devis; technicians: DevisTechnicien[];
  onClose: () => void; onSaved: () => void;
}) {
  const swal   = useSwal();
  const [saving, setSaving] = useState(false);
  const [techId, setTechId] = useState("");

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.65rem 0.9rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.9rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };

  const selectedTech = technicians.find(t => t.id === parseInt(techId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!techId) { swal.error("Requis", "Sélectionnez un technicien."); return; }
    setSaving(true);
    try {
      await devisService.assign(devis.id, parseInt(techId));
      swal.success("Devis assigné avec succès !");
      onSaved();
    } catch (err: any) {
      swal.error("Erreur", err?.response?.data?.detail ?? "Une erreur est survenue.");
    } finally { setSaving(false); }
  };

  return (
    <div className="dv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dv-modal" style={{ background: theme.popupBg, border: `2px solid rgba(245,158,11,0.3)`, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(245,158,11,0.06)", borderRadius: "18px 18px 0 0" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: "#f59e0b", marginBottom: 2 }}>
              👤 Assigner un technicien
            </h2>
            <p style={{ fontSize: "0.75rem", color: theme.textMuted }}>
              Devis #{devis.id} — {devis.prenom} {devis.nom}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dv-modal-body">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              {/* Récap client */}
              <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}` }}>
                {[
                  ["Client",    `${devis.prenom} ${devis.nom}`],
                  ["Téléphone", devis.telephone],
                  ["Date",      fmtDate(devis.created_at)],
                  ...(devis.commentaire ? [["Description", devis.commentaire]] : []),
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0.35rem 0", borderBottom: `1px solid ${theme.border}` }}>
                    <span style={{ fontSize: "0.78rem", color: theme.textMuted, flexShrink: 0, marginRight: "1rem" }}>{k}</span>
                    <span style={{ fontSize: "0.85rem", color: theme.textPrimary, fontWeight: 500, textAlign: "right", maxWidth: "65%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Select technicien */}
              <div>
                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: theme.textSecondary, marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Technicien <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select required value={techId} onChange={e => setTechId(e.target.value)}
                  style={{ ...inp, cursor: "pointer" }}>
                  <option value="">— Sélectionner un technicien —</option>
                  {technicians.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nom}{t.role ? ` — ${t.role}` : ""}
                    </option>
                  ))}
                </select>

                {selectedTech && (
                  <div style={{ marginTop: "0.5rem", padding: "0.6rem 0.85rem", borderRadius: RADIUS.md, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "0.85rem", flexShrink: 0 }}>
                      {selectedTech.nom.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: theme.textPrimary, fontSize: "0.875rem" }}>{selectedTech.nom}</div>
                      <div style={{ fontSize: "0.72rem", color: theme.textMuted }}>Technicien</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="dv-footer" style={{ borderTopColor: theme.border }}>
            <button type="submit" disabled={saving}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? "rgba(245,158,11,0.5)" : "#f59e0b", color: "#fff", fontSize: "0.9rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
              {saving
                ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "dv-spin 0.7s linear infinite", display: "inline-block" }} /> Assignation…</>
                : "👤 Confirmer l'assignation"}
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

// ── Modal remplir matériels (technicien / RT) — désignation + quantité seulement
function MaterielsModal({ theme, dark, devis, onClose, onSaved }: {
  theme: LayoutContext["theme"]; dark: boolean;
  devis: Devis; onClose: () => void; onSaved: () => void;
}) {
  const swal = useSwal();
  const [saving, setSaving] = useState(false);
  const [commentaire, setCommentaire] = useState(devis.commentaire ?? "");
  const [lignes, setLignes] = useState<{ designation: string; quantite: string }[]>([
    { designation: "", quantite: "1" },
  ]);

  const addLigne    = () => setLignes(l => [...l, { designation: "", quantite: "1" }]);
  const removeLigne = (i: number) => setLignes(l => l.filter((_, idx) => idx !== i));
  const updateLigne = (i: number, k: string, v: string) =>
    setLignes(l => l.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.55rem 0.75rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.85rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLignes = lignes.filter(l => l.designation.trim());
    if (validLignes.length === 0) {
      swal.error("Requis", "Ajoutez au moins un matériel.");
      return;
    }
    setSaving(true);
    try {
      const payload: LigneDevisInput[] = validLignes.map(l => ({
        designation: l.designation.trim(),
        quantite:    Math.max(1, parseInt(l.quantite) || 1),
      }));
      await devisService.fillMateriels(devis.id, payload, commentaire.trim() || undefined);
      swal.success("Matériels enregistrés — devis retourné au commercial !");
      onSaved();
    } catch (err: any) {
      swal.error("Erreur", err?.response?.data?.detail ?? "Une erreur est survenue.");
    } finally { setSaving(false); }
  };

  return (
    <div className="dv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dv-modal" style={{ background: theme.popupBg, border: "2px solid rgba(16,185,129,0.3)", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(16,185,129,0.06)", borderRadius: "18px 18px 0 0", position: "sticky", top: 0, zIndex: 2 }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: "#10b981", marginBottom: 2 }}>
              🔧 Remplir les matériels
            </h2>
            <p style={{ fontSize: "0.75rem", color: theme.textMuted }}>
              Devis #{devis.id} — {devis.prenom} {devis.nom} — {devis.telephone}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dv-modal-body">
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

              {/* Description de la demande */}
              {devis.commentaire && (
                <div style={{ padding: "0.65rem 0.9rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}`, fontSize: "0.82rem", color: theme.textSecondary }}>
                  <span style={{ fontWeight: 600, color: theme.textMuted, display: "block", marginBottom: "0.25rem", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Demande du client</span>
                  {devis.commentaire}
                </div>
              )}

              {/* Lignes matériels — désignation + quantité uniquement */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label style={{ fontSize: "0.72rem", fontWeight: 600, color: theme.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Matériels nécessaires <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <button type="button" onClick={addLigne}
                    style={{ padding: "0.3rem 0.7rem", borderRadius: RADIUS.md, border: `1px solid rgba(16,185,129,0.4)`, background: "rgba(16,185,129,0.08)", color: "#10b981", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
                    + Ajouter
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 30px", gap: "0.4rem", marginBottom: "0.4rem" }}>
                  {["Désignation", "Qté", ""].map(h => (
                    <span key={h} style={{ fontSize: "0.65rem", color: theme.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                  ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {lignes.map((ligne, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 30px", gap: "0.4rem", alignItems: "center" }}>
                      <input
                        placeholder="Ex: Câble RJ45 Cat6"
                        value={ligne.designation}
                        onChange={e => updateLigne(i, "designation", e.target.value)}
                        style={inp}
                      />
                      <input
                        type="number" min="1" placeholder="1"
                        value={ligne.quantite}
                        onChange={e => updateLigne(i, "quantite", e.target.value)}
                        style={{ ...inp, textAlign: "center" }}
                      />
                      <button type="button" onClick={() => removeLigne(i)} disabled={lignes.length === 1}
                        style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: lignes.length === 1 ? "transparent" : "rgba(239,68,68,0.1)", color: lignes.length === 1 ? theme.textMuted : "#ef4444", cursor: lignes.length === 1 ? "not-allowed" : "pointer", fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: lignes.length === 1 ? 0.3 : 1 }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Remarque technicien */}
              <div>
                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: theme.textSecondary, marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Remarque / Rapport
                </label>
                <textarea rows={3} value={commentaire} onChange={e => setCommentaire(e.target.value)}
                  placeholder="Observations, difficultés d'accès, recommandations…"
                  style={{ ...inp, resize: "vertical" as const }} />
              </div>

              <div style={{ padding: "0.7rem 0.9rem", borderRadius: RADIUS.md, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", fontSize: "0.82rem", color: theme.textSecondary }}>
                ✅ Le commercial fixera les prix après négociation avec le client.
              </div>
            </div>
          </div>

          <div className="dv-footer" style={{ borderTopColor: theme.border }}>
            <button type="submit" disabled={saving}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? "rgba(16,185,129,0.5)" : "#10b981", color: "#fff", fontSize: "0.9rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
              {saving
                ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "dv-spin 0.7s linear infinite", display: "inline-block" }} /> Enregistrement…</>
                : "🔧 Retourner au commercial"}
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

// ── Modal modifier devis (commercial propriétaire ou admin) ───────────────────
function EditDevisModal({ theme, dark, devis, onClose, onSaved }: {
  theme: LayoutContext["theme"]; dark: boolean;
  devis: Devis; onClose: () => void; onSaved: () => void;
}) {
  const swal   = useSwal();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nom:         devis.nom,
    prenom:      devis.prenom,
    telephone:   devis.telephone,
    commentaire: devis.commentaire ?? "",
  });
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.65rem 0.9rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.9rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: "0.72rem", fontWeight: 600,
    color: theme.textSecondary, marginBottom: "0.3rem",
    textTransform: "uppercase", letterSpacing: "0.05em",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim())       { swal.error("Requis", "Le nom est obligatoire.");       return; }
    if (!form.prenom.trim())    { swal.error("Requis", "Le prénom est obligatoire.");    return; }
    if (!form.telephone.trim()) { swal.error("Requis", "Le téléphone est obligatoire."); return; }
    setSaving(true);
    try {
      await devisService.update(devis.id, {
        nom:         form.nom.trim(),
        prenom:      form.prenom.trim(),
        telephone:   form.telephone.trim(),
        commentaire: form.commentaire.trim() || undefined,
      });
      swal.saved("Le devis");
      onSaved();
    } catch (err: any) {
      swal.error("Erreur", err?.response?.data?.detail ?? "Une erreur est survenue.");
    } finally { setSaving(false); }
  };

  return (
    <div className="dv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dv-modal" style={{ background: theme.popupBg, border: `2px solid ${PALETTE.primary}44`, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: theme.popupBg, zIndex: 2, borderRadius: "18px 18px 0 0" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: PALETTE.primary, marginBottom: 2 }}>
              ✏️ Modifier le devis #{devis.id}
            </h2>
            <p style={{ fontSize: "0.75rem", color: theme.textMuted }}>Modifiez les informations du client</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dv-modal-body">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={lbl}>Nom <span style={{ color: "#ef4444" }}>*</span></label>
                  <input required value={form.nom} onChange={e => setF("nom", e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Prénom <span style={{ color: "#ef4444" }}>*</span></label>
                  <input required value={form.prenom} onChange={e => setF("prenom", e.target.value)} style={inp} />
                </div>
              </div>
              <div>
                <label style={lbl}>Téléphone <span style={{ color: "#ef4444" }}>*</span></label>
                <input required value={form.telephone} onChange={e => setF("telephone", e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Description / Commentaire</label>
                <textarea rows={3} value={form.commentaire} onChange={e => setF("commentaire", e.target.value)}
                  style={{ ...inp, resize: "vertical" as const }} />
              </div>
            </div>
          </div>

          <div className="dv-footer" style={{ borderTopColor: theme.border }}>
            <button type="submit" disabled={saving}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? `${PALETTE.primary}66` : `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.9rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
              {saving
                ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "dv-spin 0.7s linear infinite", display: "inline-block" }} /> Enregistrement…</>
                : "✏️ Enregistrer"}
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

// ── Modal fixer les prix (commercial après négociation) ───────────────────────
function SetPrixModal({ theme, dark, devis, onClose, onSaved }: {
  theme: LayoutContext["theme"]; dark: boolean;
  devis: Devis; onClose: () => void; onSaved: () => void;
}) {
  const swal   = useSwal();
  const [saving, setSaving] = useState(false);
  const [prix, setPrix] = useState<Record<number, string>>(
    Object.fromEntries(devis.lignes.map(l => [l.id, l.prix_unitaire ?? ""]))
  );

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.5rem 0.6rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.85rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const, textAlign: "right" as const,
  };

  const totalEstime = devis.lignes.reduce((sum, l) => {
    const p = parseFloat(prix[l.id] ?? "0") || 0;
    return sum + p * l.quantite;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const lignes = devis.lignes.map(l => ({
        id: l.id,
        prix_unitaire: parseFloat(prix[l.id] ?? "0") || null,
      }));
      await devisService.setPrix(devis.id, lignes);
      swal.saved("Les prix");
      onSaved();
    } catch (err: any) {
      swal.error("Erreur", err?.response?.data?.detail ?? "Une erreur est survenue.");
    } finally { setSaving(false); }
  };

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  return (
    <div className="dv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dv-modal" style={{ background: theme.popupBg, border: "2px solid rgba(99,102,241,0.3)", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(99,102,241,0.06)", borderRadius: "18px 18px 0 0", position: "sticky", top: 0, zIndex: 2 }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: "#6366f1", marginBottom: 2 }}>
              💰 Fixer les prix — Devis #{devis.id}
            </h2>
            <p style={{ fontSize: "0.75rem", color: theme.textMuted }}>
              {devis.prenom} {devis.nom} — Matériels listés par {devis.technicien_nom ?? "Technicien"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dv-modal-body">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

              {/* Remarque technicien */}
              {devis.commentaire && (
                <div style={{ padding: "0.65rem 0.9rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}`, fontSize: "0.82rem", color: theme.textSecondary }}>
                  <span style={{ fontWeight: 600, color: theme.textMuted, display: "block", marginBottom: "0.25rem", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Remarque technicien</span>
                  {devis.commentaire}
                </div>
              )}

              {/* En-têtes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 50px 110px 110px", gap: "0.5rem", padding: "0.35rem 0.5rem", background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", borderRadius: RADIUS.md }}>
                {["Matériel", "Qté", "Prix unit. (FCFA)", "Sous-total"].map(h => (
                  <span key={h} style={{ fontSize: "0.62rem", color: theme.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                ))}
              </div>

              {/* Lignes */}
              {devis.lignes.map((l, i) => {
                const p  = parseFloat(prix[l.id] ?? "0") || 0;
                const st = p * l.quantite;
                return (
                  <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1fr 50px 110px 110px", gap: "0.5rem", alignItems: "center", padding: "0.25rem 0", borderBottom: i < devis.lignes.length - 1 ? `1px solid ${theme.border}` : "none" }}>
                    <span style={{ fontSize: "0.875rem", color: theme.textPrimary, fontWeight: 500 }}>{l.designation}</span>
                    <span style={{ fontSize: "0.875rem", color: theme.textSecondary, textAlign: "center" }}>{l.quantite}</span>
                    <input
                      type="number" min="0" step="1" placeholder="0"
                      value={prix[l.id] ?? ""}
                      onChange={e => setPrix(v => ({ ...v, [l.id]: e.target.value }))}
                      style={inp}
                    />
                    <span style={{ fontSize: "0.875rem", color: theme.textPrimary, fontWeight: 600, textAlign: "right" }}>
                      {st > 0 ? fmt(st) : "—"}
                    </span>
                  </div>
                );
              })}

              {/* Total */}
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "0.5rem 0 0", borderTop: `2px solid ${theme.border}` }}>
                <span style={{ fontWeight: 700, color: theme.textPrimary, fontSize: "0.95rem" }}>
                  Total estimé :&nbsp;
                  <span style={{ color: "#6366f1" }}>{totalEstime > 0 ? fmt(totalEstime) + " FCFA" : "—"}</span>
                </span>
              </div>

              <div style={{ padding: "0.6rem 0.9rem", borderRadius: RADIUS.md, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", fontSize: "0.82rem", color: theme.textSecondary }}>
                💡 Les prix sont modifiables à tout moment après négociation avec le client.
              </div>
            </div>
          </div>

          <div className="dv-footer" style={{ borderTopColor: theme.border }}>
            <button type="submit" disabled={saving}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? "rgba(99,102,241,0.5)" : "#6366f1", color: "#fff", fontSize: "0.9rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
              {saving
                ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "dv-spin 0.7s linear infinite", display: "inline-block" }} /> Enregistrement…</>
                : "💰 Enregistrer les prix"}
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

// ── Modal détail matériels (commercial / admin — lecture) ─────────────────────
function MaterielsDetailModal({ theme, dark, devis, onClose }: {
  theme: LayoutContext["theme"]; dark: boolean;
  devis: Devis; onClose: () => void;
}) {
  const total = devis.lignes.reduce((sum, l) => {
    const pu = l.prix_unitaire ? parseFloat(l.prix_unitaire) : 0;
    return sum + pu * l.quantite;
  }, 0);
  const hasPrice = devis.lignes.some(l => l.prix_unitaire);

  return (
    <div className="dv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dv-modal" style={{ background: theme.popupBg, border: "2px solid rgba(16,185,129,0.3)", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(16,185,129,0.06)", borderRadius: "18px 18px 0 0" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: "#10b981", marginBottom: 2 }}>
              ✅ Matériels — Devis #{devis.id}
            </h2>
            <p style={{ fontSize: "0.75rem", color: theme.textMuted }}>
              {devis.prenom} {devis.nom} — Complété par {devis.technicien_nom ?? "Technicien"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1 }}>✕</button>
        </div>

        <div className="dv-modal-body">
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {devis.commentaire && (
              <div style={{ padding: "0.65rem 0.9rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}`, fontSize: "0.82rem", color: theme.textSecondary }}>
                <span style={{ fontWeight: 600, color: theme.textMuted, display: "block", marginBottom: "0.25rem", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Remarque technicien</span>
                {devis.commentaire}
              </div>
            )}

            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 50px 90px 90px", gap: "0.5rem", padding: "0.4rem 0.6rem", background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", borderRadius: RADIUS.md, marginBottom: "0.5rem" }}>
                {["Désignation", "Qté", "Prix unit.", "Sous-total"].map(h => (
                  <span key={h} style={{ fontSize: "0.65rem", color: theme.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                ))}
              </div>
              {devis.lignes.map((l, i) => {
                const pu = l.prix_unitaire ? parseFloat(l.prix_unitaire) : null;
                const st = pu !== null ? pu * l.quantite : null;
                return (
                  <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1fr 50px 90px 90px", gap: "0.5rem", padding: "0.55rem 0.6rem", borderBottom: i < devis.lignes.length - 1 ? `1px solid ${theme.border}` : "none", alignItems: "center" }}>
                    <span style={{ fontSize: "0.875rem", color: theme.textPrimary, fontWeight: 500 }}>{l.designation}</span>
                    <span style={{ fontSize: "0.875rem", color: theme.textSecondary, textAlign: "center" }}>{l.quantite}</span>
                    <span style={{ fontSize: "0.875rem", color: theme.textSecondary, textAlign: "right" }}>{pu !== null ? fmt(pu) : "—"}</span>
                    <span style={{ fontSize: "0.875rem", color: theme.textPrimary, fontWeight: 600, textAlign: "right" }}>{st !== null ? fmt(st) : "—"}</span>
                  </div>
                );
              })}
              {hasPrice && (
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "0.65rem 0.6rem 0", borderTop: `2px solid ${theme.border}`, marginTop: "0.25rem" }}>
                  <span style={{ fontWeight: 700, color: theme.textPrimary, fontSize: "0.95rem" }}>
                    Total estimé : <span style={{ color: "#10b981" }}>{fmt(total)} FCFA</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="dv-footer" style={{ borderTopColor: theme.border }}>
          <button type="button" onClick={onClose}
            style={{ width: "100%", padding: "0.7rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon, theme, onClick }: {
  label: string; value: number | string; color: string;
  icon: string; theme: LayoutContext["theme"]; onClick?: () => void;
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

// ── Page principale ────────────────────────────────────────────────────────────
export default function DevisPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const swal = useSwal();

  // ── Infos utilisateur depuis le store (déjà authentifié) ────────────────
  const { user, hasPermission } = useAuthStore();
  const currentUserId = user?.id ?? null;
  const userRole      = user?.role ?? "";
  const isAdmin       = hasPermission("all");
  const isCommercial  = userRole.toLowerCase() === "commercial";
  const isTechnicien  = userRole.toLowerCase() === "technicien" || userRole.toLowerCase() === "technician";
  const canCreate     = isAdmin || isCommercial;

  const [devisList,   setDevisList]   = useState<Devis[]>([]);
  const [dashboard,   setDashboard]   = useState<DevisDashboard | null>(null);
  const [technicians, setTechnicians] = useState<DevisTechnicien[]>([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);

  const [search,  setSearch]  = useState("");
  const [statusF, setStatusF] = useState("");
  const [page,    setPage]    = useState(1);
  const PAGE_SIZE = 15;

  const [showNew,      setShowNew]      = useState(false);
  const [showAssign,   setShowAssign]   = useState(false);
  const [showEdit,     setShowEdit]     = useState(false);
  const [showMat,      setShowMat]      = useState(false);
  const [showSetPrix,  setShowSetPrix]  = useState(false);
  const [showMatDetail,setShowMatDetail]= useState(false);
  const [selected,     setSelected]     = useState<Devis | null>(null);

  // Charge les techniciens si l'utilisateur peut assigner
  useEffect(() => {
    if (isAdmin || isCommercial) {
      devisService.getTechnicians().then(setTechnicians).catch(() => {});
    }
  }, [isAdmin, isCommercial]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: PAGE_SIZE };
      if (search)  params.search = search;
      if (statusF) params.status = statusF;

      const [res, dash] = await Promise.all([
        devisService.getAll(params),
        devisService.getDashboard(),
      ]);
      setDevisList(res.results);
      setTotal(res.count);
      setDashboard(dash);
    } catch { swal.serverError(); }
    finally   { setLoading(false); }
  }, [page, search, statusF]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusF]);

  const handleDelete = async (dv: Devis) => {
    if (!await swal.confirmDelete(`Devis #${dv.id}`)) return;
    try { await devisService.delete(dv.id); swal.deleted("Le devis"); load(); }
    catch { swal.serverError(); }
  };

  const printDevis = (dv: Devis) => {
    const fmtN = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
    const total = dv.lignes.reduce((sum, l) => {
      const pu = l.prix_unitaire ? parseFloat(l.prix_unitaire) : 0;
      return sum + pu * l.quantite;
    }, 0);
    const hasPrice = dv.lignes.some(l => l.prix_unitaire);

    const lignesHtml = dv.lignes.map((l, i) => {
      const pu = l.prix_unitaire ? parseFloat(l.prix_unitaire) : null;
      const st = pu !== null ? pu * l.quantite : null;
      return `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 12px;font-weight:500;">${i + 1}. ${l.designation}</td>
        <td style="padding:10px 12px;text-align:center;">${l.quantite}</td>
        <td style="padding:10px 12px;text-align:right;">${pu !== null ? fmtN(pu) + " FCFA" : "—"}</td>
        <td style="padding:10px 12px;text-align:right;font-weight:600;">${st !== null ? fmtN(st) + " FCFA" : "—"}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Devis #${dv.id}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:13px;color:#1e293b;padding:40px;max-width:800px;margin:0 auto}
@media print{body{padding:20px}}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}
.company-name{font-size:20px;font-weight:700;color:#2563eb}
.devis-ref{text-align:right}
.devis-ref h2{font-size:18px;color:#2563eb;margin-bottom:4px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px}
.info-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px}
.info-box h3{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-bottom:8px}
.info-row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9}
.info-row:last-child{border-bottom:none}
.info-label{color:#64748b;font-size:12px}
.info-value{font-weight:600;font-size:12px}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
thead tr{background:#1e40af;color:#fff}
thead th{padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em}
tbody tr:nth-child(even){background:#f8fafc}
.total-row td{padding:12px;font-weight:700;font-size:14px;color:#1e40af;border-top:2px solid #2563eb;background:#eff6ff}
.desc-box{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 14px;margin-bottom:24px;font-size:12px;color:#92400e}
.warn-box{padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:12px;color:#991b1b;margin-bottom:20px}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#dcfce7;color:#166534}
.footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="company-name">NETSYSTEME INFORMATIQUE</div>
    <div style="color:#64748b;font-size:12px;margin-top:4px;">Services &amp; Solutions Informatiques</div>
  </div>
  <div class="devis-ref">
    <h2>DEVIS N° ${dv.id}</h2>
    <div style="color:#64748b;font-size:12px;">${fmtDate(dv.created_at)}</div>
    <span class="badge">✅ Complété</span>
  </div>
</div>

<div class="info-grid">
  <div class="info-box">
    <h3>Client</h3>
    <div class="info-row"><span class="info-label">Nom complet</span><span class="info-value">${dv.prenom} ${dv.nom}</span></div>
    <div class="info-row"><span class="info-label">Téléphone</span><span class="info-value">${dv.telephone}</span></div>
  </div>
  <div class="info-box">
    <h3>Intervenants</h3>
    ${dv.user_nom ? `<div class="info-row"><span class="info-label">Commercial</span><span class="info-value">${dv.user_nom}</span></div>` : ""}
    ${dv.technicien_nom ? `<div class="info-row"><span class="info-label">Technicien</span><span class="info-value">${dv.technicien_nom}</span></div>` : ""}
    <div class="info-row"><span class="info-label">Date</span><span class="info-value">${fmtDate(dv.created_at)}</span></div>
  </div>
</div>

${dv.commentaire ? `<div class="desc-box"><strong style="display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#b45309;">Description / Remarques</strong>${dv.commentaire}</div>` : ""}

<table>
  <thead>
    <tr>
      <th>Désignation</th>
      <th style="text-align:center;">Qté</th>
      <th style="text-align:right;">Prix unitaire</th>
      <th style="text-align:right;">Sous-total</th>
    </tr>
  </thead>
  <tbody>
    ${lignesHtml}
    ${hasPrice ? `<tr class="total-row"><td colspan="3" style="text-align:right;">TOTAL ESTIMÉ</td><td style="text-align:right;">${fmtN(total)} FCFA</td></tr>` : ""}
  </tbody>
</table>

${!hasPrice ? `<div class="warn-box">⚠️ Les prix n'ont pas encore été définis. Document préliminaire.</div>` : ""}

<div class="footer">
  <p>Document généré le ${new Date().toLocaleDateString("fr-FR")} — NETSYSTEME INFORMATIQUE</p>
  <p style="margin-top:4px;">Ce devis est établi à titre indicatif. Pour toute question, contactez votre commercial.</p>
</div>
<script>window.onload=function(){window.print();}</script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (win) { win.document.write(html); win.document.close(); }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.55rem 0.75rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };

  type ActionDef = { icon: keyof typeof ICONS; color: string; title: string; onClick: () => void };

  const getActions = (dv: Devis): ActionDef[] => {
    const actions: ActionDef[] = [];
    const isOwner = isAdmin || (isCommercial && dv.user === currentUserId);

    // Assigner/réassigner : commercial propriétaire ou admin
    if (isOwner && dv.status !== "completed") {
      actions.push({ icon: "assign", color: "#f59e0b", title: dv.status === "assigned" ? "Réassigner" : "Assigner un technicien", onClick: () => { setSelected(dv); setShowAssign(true); } });
    }

    // Modifier : commercial propriétaire ou admin, devis non complété
    if (isOwner && dv.status !== "completed") {
      actions.push({ icon: "edit", color: PALETTE.primary, title: "Modifier", onClick: () => { setSelected(dv); setShowEdit(true); } });
    }

    // Remplir matériels : technicien assigné (ou admin)
    if (dv.status === "assigned" && (isAdmin || dv.assigned_to === currentUserId)) {
      actions.push({ icon: "wrench", color: "#10b981", title: "Remplir les matériels", onClick: () => { setSelected(dv); setShowMat(true); } });
    }

    // Fixer les prix : commercial propriétaire (après négociation)
    if (dv.status === "completed" && dv.lignes.length > 0 && isCommercial && dv.user === currentUserId) {
      actions.push({ icon: "currency", color: "#6366f1", title: "Fixer les prix", onClick: () => { setSelected(dv); setShowSetPrix(true); } });
    }

    // Voir matériels (lecture) : admin uniquement
    if (dv.status === "completed" && dv.lignes.length > 0 && isAdmin) {
      actions.push({ icon: "eye", color: "#10b981", title: "Voir les matériels", onClick: () => { setSelected(dv); setShowMatDetail(true); } });
    }

    // Imprimer PDF : commercial propriétaire ou admin, devis complété
    if (dv.status === "completed" && dv.lignes.length > 0 && (isAdmin || (isCommercial && dv.user === currentUserId))) {
      actions.push({ icon: "print", color: "#64748b", title: "Imprimer / PDF", onClick: () => printDevis(dv) });
    }

    // Supprimer : admin uniquement
    if (isAdmin) {
      actions.push({ icon: "trash", color: "#ef4444", title: "Supprimer", onClick: () => handleDelete(dv) });
    }

    return actions;
  };

  return (
    <div style={{ fontFamily: FONTS.body }}>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <div className="dv-header">
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontSize: "1.4rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>
            📋 Devis
          </h1>
          <p style={{ fontSize: "0.82rem", color: theme.textMuted, marginTop: 3 }}>
            {isTechnicien
              ? "Devis assignés — remplissez les matériels et retournez-les au commercial"
              : "Créez des devis et assignez-les aux techniciens"}
          </p>
        </div>
        {canCreate && (
          <button onClick={() => setShowNew(true)}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.65rem 1.2rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap" }}>
            + Nouveau devis
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      {dashboard && (
        <div className="dv-stats">
          <StatCard label="Total"      value={dashboard.total}     color={PALETTE.primary} icon="📋" theme={theme} onClick={() => setStatusF("")} />
          <StatCard label="En attente" value={dashboard.pending}   color="#94a3b8"         icon="🕐" theme={theme} onClick={() => setStatusF("pending")} />
          <StatCard label="Assignés"   value={dashboard.assigned}  color="#f59e0b"         icon="👤" theme={theme} onClick={() => setStatusF("assigned")} />
          <StatCard label="Complétés"  value={dashboard.completed} color="#10b981"         icon="✅" theme={theme} onClick={() => setStatusF("completed")} />
        </div>
      )}

      {/* ── Alerte pending (commercial / admin) ── */}
      {dashboard && dashboard.pending > 0 && (isAdmin || isCommercial) && (
        <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <span style={{ fontSize: "1.1rem" }}>🕐</span>
          <span style={{ fontSize: "0.85rem", color: theme.textPrimary }}>
            <strong>{dashboard.pending}</strong> devis{dashboard.pending > 1 ? " sont" : " est"} en attente d'assignation.
          </span>
        </div>
      )}

      {/* ── Alerte assigned (technicien) ── */}
      {dashboard && dashboard.assigned > 0 && isTechnicien && (
        <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <span style={{ fontSize: "1.1rem" }}>🔧</span>
          <span style={{ fontSize: "0.85rem", color: theme.textPrimary }}>
            <strong>{dashboard.assigned}</strong> devis{dashboard.assigned > 1 ? " vous attendent" : " vous attend"} — remplissez les matériels nécessaires.
          </span>
        </div>
      )}

      {/* ── Filtres ── */}
      <div className="dv-filters">
        <div className="dv-search">
          <span style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted, pointerEvents: "none", fontSize: "0.85rem" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, prénom, téléphone…"
            style={{ ...inp, paddingLeft: "2.2rem" }} />
        </div>

        {(["", "pending", "assigned", "completed"] as const).map(f => {
          const cfg = f === "" ? { label: "Tous", color: PALETTE.primary, icon: "📋" } : { label: STATUS_CFG[f].label, color: STATUS_CFG[f].text, icon: STATUS_CFG[f].icon };
          return (
            <button key={f} onClick={() => setStatusF(f)}
              style={{ padding: "0.48rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${statusF === f ? cfg.color : theme.border}`, background: statusF === f ? cfg.color + "14" : "transparent", color: statusF === f ? cfg.color : theme.textMuted, fontSize: "0.8rem", fontWeight: statusF === f ? 600 : 400, cursor: "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap", transition: "all 0.15s" }}>
              {cfg.icon} {cfg.label}
            </button>
          );
        })}

        <span className="dv-count" style={{ color: theme.textMuted }}>
          {total} devis
        </span>
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <div style={{ width: 34, height: 34, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "dv-spin 0.8s linear infinite" }} />
        </div>
      ) : devisList.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📋</div>
          <div style={{ fontWeight: 600, color: theme.textPrimary, marginBottom: "0.5rem" }}>
            {search || statusF ? "Aucun résultat" : "Aucun devis"}
          </div>
          <div style={{ fontSize: "0.875rem", color: theme.textMuted, marginBottom: "1.25rem" }}>
            {search || statusF ? "Modifiez vos filtres" : canCreate ? "Créez le premier devis" : "Aucun devis assigné pour l'instant"}
          </div>
          {!search && !statusF && canCreate && (
            <button onClick={() => setShowNew(true)}
              style={{ padding: "0.65rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
              + Nouveau devis
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── Tableau desktop ── */}
          <div className="dv-table-wrap" style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {["#", "Client", "Téléphone", "Description", "Date", "Statut", "Technicien", "Actions"].map(h => (
                      <th key={h} style={{ padding: "0.7rem 1rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {devisList.map((dv, i) => {
                    const actions = getActions(dv);
                    return (
                      <tr key={dv.id}
                        style={{ borderBottom: i < devisList.length - 1 ? `1px solid ${theme.border}` : "none", transition: "background 0.12s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "0.85rem 1rem", fontWeight: 700, color: PALETTE.primary }}>#{dv.id}</td>
                        <td style={{ padding: "0.85rem 1rem" }}>
                          <div style={{ fontWeight: 600, color: theme.textPrimary }}>{dv.prenom} {dv.nom}</div>
                          {dv.user_nom && <div style={{ fontSize: "0.7rem", color: theme.textMuted }}>par {dv.user_nom}</div>}
                        </td>
                        <td style={{ padding: "0.85rem 1rem" }}>
                          <a href={`tel:${dv.telephone}`} style={{ color: PALETTE.primary, textDecoration: "none", fontSize: "0.85rem", fontWeight: 500 }}>
                            📞 {dv.telephone}
                          </a>
                        </td>
                        <td style={{ padding: "0.85rem 1rem", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: theme.textSecondary, fontSize: "0.82rem" }}>
                          {dv.commentaire ?? "—"}
                        </td>
                        <td style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>
                          <div style={{ fontSize: "0.82rem", color: theme.textPrimary }}>{fmtDate(dv.created_at)}</div>
                          <div style={{ fontSize: "0.7rem", color: theme.textMuted }}>{fmtTime(dv.created_at)}</div>
                        </td>
                        <td style={{ padding: "0.85rem 1rem" }}><StatusBadge status={dv.status} /></td>
                        <td style={{ padding: "0.85rem 1rem", color: theme.textSecondary, fontSize: "0.85rem" }}>
                          {dv.technicien_nom
                            ? <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <div style={{ width: 24, height: 24, borderRadius: "50%", background: `linear-gradient(135deg,#f59e0b,#d97706)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "0.65rem", flexShrink: 0 }}>
                                  {dv.technicien_nom.charAt(0).toUpperCase()}
                                </div>
                                <span>{dv.technicien_nom}</span>
                                {dv.status === "completed" && dv.lignes.length > 0 && (
                                  <span style={{ fontSize: "0.65rem", background: "rgba(16,185,129,0.12)", color: "#10b981", padding: "1px 6px", borderRadius: RADIUS.full, fontWeight: 600 }}>
                                    {dv.lignes.length} mat.
                                  </span>
                                )}
                              </div>
                            : <span style={{ color: theme.textMuted, fontStyle: "italic" }}>Non assigné</span>}
                        </td>
                        <td style={{ padding: "0.85rem 0.75rem" }}>
                          <div style={{ display: "flex", gap: "0.1rem", alignItems: "center" }}>
                            {actions.map(a => (
                              <IBtn key={a.icon + a.title} icon={a.icon} color={a.color} title={a.title} onClick={a.onClick} />
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Cartes mobiles ── */}
          <div className="dv-cards-wrap">
            {devisList.map(dv => {
              const actions = getActions(dv);
              return (
                <div key={dv.id} style={{ background: theme.cardBg, border: `1px solid ${dv.status === "pending" ? "rgba(148,163,184,0.35)" : dv.status === "assigned" ? "rgba(245,158,11,0.3)" : theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.65rem 1rem", borderBottom: `1px solid ${theme.border}`, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 700, color: PALETTE.primary, fontSize: "0.85rem" }}>#{dv.id}</span>
                      <StatusBadge status={dv.status} />
                    </div>
                    <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>{fmtDate(dv.created_at)}</span>
                  </div>

                  <div style={{ padding: "0.85rem 1rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                    <div style={{ fontWeight: 700, color: theme.textPrimary, fontSize: "0.95rem" }}>
                      {dv.prenom} {dv.nom}
                    </div>
                    <a href={`tel:${dv.telephone}`} style={{ fontSize: "0.85rem", color: PALETTE.primary, textDecoration: "none", fontWeight: 500 }}>
                      📞 {dv.telephone}
                    </a>
                    {dv.commentaire && (
                      <div style={{ fontSize: "0.82rem", color: theme.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        📝 {dv.commentaire}
                      </div>
                    )}
                    {dv.technicien_nom && (
                      <div style={{ fontSize: "0.8rem", color: theme.textMuted, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <span>👤</span> {dv.technicien_nom}
                        {dv.status === "completed" && dv.lignes.length > 0 && (
                          <span style={{ fontSize: "0.65rem", background: "rgba(16,185,129,0.12)", color: "#10b981", padding: "1px 6px", borderRadius: RADIUS.full, fontWeight: 600 }}>
                            {dv.lignes.length} mat.
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {actions.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.2rem", padding: "0.5rem 0.75rem", borderTop: `1px solid ${theme.border}` }}>
                      {actions.map(a => (
                        <IBtn key={a.icon + a.title} icon={a.icon} color={a.color} title={a.title} onClick={a.onClick} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", marginTop: "0.75rem", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px" }}>
          <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>{page}/{totalPages}</span>
          <div style={{ display: "flex", gap: "0.3rem" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: "0.35rem 0.65rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, fontFamily: FONTS.body, fontSize: "0.8rem" }}>←</button>
            {[...Array(Math.min(totalPages, 5))].map((_, i) => {
              const p = i + 1;
              return (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid ${p === page ? PALETTE.primary : theme.border}`, background: p === page ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : "transparent", color: p === page ? "#fff" : theme.textMuted, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body }}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ padding: "0.35rem 0.65rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontFamily: FONTS.body, fontSize: "0.8rem" }}>→</button>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showNew && (
        <NewDevisModal theme={theme} dark={dark}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }} />
      )}
      {showAssign && selected && (
        <AssignModal theme={theme} dark={dark}
          devis={selected} technicians={technicians}
          onClose={() => { setShowAssign(false); setSelected(null); }}
          onSaved={() => { setShowAssign(false); setSelected(null); load(); }} />
      )}
      {showEdit && selected && (
        <EditDevisModal theme={theme} dark={dark}
          devis={selected}
          onClose={() => { setShowEdit(false); setSelected(null); }}
          onSaved={() => { setShowEdit(false); setSelected(null); load(); }} />
      )}
      {showMat && selected && (
        <MaterielsModal theme={theme} dark={dark}
          devis={selected}
          onClose={() => { setShowMat(false); setSelected(null); }}
          onSaved={() => { setShowMat(false); setSelected(null); load(); }} />
      )}
      {showSetPrix && selected && (
        <SetPrixModal theme={theme} dark={dark}
          devis={selected}
          onClose={() => { setShowSetPrix(false); setSelected(null); }}
          onSaved={() => { setShowSetPrix(false); setSelected(null); load(); }} />
      )}
      {showMatDetail && selected && (
        <MaterielsDetailModal theme={theme} dark={dark}
          devis={selected}
          onClose={() => { setShowMatDetail(false); setSelected(null); }} />
      )}
    </div>
  );
}
