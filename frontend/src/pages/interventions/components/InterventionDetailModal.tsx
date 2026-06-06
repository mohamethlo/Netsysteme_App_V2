import { useState } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { interventionsService, type Intervention } from "../../../services/interventionsService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";
import SignatureModal from "./SignatureModal";

interface Props {
  dark:         boolean;
  theme:        LayoutContext["theme"];
  intervention: Intervention;
  onClose:      () => void;
  onEdit:       () => void;
  onRefresh:    () => void;
}

const STATUT_CFG = {
  planifiee: { label: "Planifiée", bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  en_cours:  { label: "En cours",  bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
  terminee:  { label: "Terminée",  bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  annulee:   { label: "Annulée",   bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
} as const;

const PRIORITE_CFG = {
  basse:   { label: "Basse",   bg: "rgba(148,163,184,0.12)", text: "#94a3b8" },
  normale: { label: "Normale", bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  haute:   { label: "Haute",   bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
  urgente: { label: "Urgente", bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
} as const;

const CSS = `
  @keyframes idet-spin { to { transform: rotate(360deg); } }

  .idet-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    z-index: 500; display: flex; align-items: flex-end; justify-content: center;
  }
  @media (min-width: 640px) {
    .idet-overlay { align-items: center; padding: 1rem; }
  }

  .idet-modal {
    width: 100%; max-height: 96vh; overflow-y: auto; border-radius: 18px 18px 0 0;
  }
  @media (min-width: 640px) {
    .idet-modal { max-width: 720px; border-radius: 18px; max-height: 94vh; }
  }

  .idet-body { padding: 1rem 1.1rem; }
  @media (min-width: 640px) { .idet-body { padding: 1.25rem 1.5rem; } }

  .idet-grid2 { display: grid; grid-template-columns: 1fr; gap: 0.85rem; }
  @media (min-width: 500px) { .idet-grid2 { grid-template-columns: 1fr 1fr; } }

  .idet-footer {
    padding: 0.85rem 1.1rem; display: flex; flex-direction: column; gap: 0.5rem;
  }
  @media (min-width: 640px) {
    .idet-footer { padding: 1rem 1.5rem; flex-direction: row; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
  }

  .idet-footer-left  { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .idet-footer-right { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
  @media (min-width: 640px) {
    .idet-footer-right { display: flex; flex-direction: row; align-items: center; gap: 0.4rem; }
  }

  .idet-btn-full { width: 100%; justify-content: center; }
  @media (min-width: 640px) { .idet-btn-full { width: auto; } }
`;

export default function InterventionDetailModal({ dark, theme, intervention: inv, onClose, onEdit, onRefresh }: Props) {
  const swal = useSwal();
  const [busy, setBusy] = useState(false);
  const [showSignature, setShowSignature] = useState(false);

  const sc = STATUT_CFG[inv.statut]   ?? STATUT_CFG.planifiee;
  const pc = PRIORITE_CFG[inv.priorite] ?? PRIORITE_CFG.normale;
  const fmt = (n: number) => `${Math.floor(n / 60)}h${(n % 60).toString().padStart(2, "0")}m`;

  const handleChangeStatus = async (statut: string, label: string) => {
    if (!await swal.confirm({ title: `${label} cette intervention ?`, icon: "question", confirmText: label })) return;
    setBusy(true);
    try {
      await interventionsService.changeStatus(inv.id, statut as any);
      swal.success("Statut mis à jour.");
      onRefresh(); onClose();
    } catch { swal.serverError(); }
    finally { setBusy(false); }
  };

  const handleTerminer = () => setShowSignature(true);

  const handleSignatureConfirm = async (signatureData: string | null) => {
    setBusy(true);
    try {
      await interventionsService.changeStatus(inv.id, "terminee", signatureData ?? undefined);
      swal.success("Intervention terminée avec succès.");
      onRefresh(); onClose();
    } catch { swal.serverError(); }
    finally { setBusy(false); setShowSignature(false); }
  };

  const nextActions: { label: string; statut: string; color: string; isTerminer?: boolean }[] = {
    planifiee: [
      { label: "▶ Démarrer",  statut: "en_cours", color: "#f59e0b" },
      { label: "✕ Annuler",   statut: "annulee",  color: "#ef4444" },
    ],
    en_cours: [
      { label: "✓ Terminer",  statut: "terminee", color: "#10b981", isTerminer: true },
      { label: "✕ Annuler",   statut: "annulee",  color: "#ef4444" },
    ],
    terminee:  [],
    annulee:   [],
  }[inv.statut] ?? [];

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0.45rem 0", borderBottom: `1px solid ${theme.border}` }}>
      <span style={{ fontSize: "0.78rem", color: theme.textMuted, flexShrink: 0, marginRight: "1rem" }}>{label}</span>
      <span style={{ fontSize: "0.85rem", color: theme.textPrimary, fontWeight: 500, textAlign: "right" }}>{value ?? "—"}</span>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>

      {showSignature && (
        <SignatureModal
          dark={dark}
          theme={theme}
          busy={busy}
          onConfirm={handleSignatureConfirm}
          onCancel={() => setShowSignature(false)}
        />
      )}

      <div className="idet-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="idet-modal" style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

          {/* Header */}
          <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: 4 }}>
                <h2 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: theme.textPrimary, margin: 0 }}>
                  Intervention #{inv.id}
                </h2>
                <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: sc.bg, color: sc.text }}>{sc.label}</span>
                <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: pc.bg, color: pc.text }}>{pc.label}</span>
              </div>
              <div style={{ fontSize: "0.8rem", color: theme.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {inv.type_intervention ?? "Type non défini"} · {new Date(inv.date_prevue).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1, flexShrink: 0 }}>✕</button>
          </div>

          {/* Corps */}
          <div className="idet-body">

            {/* Infos principales */}
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.6rem" }}>
                Informations
              </div>
              <InfoRow label="Client"       value={inv.client_nom ?? inv.client_libre_nom} />
              <InfoRow label="Technicien"   value={inv.technicien_nom} />
              <InfoRow label="Date prévue"  value={new Date(inv.date_prevue).toLocaleString("fr-FR")} />
              {inv.date_realisation && <InfoRow label="Date réalisée" value={new Date(inv.date_realisation).toLocaleString("fr-FR")} />}
              {inv.duree_estimee   && <InfoRow label="Durée estimée"  value={fmt(inv.duree_estimee)} />}
              {inv.adresse         && <InfoRow label="Adresse"        value={inv.adresse} />}
              {inv.autres_intervenants_detail.length > 0 && (
                <InfoRow label="Autres intervenants" value={inv.autres_intervenants_detail.map(u => u.nom).join(", ")} />
              )}
            </div>

            {/* Description */}
            {inv.description && (
              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Description</div>
                <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}`, fontSize: "0.875rem", color: theme.textSecondary, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {inv.description}
                </div>
              </div>
            )}

            {/* Rapport terrain */}
            {(inv.heure_arrivee || inv.taches_realisees || inv.observations_technicien || inv.id_dvr_nvr) && (
              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.6rem" }}>
                  Rapport terrain
                </div>
                {inv.heure_arrivee && <InfoRow label="Heure arrivée"  value={inv.heure_arrivee} />}
                {inv.heure_depart  && <InfoRow label="Heure départ"   value={inv.heure_depart} />}
                {inv.duree_intervention && <InfoRow label="Durée réelle" value={inv.duree_intervention} />}
                {inv.id_dvr_nvr    && <InfoRow label="ID DVR/NVR"     value={inv.id_dvr_nvr} />}
                {inv.taches_realisees && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <div style={{ fontSize: "0.7rem", color: theme.textMuted, marginBottom: "0.3rem" }}>Tâches réalisées</div>
                    <div style={{ padding: "0.65rem 0.9rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}`, fontSize: "0.82rem", color: theme.textSecondary, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {inv.taches_realisees}
                    </div>
                  </div>
                )}
                {inv.observations_technicien && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <div style={{ fontSize: "0.7rem", color: theme.textMuted, marginBottom: "0.3rem" }}>Observations technicien</div>
                    <div style={{ padding: "0.65rem 0.9rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}`, fontSize: "0.82rem", color: theme.textSecondary, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {inv.observations_technicien}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Signature */}
            {inv.signature_data && (
              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Signature client</div>
                <img src={inv.signature_data} alt="Signature" style={{ maxWidth: 200, border: `1px solid ${theme.border}`, borderRadius: RADIUS.md, background: "#fff", padding: 8 }} />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="idet-footer" style={{ borderTop: `1px solid ${theme.border}` }}>
            {/* Actions statut */}
            <div className="idet-footer-left">
              {nextActions.map(a => (
                <button
                  key={a.statut}
                  onClick={() => a.isTerminer ? handleTerminer() : handleChangeStatus(a.statut, a.label)}
                  disabled={busy}
                  className="idet-btn-full"
                  style={{ padding: "0.55rem 0.9rem", borderRadius: RADIUS.md, border: `1px solid ${a.color}44`, background: "transparent", color: a.color, fontSize: "0.82rem", cursor: busy ? "not-allowed" : "pointer", fontFamily: FONTS.body, opacity: busy ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                  onMouseEnter={e => (e.currentTarget.style.background = a.color + "12")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >{a.label}</button>
              ))}
            </div>

            {/* Actions droite */}
            <div className="idet-footer-right">
              {inv.statut === "terminee" && (
                <button onClick={() => interventionsService.downloadPdf(inv.id, inv.client_nom ?? inv.client_libre_nom)}
                  className="idet-btn-full"
                  style={{ padding: "0.55rem 0.9rem", borderRadius: RADIUS.md, border: "1px solid rgba(16,185,129,0.4)", background: "transparent", color: "#10b981", fontSize: "0.82rem", cursor: "pointer", fontFamily: FONTS.body, display: "flex", alignItems: "center", gap: "0.3rem", justifyContent: "center" }}>
                  📄 PDF
                </button>
              )}
              {inv.statut !== "terminee" && (
                <button onClick={onEdit} className="idet-btn-full"
                  style={{ padding: "0.55rem 1.2rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
                  ✏️ Modifier
                </button>
              )}
              <button onClick={onClose} className="idet-btn-full"
                style={{ padding: "0.55rem 1rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
