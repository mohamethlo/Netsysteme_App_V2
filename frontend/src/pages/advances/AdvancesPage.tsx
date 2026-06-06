import React, { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import {
  advancesService,
  type SalaryAdvance,
  type AdvanceDashboard,
  type Employee,
} from "../../services/advancesService";
import { useSwal } from "../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../theme";

const fmt     = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtDate = (s: string) => new Date(s).toLocaleDateString("fr-FR");

const STATUT_CFG = {
  en_attente: { label: "En attente", bg: "rgba(245,158,11,0.12)",  text: "#f59e0b", icon: "⏳" },
  approuve:   { label: "Approuvée",  bg: "rgba(16,185,129,0.12)",  text: "#10b981", icon: "✅" },
  refuse:     { label: "Refusée",    bg: "rgba(239,68,68,0.12)",   text: "#ef4444", icon: "❌" },
} as const;

function StatutBadge({ statut }: { statut: string }) {
  const cfg = STATUT_CFG[statut as keyof typeof STATUT_CFG] ?? STATUT_CFG.en_attente;
  return (
    <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "3px 9px", borderRadius: RADIUS.full, background: cfg.bg, color: cfg.text, whiteSpace: "nowrap" }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

const CSS = `
  @keyframes adv-spin { to { transform: rotate(360deg); } }

  .adv-header {
    display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;
  }
  @media (min-width: 480px) {
    .adv-header { flex-direction: row; justify-content: space-between; align-items: flex-start; }
  }

  .adv-stats {
    display: grid; grid-template-columns: repeat(2,1fr); gap: 0.65rem; margin-bottom: 1.5rem;
  }
  @media (min-width: 480px) { .adv-stats { grid-template-columns: repeat(3,1fr); } }
  @media (min-width: 900px) { .adv-stats { grid-template-columns: repeat(6,1fr); gap: 0.85rem; } }

  .adv-filters {
    display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; align-items: center;
  }
  .adv-search { position: relative; flex: 1 1 180px; min-width: 150px; }
  .adv-count  { flex: 0 0 auto; margin-left: auto; font-size: 0.78rem; white-space: nowrap; }

  .adv-table-wrap { display: none; }
  .adv-cards-wrap { display: flex; flex-direction: column; gap: 0.65rem; }
  @media (min-width: 768px) {
    .adv-table-wrap { display: block; }
    .adv-cards-wrap { display: none; }
  }

  .adv-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    z-index: 500; display: flex; align-items: flex-end; justify-content: center;
  }
  @media (min-width: 640px) {
    .adv-overlay { align-items: center; padding: 0.5rem; }
  }
  .adv-modal {
    width: 100%; max-height: 96vh; overflow-y: auto; border-radius: 18px 18px 0 0;
  }
  @media (min-width: 640px) {
    .adv-modal { max-width: 540px; border-radius: 18px; }
  }
  .adv-modal-body { padding: 1rem; }
  @media (min-width: 640px) { .adv-modal-body { padding: 1.5rem; } }

  .adv-footer {
    display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; border-top: 1px solid;
  }
  @media (min-width: 480px) {
    .adv-footer { flex-direction: row; justify-content: flex-end; }
  }
`;

// ── Modal nouvelle demande ─────────────────────────────────────────────────────
function NewAdvanceModal({ theme, dark, isAdmin, onClose, onSaved }: {
  theme: LayoutContext["theme"]; dark: boolean;
  isAdmin: boolean; onClose: () => void; onSaved: () => void;
}) {
  const swal = useSwal();
  const [saving,     setSaving]     = useState(false);
  const [montant,    setMontant]    = useState("");
  const [motif,      setMotif]      = useState("");
  const [userId,     setUserId]     = useState("");
  const [employees,  setEmployees]  = useState<Employee[]>([]);
  const [loadingEmp, setLoadingEmp] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    setLoadingEmp(true);
    advancesService.getEmployees()
      .then(setEmployees)
      .catch(() => {})
      .finally(() => setLoadingEmp(false));
  }, [isAdmin]);

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
    const m = parseFloat(montant);
    if (!m || m <= 0)              { swal.error("Requis", "Entrez un montant valide."); return; }
    if (!motif.trim())             { swal.error("Requis", "Le motif est obligatoire."); return; }
    if (isAdmin && !userId)        { swal.error("Requis", "Sélectionnez un employé."); return; }
    setSaving(true);
    try {
      await advancesService.create({
        montant: m,
        motif:   motif.trim(),
        ...(isAdmin && userId ? { user_id: parseInt(userId) } : {}),
      });
      swal.saved("La demande");
      onSaved();
    } catch (err: any) {
      swal.error("Erreur", err?.response?.data?.detail ?? "Une erreur est survenue.");
    } finally { setSaving(false); }
  };

  const selectedEmp = employees.find(e => e.id === parseInt(userId));

  return (
    <div className="adv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="adv-modal" style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

        {/* Header */}
        <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: theme.popupBg, zIndex: 2, borderRadius: "18px 18px 0 0" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: theme.textPrimary, marginBottom: 2 }}>
              💰 Nouvelle demande d'avance
            </h2>
            <p style={{ fontSize: "0.75rem", color: theme.textMuted }}>
              {isAdmin ? "Créez une demande pour un employé" : "Votre demande sera examinée par l'administration"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="adv-modal-body">
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

              {/* ── Select employé (admin seulement) ── */}
              {isAdmin && (
                <div>
                  <label style={lbl}>
                    Employé <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  {loadingEmp ? (
                    <div style={{ padding: "0.65rem 0.9rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textMuted, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: 14, height: 14, border: `2px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "adv-spin 0.7s linear infinite", flexShrink: 0 }} />
                      Chargement des employés…
                    </div>
                  ) : (
                    <select required value={userId} onChange={e => setUserId(e.target.value)}
                      style={{ ...inp, cursor: "pointer" }}>
                      <option value="">— Sélectionner un employé —</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.nom}
                          {emp.role ? ` — ${emp.role}` : ""}
                          {emp.site ? ` (${emp.site})` : ""}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Aperçu employé sélectionné */}
                  {selectedEmp && (
                    <div style={{ marginTop: "0.5rem", padding: "0.65rem 0.9rem", borderRadius: RADIUS.md, background: `rgba(0,175,212,0.06)`, border: `1px solid rgba(0,175,212,0.2)`, display: "flex", alignItems: "center", gap: "0.65rem" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "0.9rem", flexShrink: 0 }}>
                        {selectedEmp.nom.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: theme.textPrimary, fontSize: "0.875rem" }}>{selectedEmp.nom}</div>
                        <div style={{ fontSize: "0.72rem", color: theme.textMuted }}>
                          {[selectedEmp.role, selectedEmp.site].filter(Boolean).join(" · ") || "Aucun rôle défini"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Montant */}
              <div>
                <label style={lbl}>
                  Montant (F CFA) <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input required type="number" min="1" step="1" value={montant}
                  onChange={e => setMontant(e.target.value)}
                  placeholder="Ex : 50 000" style={inp} />
                {montant && parseFloat(montant) > 0 && (
                  <div style={{ marginTop: "0.3rem", fontSize: "0.75rem", color: PALETTE.primary, fontWeight: 600 }}>
                    ≈ {fmt(parseFloat(montant))} F CFA
                  </div>
                )}
              </div>

              {/* Motif */}
              <div>
                <label style={lbl}>
                  Motif <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <textarea required rows={4} value={motif}
                  onChange={e => setMotif(e.target.value)}
                  placeholder="Expliquez la raison de la demande d'avance…"
                  style={{ ...inp, resize: "vertical" as const }} />
                <div style={{ marginTop: "0.25rem", fontSize: "0.7rem", color: theme.textMuted, textAlign: "right" }}>
                  {motif.length} caractère{motif.length > 1 ? "s" : ""}
                </div>
              </div>

              {/* Info */}
              <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(6,182,212,0.06)", border: `1px solid rgba(6,182,212,0.2)`, fontSize: "0.82rem", color: theme.textSecondary }}>
                {isAdmin
                  ? "💡 En tant qu'administrateur, vous créez cette demande au nom de l'employé sélectionné."
                  : "💡 Votre demande sera soumise à l'approbation de l'administration."}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="adv-footer" style={{ borderTopColor: theme.border }}>
            <button type="submit" disabled={saving}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? `${PALETTE.primary}66` : `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.9rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
              {saving
                ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "adv-spin 0.7s linear infinite", display: "inline-block" }} /> Envoi…</>
                : "📤 Envoyer la demande"}
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

// ── Modal décision admin ───────────────────────────────────────────────────────
function DecisionModal({ theme, dark, advance, action, onClose, onSaved }: {
  theme: LayoutContext["theme"]; dark: boolean;
  advance: SalaryAdvance; action: "approve" | "refuse";
  onClose: () => void; onSaved: () => void;
}) {
  const swal      = useSwal();
  const [saving, setSaving] = useState(false);
  const [notes,  setNotes]  = useState("");
  const isApprove = action === "approve";
  const color     = isApprove ? "#10b981" : "#ef4444";

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.65rem 0.9rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.9rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const, resize: "vertical" as const,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isApprove) await advancesService.approve(advance.id, notes || undefined);
      else           await advancesService.refuse(advance.id,  notes || undefined);
      swal.success(isApprove ? "Avance approuvée !" : "Avance refusée.");
      onSaved();
    } catch (err: any) {
      swal.error("Erreur", err?.response?.data?.detail ?? "Une erreur est survenue.");
    } finally { setSaving(false); }
  };

  return (
    <div className="adv-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="adv-modal" style={{ background: theme.popupBg, border: `2px solid ${color}33`, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

        {/* Header */}
        <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: `${color}09`, borderRadius: "18px 18px 0 0" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color, marginBottom: 2 }}>
              {isApprove ? "✅ Approuver la demande" : "❌ Refuser la demande"}
            </h2>
            <p style={{ fontSize: "0.75rem", color: theme.textMuted }}>
              {advance.user_nom} — {fmt(advance.montant)} F CFA
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="adv-modal-body">
            {/* Récap */}
            <div style={{ padding: "0.85rem 1rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}`, marginBottom: "1rem" }}>
              {([
                ["Demandeur",  advance.user_nom     ?? "—"],
                ["Montant",    `${fmt(advance.montant)} F CFA`],
                ["Date",       fmtDate(advance.date_demande)],
                ["Motif",      advance.motif         ?? "—"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0.38rem 0", borderBottom: `1px solid ${theme.border}` }}>
                  <span style={{ fontSize: "0.78rem", color: theme.textMuted, flexShrink: 0, marginRight: "1rem" }}>{k}</span>
                  <span style={{ fontSize: "0.85rem", color: theme.textPrimary, fontWeight: 500, textAlign: "right" }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Note */}
            <div>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: theme.textSecondary, marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Note (optionnel)
              </label>
              <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={isApprove ? "Message d'approbation…" : "Raison du refus…"}
                style={inp} />
            </div>
          </div>

          {/* Footer */}
          <div className="adv-footer" style={{ borderTopColor: theme.border }}>
            <button type="submit" disabled={saving}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? color + "66" : color, color: "#fff", fontSize: "0.9rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
              {saving
                ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "adv-spin 0.7s linear infinite", display: "inline-block" }} /> Traitement…</>
                : isApprove ? "✅ Confirmer l'approbation" : "❌ Confirmer le refus"}
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

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon, theme, onClick }: {
  label: string; value: string | number; color: string;
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
export default function AdvancesPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const swal = useSwal();

  const [advances,  setAdvances]  = useState<SalaryAdvance[]>([]);
  const [dashboard, setDashboard] = useState<AdvanceDashboard | null>(null);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [isAdmin,   setIsAdmin]   = useState(false);

  const [search,  setSearch]  = useState("");
  const [statutF, setStatutF] = useState("");
  const [page,    setPage]    = useState(1);
  const PAGE_SIZE = 15;

  const [showNew,      setShowNew]      = useState(false);
  const [showDecision, setShowDecision] = useState(false);
  const [selected,     setSelected]     = useState<SalaryAdvance | null>(null);
  const [decAction,    setDecAction]    = useState<"approve" | "refuse">("approve");

  // ── Détection admin propre ──────────────────────────────────────────────────
  useEffect(() => {
    advancesService.getEmployees()
      .then(() => setIsAdmin(true))
      .catch(() => setIsAdmin(false));
  }, []);

  // ── Chargement données ──────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: PAGE_SIZE };
      if (search)  params.search = search;
      if (statutF) params.statut = statutF;

      const [res, dash] = await Promise.all([
        advancesService.getAll(params),
        advancesService.getDashboard(),
      ]);
      setAdvances(res.results);
      setTotal(res.count);
      setDashboard(dash);
    } catch { swal.serverError(); }
    finally   { setLoading(false); }
  }, [page, search, statutF]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statutF]);

  const handleDelete = async (adv: SalaryAdvance) => {
    if (!await swal.confirmDelete(`la demande du ${fmtDate(adv.date_demande)}`)) return;
    try { await advancesService.delete(adv.id); swal.deleted("La demande"); load(); }
    catch { swal.serverError(); }
  };

  const openDecision = (adv: SalaryAdvance, action: "approve" | "refuse") => {
    setSelected(adv); setDecAction(action); setShowDecision(true);
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
      <div className="adv-header">
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontSize: "1.4rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>
            💰 Avances sur salaire
          </h1>
          <p style={{ fontSize: "0.82rem", color: theme.textMuted, marginTop: 3 }}>
            Gestion des demandes d'avances sur salaire
          </p>
        </div>
        <button onClick={() => setShowNew(true)}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.65rem 1.2rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap" }}>
          + Nouvelle demande
        </button>
      </div>

      {/* ── Stats ── */}
      {dashboard && (
        <div className="adv-stats">
          <StatCard label="Total"            value={dashboard.total}                       color={PALETTE.primary} icon="📋" theme={theme} onClick={() => setStatutF("")} />
          <StatCard label="En attente"       value={dashboard.en_attente}                  color="#f59e0b"         icon="⏳" theme={theme} onClick={() => setStatutF("en_attente")} />
          <StatCard label="Approuvées"       value={dashboard.approuve}                    color="#10b981"         icon="✅" theme={theme} onClick={() => setStatutF("approuve")} />
          <StatCard label="Refusées"         value={dashboard.refuse}                      color="#ef4444"         icon="❌" theme={theme} onClick={() => setStatutF("refuse")} />
          <StatCard label="Montant approuvé" value={`${fmt(dashboard.montant_total)} F`}   color="#10b981"         icon="💵" theme={theme} />
          <StatCard label="En attente (F)"   value={`${fmt(dashboard.montant_attente)} F`} color="#f59e0b"         icon="⏱" theme={theme} />
        </div>
      )}

      {/* ── Alerte admin ── */}
      {dashboard && dashboard.en_attente > 0 && isAdmin && (
        <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <span style={{ fontSize: "1.1rem" }}>⏳</span>
          <span style={{ fontSize: "0.85rem", color: theme.textPrimary }}>
            <strong>{dashboard.en_attente}</strong> demande{dashboard.en_attente > 1 ? "s" : ""} en attente de traitement
            {dashboard.montant_attente > 0 && <> — <strong>{fmt(dashboard.montant_attente)} F CFA</strong> au total</>}.
          </span>
        </div>
      )}

      {/* ── Filtres ── */}
      <div className="adv-filters">
        <div className="adv-search">
          <span style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted, pointerEvents: "none", fontSize: "0.85rem" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
            style={{ ...inp, paddingLeft: "2.2rem" }} />
        </div>

        {(["", "en_attente", "approuve", "refuse"] as const).map(f => {
          const cfg = f === "" ? { label: "Toutes", color: PALETTE.primary } : { label: STATUT_CFG[f].label, color: STATUT_CFG[f].text };
          return (
            <button key={f} onClick={() => setStatutF(f)}
              style={{ padding: "0.48rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${statutF === f ? cfg.color : theme.border}`, background: statutF === f ? cfg.color + "14" : "transparent", color: statutF === f ? cfg.color : theme.textMuted, fontSize: "0.8rem", fontWeight: statutF === f ? 600 : 400, cursor: "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap", transition: "all 0.15s" }}>
              {f === "" ? "📋 Toutes" : `${STATUT_CFG[f].icon} ${cfg.label}`}
            </button>
          );
        })}

        <span className="adv-count" style={{ color: theme.textMuted }}>
          {total} demande{total > 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <div style={{ width: 34, height: 34, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "adv-spin 0.8s linear infinite" }} />
        </div>
      ) : advances.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>💰</div>
          <div style={{ fontWeight: 600, color: theme.textPrimary, marginBottom: "0.5rem" }}>
            {search || statutF ? "Aucun résultat" : "Aucune demande d'avance"}
          </div>
          <div style={{ fontSize: "0.875rem", color: theme.textMuted, marginBottom: "1.25rem" }}>
            {search || statutF ? "Modifiez vos filtres" : "Créez votre première demande"}
          </div>
          {!search && !statutF && (
            <button onClick={() => setShowNew(true)}
              style={{ padding: "0.65rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
              + Nouvelle demande
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── Tableau desktop ── */}
          <div className="adv-table-wrap" style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {[
                      "Date",
                      ...(isAdmin ? ["Employé"] : []),
                      "Montant",
                      "Motif",
                      "Statut",
                      "Notes admin",
                      "Actions",
                    ].map(h => (
                      <th key={h} style={{ padding: "0.7rem 1rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {advances.map((adv, i) => (
                    <tr key={adv.id}
                      style={{ borderBottom: i < advances.length - 1 ? `1px solid ${theme.border}` : "none", transition: "background 0.12s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 600, color: theme.textPrimary, fontSize: "0.82rem" }}>
                          {fmtDate(adv.date_demande)}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: theme.textMuted }}>
                          {new Date(adv.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>

                      {isAdmin && (
                        <td style={{ padding: "0.85rem 1rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "0.78rem", flexShrink: 0 }}>
                              {(adv.user_nom ?? "?").charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 500, color: theme.textSecondary, fontSize: "0.85rem" }}>
                              {adv.user_nom ?? "—"}
                            </span>
                          </div>
                        </td>
                      )}

                      <td style={{ padding: "0.85rem 1rem", fontWeight: 700, color: PALETTE.primary, whiteSpace: "nowrap" }}>
                        {fmt(adv.montant)} F
                      </td>
                      <td style={{ padding: "0.85rem 1rem", color: theme.textSecondary, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.82rem" }}>
                        {adv.motif ?? "—"}
                      </td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <StatutBadge statut={adv.statut} />
                      </td>
                      <td style={{ padding: "0.85rem 1rem", color: theme.textMuted, fontSize: "0.8rem", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {adv.notes_admin ?? "—"}
                        {adv.approved_by_nom && (
                          <div style={{ fontSize: "0.68rem", color: theme.textMuted, marginTop: 2 }}>
                            par {adv.approved_by_nom}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <div style={{ display: "flex", gap: "0.3rem" }}>
                          {isAdmin && adv.statut === "en_attente" && (
                            <>
                              <button onClick={() => openDecision(adv, "approve")}
                                style={{ padding: "0.3rem 0.65rem", borderRadius: RADIUS.md, border: "1px solid rgba(16,185,129,0.4)", background: "transparent", color: "#10b981", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600, fontFamily: FONTS.body, whiteSpace: "nowrap" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(16,185,129,0.1)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                              >✅ Approuver</button>
                              <button onClick={() => openDecision(adv, "refuse")}
                                style={{ padding: "0.3rem 0.65rem", borderRadius: RADIUS.md, border: "1px solid rgba(239,68,68,0.4)", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600, fontFamily: FONTS.body, whiteSpace: "nowrap" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                              >❌ Refuser</button>
                            </>
                          )}
                          {!isAdmin && adv.statut === "en_attente" && (
                            <button onClick={() => handleDelete(adv)}
                              style={{ width: 28, height: 28, borderRadius: RADIUS.md, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "0.78rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              🗑
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Cartes mobiles ── */}
          <div className="adv-cards-wrap">
            {advances.map(adv => (
              <div key={adv.id} style={{ background: theme.cardBg, border: `1px solid ${adv.statut === "en_attente" ? "rgba(245,158,11,0.3)" : theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
                {/* Haut */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.65rem 1rem", borderBottom: `1px solid ${theme.border}`, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
                  <StatutBadge statut={adv.statut} />
                  <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>{fmtDate(adv.date_demande)}</span>
                </div>

                {/* Corps */}
                <div style={{ padding: "0.85rem 1rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                  {isAdmin && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "0.75rem", flexShrink: 0 }}>
                        {(adv.user_nom ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: theme.textPrimary, fontSize: "0.9rem" }}>
                        {adv.user_nom ?? "—"}
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.82rem", color: theme.textMuted }}>Montant</span>
                    <span style={{ fontWeight: 800, color: PALETTE.primary, fontSize: "1rem" }}>
                      {fmt(adv.montant)} F
                    </span>
                  </div>
                  {adv.motif && (
                    <div style={{ fontSize: "0.82rem", color: theme.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      📝 {adv.motif}
                    </div>
                  )}
                  {adv.notes_admin && (
                    <div style={{ fontSize: "0.78rem", color: theme.textMuted, padding: "0.4rem 0.65rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}` }}>
                      💬 {adv.notes_admin}
                      {adv.approved_by_nom && (
                        <span style={{ marginLeft: "0.4rem", opacity: 0.7 }}>— {adv.approved_by_nom}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {((isAdmin && adv.statut === "en_attente") || (!isAdmin && adv.statut === "en_attente")) && (
                  <div style={{ display: "flex", borderTop: `1px solid ${theme.border}` }}>
                    {isAdmin ? (
                      <>
                        <button onClick={() => openDecision(adv, "approve")}
                          style={{ flex: 1, padding: "0.65rem", border: "none", borderRight: `1px solid ${theme.border}`, background: "transparent", color: "#10b981", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(16,185,129,0.08)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >✅ Approuver</button>
                        <button onClick={() => openDecision(adv, "refuse")}
                          style={{ flex: 1, padding: "0.65rem", border: "none", background: "transparent", color: "#ef4444", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >❌ Refuser</button>
                      </>
                    ) : (
                      <button onClick={() => handleDelete(adv)}
                        style={{ flex: 1, padding: "0.65rem", border: "none", background: "transparent", color: "#ef4444", fontSize: "0.82rem", cursor: "pointer", fontFamily: FONTS.body }}>
                        🗑 Annuler ma demande
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
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
        <NewAdvanceModal
          theme={theme} dark={dark} isAdmin={isAdmin}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }}
        />
      )}
      {showDecision && selected && (
        <DecisionModal
          theme={theme} dark={dark}
          advance={selected} action={decAction}
          onClose={() => { setShowDecision(false); setSelected(null); }}
          onSaved={() => { setShowDecision(false); setSelected(null); load(); }}
        />
      )}
    </div>
  );
}