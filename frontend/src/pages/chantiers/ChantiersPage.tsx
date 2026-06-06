// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/chantiers/ChantiersPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import chantiersService, { type Chantier, type UserMini } from "../../services/chantiersService";
import { useAuthStore } from "../../store/authStore";
import { useSwal } from "../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../theme";

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("fr-FR") : "—";

const STATUT_CFG = {
  en_attente: { label: "En attente", bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
  en_cours:   { label: "En cours",   bg: "rgba(0,119,182,0.12)",   text: "#0077b6" },
  termine:    { label: "Terminé",    bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  suspendu:   { label: "Suspendu",   bg: "rgba(204,34,34,0.12)",   text: "#cc2222" },
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
  @keyframes ch-spin { to { transform: rotate(360deg); } }
  .ch-header { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
  @media (min-width: 480px) { .ch-header { flex-direction: row; justify-content: space-between; align-items: flex-start; } }
  .ch-stats { display: grid; grid-template-columns: repeat(2,1fr); gap: 0.65rem; margin-bottom: 1.5rem; }
  @media (min-width: 640px) { .ch-stats { grid-template-columns: repeat(4,1fr); gap: 0.85rem; } }
  .ch-filters { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; align-items: center; }
  .ch-search { position: relative; flex: 1 1 180px; min-width: 150px; }
  .ch-table-wrap { display: none; }
  .ch-cards-wrap { display: flex; flex-direction: column; gap: 0.65rem; }
  @media (min-width: 768px) { .ch-table-wrap { display: block; } .ch-cards-wrap { display: none; } }
  .ch-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 500; display: flex; align-items: flex-end; justify-content: center; }
  @media (min-width: 640px) { .ch-overlay { align-items: center; padding: 0.5rem; } }
  .ch-modal { width: 100%; max-height: 96vh; overflow-y: auto; border-radius: 18px 18px 0 0; }
  @media (min-width: 640px) { .ch-modal { max-width: 560px; border-radius: 18px; } }
  .ch-modal-body { padding: 1rem; }
  @media (min-width: 640px) { .ch-modal-body { padding: 1.5rem; } }
  .ch-footer { display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; border-top: 1px solid; }
  @media (min-width: 480px) { .ch-footer { flex-direction: row; justify-content: flex-end; } }
  .ch-techlist { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.4rem; }
  .ch-tech-tag { font-size: 0.7rem; padding: 2px 8px; border-radius: 999px; }
`;

// ── Modal Chantier ─────────────────────────────────────────────────────────────
function ChantierModal({ theme, dark, chantier, techniciens, onClose, onSaved }: {
  theme: LayoutContext["theme"]; dark: boolean;
  chantier: Chantier | null; techniciens: UserMini[];
  onClose: () => void; onSaved: () => void;
}) {
  const swal    = useSwal();
  const [saving, setSaving] = useState(false);
  const isEdit  = !!chantier;

  const [form, setForm] = useState({
    nom:              chantier?.nom ?? "",
    description:      chantier?.description ?? "",
    adresse:          chantier?.adresse ?? "",
    date_debut:       chantier?.date_debut ?? "",
    date_fin_prevue:  chantier?.date_fin_prevue ?? "",
    statut:           chantier?.statut ?? "en_attente",
    techniciens_ids:  chantier?.techniciens ?? [] as number[],
  });

  const setF = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const toggleTech = (id: number) => {
    setForm(f => ({
      ...f,
      techniciens_ids: f.techniciens_ids.includes(id)
        ? f.techniciens_ids.filter(i => i !== id)
        : [...f.techniciens_ids, id],
    }));
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.65rem 0.9rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.9rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };
  const lbl: React.CSSProperties = { fontSize: "0.8rem", fontWeight: 600, color: theme.textSecondary, marginBottom: 4, display: "block" };
  const fieldWrap: React.CSSProperties = { marginBottom: "1rem" };

  const handleSave = async () => {
    if (!form.nom.trim() || !form.date_debut) {
      swal.error("Champs obligatoires", "Le nom et la date de début sont obligatoires."); return;
    }
    setSaving(true);
    try {
      const payload = {
        nom:              form.nom.trim(),
        description:      form.description || undefined,
        adresse:          form.adresse || undefined,
        date_debut:       form.date_debut,
        date_fin_prevue:  form.date_fin_prevue || null,
        statut:           form.statut,
        techniciens_ids:  form.techniciens_ids,
      };
      if (isEdit) {
        await chantiersService.update(chantier!.id, payload);
      } else {
        await chantiersService.create(payload);
      }
      onSaved();
      swal.success(isEdit ? "Chantier modifié." : "Chantier créé.");
    } catch {
      swal.error("Erreur", "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ch-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ch-modal" style={{ background: theme.cardBg }}>
        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem 0.75rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: theme.textPrimary }}>
            {isEdit ? "Modifier le chantier" : "Nouveau chantier"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted, fontSize: "1.2rem" }}>✕</button>
        </div>

        <div className="ch-modal-body">
          <div style={fieldWrap}>
            <label style={lbl}>Nom du chantier *</label>
            <input style={inp} value={form.nom} onChange={e => setF("nom", e.target.value)} placeholder="Ex: Chantier Dakar Centre" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
            <div>
              <label style={lbl}>Date de début *</label>
              <input type="date" style={inp} value={form.date_debut} onChange={e => setF("date_debut", e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Date de fin prévue</label>
              <input type="date" style={inp} value={form.date_fin_prevue} onChange={e => setF("date_fin_prevue", e.target.value)} />
            </div>
          </div>
          <div style={fieldWrap}>
            <label style={lbl}>Adresse</label>
            <input style={inp} value={form.adresse} onChange={e => setF("adresse", e.target.value)} placeholder="Adresse du chantier" />
          </div>
          <div style={fieldWrap}>
            <label style={lbl}>Statut</label>
            <select style={inp} value={form.statut} onChange={e => setF("statut", e.target.value)}>
              <option value="en_attente">En attente</option>
              <option value="en_cours">En cours</option>
              <option value="termine">Terminé</option>
              <option value="suspendu">Suspendu</option>
            </select>
          </div>
          <div style={fieldWrap}>
            <label style={lbl}>Description</label>
            <textarea style={{ ...inp, minHeight: 72, resize: "vertical" }} value={form.description} onChange={e => setF("description", e.target.value)} placeholder="Description du chantier..." />
          </div>
          <div style={fieldWrap}>
            <label style={lbl}>Techniciens affectés</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", padding: "0.5rem", border: `1px solid ${theme.border}`, borderRadius: RADIUS.md, minHeight: 50 }}>
              {techniciens.map(t => {
                const sel = form.techniciens_ids.includes(t.id);
                return (
                  <button key={t.id} onClick={() => toggleTech(t.id)}
                    style={{
                      fontSize: "0.75rem", padding: "4px 10px", borderRadius: RADIUS.full, cursor: "pointer",
                      border: `1px solid ${sel ? PALETTE.primary : theme.border}`,
                      background: sel ? `rgba(0,175,212,0.15)` : "transparent",
                      color: sel ? PALETTE.primary : theme.textSecondary, fontWeight: sel ? 600 : 400,
                    }}>
                    {t.full_name}
                  </button>
                );
              })}
              {techniciens.length === 0 && <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>Aucun technicien disponible</span>}
            </div>
          </div>
        </div>

        <div className="ch-footer" style={{ borderTopColor: theme.border }}>
          <button onClick={onClose} style={{ padding: "0.6rem 1.2rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textPrimary, cursor: "pointer", fontFamily: FONTS.body }}>
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: "0.6rem 1.4rem", borderRadius: RADIUS.md, border: "none", background: PALETTE.primary, color: "#fff", cursor: "pointer", fontWeight: 600, fontFamily: FONTS.body, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Enregistrement…" : isEdit ? "Modifier" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function ChantiersPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const { user } = useAuthStore();
  const swal     = useSwal();

  const [chantiers,   setChantiers]   = useState<Chantier[]>([]);
  const [techniciens, setTechniciens] = useState<UserMini[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [filterStat,  setFilterStat]  = useState("");
  const [total,       setTotal]       = useState(0);
  const [stats,       setStats]       = useState({ total: 0, en_attente: 0, en_cours: 0, termine: 0, suspendu: 0 });
  const [modal,       setModal]       = useState<"create" | Chantier | null>(null);

  const isAdmin = user?.permissions?.includes("all") || user?.is_staff;
  const canManage = isAdmin
    || user?.role?.toLowerCase().includes("responsable")
    || user?.permissions?.includes("chantiers");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search)     params.search = search;
      if (filterStat) params.statut = filterStat;
      const [res, st] = await Promise.all([
        chantiersService.list(params),
        chantiersService.stats(),
      ]);
      setChantiers(res.results);
      setTotal(res.count);
      setStats(st);
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, [search, filterStat]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (canManage) {
      chantiersService.techniciensDispo().then(setTechniciens).catch(() => {});
    }
  }, [canManage]);

  const handleSuspendre = async (c: Chantier) => {
    const ok = await swal.confirm({ title: `Suspendre "${c.nom}" ?`, text: "Le chantier passera en statut Suspendu.", confirmText: "Suspendre", danger: true });
    if (!ok) return;
    try {
      await chantiersService.update(c.id, { statut: "suspendu" });
      load();
      swal.info("Chantier suspendu.");
    } catch { swal.error("Erreur", "Impossible de suspendre."); }
  };

  const handleReactiver = async (c: Chantier) => {
    try {
      await chantiersService.update(c.id, { statut: "en_cours" });
      load();
      swal.success("Chantier réactivé.");
    } catch { swal.error("Erreur", "Impossible de réactiver."); }
  };

  const handleDelete = async (c: Chantier) => {
    const ok = await swal.confirmDelete(`le chantier "${c.nom}"`);
    if (!ok) return;
    try {
      await chantiersService.delete(c.id);
      load();
      swal.success("Chantier supprimé.");
    } catch {
      swal.error("Erreur", "Impossible de supprimer.");
    }
  };

  const card: React.CSSProperties = {
    background: theme.cardBg, borderRadius: RADIUS.lg,
    border: `1px solid ${theme.border}`, padding: "1rem 1.25rem",
  };
  const btn: React.CSSProperties = {
    padding: "0.6rem 1.25rem", borderRadius: RADIUS.md, border: "none",
    background: PALETTE.primary, color: "#fff", fontWeight: 600,
    cursor: "pointer", fontFamily: FONTS.body, fontSize: "0.88rem",
  };

  return (
    <>
      <style>{CSS}</style>

      {/* Header */}
      <div className="ch-header">
        <div>
          <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: theme.textPrimary }}>Chantiers</h1>
          <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: theme.textMuted }}>
            Gestion des zones de travail et affectation des techniciens
          </p>
        </div>
        {canManage && (
          <button style={btn} onClick={() => setModal("create")}>
            + Nouveau chantier
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="ch-stats">
        {[
          { label: "Total",      value: stats.total,      color: PALETTE.primary   },
          { label: "En cours",   value: stats.en_cours,   color: "#0077b6"         },
          { label: "En attente", value: stats.en_attente, color: "#f59e0b"         },
          { label: "Terminés",   value: stats.termine,    color: "#10b981"         },
        ].map(s => (
          <div key={s.label} style={{ ...card, textAlign: "center" as const }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="ch-filters">
        <div className="ch-search">
          <input
            style={{
              width: "100%", padding: "0.6rem 0.9rem 0.6rem 2.2rem",
              borderRadius: RADIUS.md, border: `1px solid ${theme.border}`,
              background: theme.inputBg, color: theme.textPrimary,
              fontSize: "0.88rem", fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" as const,
            }}
            placeholder="Rechercher un chantier…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <svg style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", opacity: 0.4, pointerEvents: "none" }} width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <select
          value={filterStat}
          onChange={e => setFilterStat(e.target.value)}
          style={{
            padding: "0.6rem 0.9rem", borderRadius: RADIUS.md,
            border: `1px solid ${theme.border}`, background: theme.inputBg,
            color: theme.textPrimary, fontSize: "0.88rem", fontFamily: FONTS.body, outline: "none",
          }}>
          <option value="">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="en_cours">En cours</option>
          <option value="termine">Terminé</option>
          <option value="suspendu">Suspendu</option>
        </select>
        <span style={{ fontSize: "0.78rem", color: theme.textMuted, marginLeft: "auto" }}>
          {total} chantier{total > 1 ? "s" : ""}
        </span>
      </div>

      {/* Table desktop */}
      <div className="ch-table-wrap" style={{ ...card, padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid ${theme.border}`, borderTopColor: PALETTE.primary, animation: "ch-spin 0.8s linear infinite" }} />
          </div>
        ) : chantiers.length === 0 ? (
          <div style={{ textAlign: "center" as const, padding: "3rem", color: theme.textMuted }}>Aucun chantier trouvé.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {["Nom", "Adresse", "Début", "Fin prévue", "Techniciens", "Statut", "Actions"].map(h => (
                  <th key={h} style={{ padding: "0.8rem 1rem", textAlign: "left" as const, fontSize: "0.72rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.05em", whiteSpace: "nowrap" as const }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chantiers.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < chantiers.length - 1 ? `1px solid ${theme.border}` : "none" }}>
                  <td style={{ padding: "0.8rem 1rem" }}>
                    <div style={{ fontWeight: 600, color: theme.textPrimary, fontSize: "0.88rem" }}>{c.nom}</div>
                    {c.description && <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 2 }}>{c.description.substring(0, 50)}{c.description.length > 50 ? "…" : ""}</div>}
                  </td>
                  <td style={{ padding: "0.8rem 1rem", fontSize: "0.82rem", color: theme.textSecondary }}>{c.adresse || "—"}</td>
                  <td style={{ padding: "0.8rem 1rem", fontSize: "0.82rem", color: theme.textSecondary, whiteSpace: "nowrap" as const }}>{fmtDate(c.date_debut)}</td>
                  <td style={{ padding: "0.8rem 1rem", fontSize: "0.82rem", color: theme.textSecondary, whiteSpace: "nowrap" as const }}>{fmtDate(c.date_fin_prevue)}</td>
                  <td style={{ padding: "0.8rem 1rem" }}>
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "0.3rem" }}>
                      {c.techniciens_detail.slice(0, 3).map(t => (
                        <span key={t.id} style={{ fontSize: "0.68rem", padding: "2px 7px", borderRadius: RADIUS.full, background: "rgba(0,175,212,0.12)", color: PALETTE.primary }}>
                          {t.full_name}
                        </span>
                      ))}
                      {c.techniciens_detail.length > 3 && (
                        <span style={{ fontSize: "0.68rem", padding: "2px 7px", borderRadius: RADIUS.full, background: theme.border, color: theme.textMuted }}>
                          +{c.techniciens_detail.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "0.8rem 1rem" }}><StatutBadge statut={c.statut} /></td>
                  <td style={{ padding: "0.8rem 1rem" }}>
                    {canManage && (
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" as const }}>
                        <button onClick={() => setModal(c)} style={{ fontSize: "0.72rem", padding: "3px 8px", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: PALETTE.primary, cursor: "pointer" }}>
                          Modifier
                        </button>
                        {c.statut === "suspendu" ? (
                          <button onClick={() => handleReactiver(c)} style={{ fontSize: "0.72rem", padding: "3px 8px", borderRadius: RADIUS.md, border: `1px solid rgba(16,185,129,0.4)`, background: "transparent", color: "#10b981", cursor: "pointer" }}>
                            Réactiver
                          </button>
                        ) : c.statut !== "termine" && (
                          <button onClick={() => handleSuspendre(c)} style={{ fontSize: "0.72rem", padding: "3px 8px", borderRadius: RADIUS.md, border: `1px solid rgba(245,158,11,0.4)`, background: "transparent", color: "#f59e0b", cursor: "pointer" }}>
                            Suspendre
                          </button>
                        )}
                        <button onClick={() => handleDelete(c)} style={{ fontSize: "0.72rem", padding: "3px 8px", borderRadius: RADIUS.md, border: `1px solid rgba(204,34,34,0.3)`, background: "transparent", color: "#cc2222", cursor: "pointer" }}>
                          Suppr.
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
      <div className="ch-cards-wrap">
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: `3px solid ${theme.border}`, borderTopColor: PALETTE.primary, animation: "ch-spin 0.8s linear infinite" }} />
          </div>
        ) : chantiers.length === 0 ? (
          <div style={{ textAlign: "center" as const, padding: "2rem", color: theme.textMuted }}>Aucun chantier trouvé.</div>
        ) : (
          chantiers.map(c => (
            <div key={c.id} style={{ ...card, display: "flex", flexDirection: "column" as const, gap: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontWeight: 700, color: theme.textPrimary, fontSize: "0.9rem" }}>{c.nom}</span>
                <StatutBadge statut={c.statut} />
              </div>
              {c.adresse && <div style={{ fontSize: "0.78rem", color: theme.textMuted }}>📍 {c.adresse}</div>}
              <div style={{ fontSize: "0.78rem", color: theme.textSecondary }}>
                Début : {fmtDate(c.date_debut)}{c.date_fin_prevue ? ` · Fin prévue : ${fmtDate(c.date_fin_prevue)}` : ""}
              </div>
              {c.techniciens_detail.length > 0 && (
                <div className="ch-techlist">
                  {c.techniciens_detail.map(t => (
                    <span key={t.id} className="ch-tech-tag" style={{ background: "rgba(0,175,212,0.12)", color: PALETTE.primary }}>{t.full_name}</span>
                  ))}
                </div>
              )}
              {canManage && (
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", flexWrap: "wrap" as const }}>
                  <button onClick={() => setModal(c)} style={{ flex: 1, padding: "0.45rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: PALETTE.primary, cursor: "pointer", fontSize: "0.8rem" }}>
                    Modifier
                  </button>
                  {c.statut === "suspendu" ? (
                    <button onClick={() => handleReactiver(c)} style={{ flex: 1, padding: "0.45rem", borderRadius: RADIUS.md, border: `1px solid rgba(16,185,129,0.4)`, background: "transparent", color: "#10b981", cursor: "pointer", fontSize: "0.8rem" }}>
                      Réactiver
                    </button>
                  ) : c.statut !== "termine" && (
                    <button onClick={() => handleSuspendre(c)} style={{ flex: 1, padding: "0.45rem", borderRadius: RADIUS.md, border: `1px solid rgba(245,158,11,0.4)`, background: "transparent", color: "#f59e0b", cursor: "pointer", fontSize: "0.8rem" }}>
                      Suspendre
                    </button>
                  )}
                  <button onClick={() => handleDelete(c)} style={{ flex: 1, padding: "0.45rem", borderRadius: RADIUS.md, border: `1px solid rgba(204,34,34,0.3)`, background: "transparent", color: "#cc2222", cursor: "pointer", fontSize: "0.8rem" }}>
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {modal !== null && (
        <ChantierModal
          theme={theme} dark={dark}
          chantier={modal === "create" ? null : modal}
          techniciens={techniciens}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </>
  );
}
