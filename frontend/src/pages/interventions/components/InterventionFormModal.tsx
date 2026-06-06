import { useState } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { interventionsService, type Intervention, type Technicien } from "../../../services/interventionsService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark:          boolean;
  theme:         LayoutContext["theme"];
  intervention:  Intervention | null;
  technicians:   Technicien[];
  responsables:  Technicien[];
  userRole:      string;
  onClose:       () => void;
  onSaved:       () => void;
}

const TYPE_OPTIONS = [
  "Installation", "Maintenance", "Installation Vidéo surveillance filaire",
  "Installation Vidéo surveillance sans-fil", "Installation Téléphonique",
  "Installation Sécurité Incendie", "Réseau informatique", "Entretien parc",
  "Installation logiciel", "MAJ version logiciel", "Dépannage",
  "Centrale téléphonique", "Formation initiale", "Autres",
];

const CSS = `
  @keyframes iform-spin { to { transform: rotate(360deg); } }

  .iform-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    z-index: 500; display: flex; align-items: flex-end; justify-content: center;
  }
  @media (min-width: 640px) {
    .iform-overlay { align-items: center; padding: 0.5rem; }
  }

  .iform-modal {
    width: 100%; max-height: 98vh; overflow-y: auto; border-radius: 18px 18px 0 0;
  }
  @media (min-width: 640px) {
    .iform-modal { max-width: 820px; border-radius: 18px; max-height: 96vh; }
  }

  .iform-body { padding: 1rem; }
  @media (min-width: 640px) { .iform-body { padding: 1.5rem; } }

  .iform-grid2 { display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
  @media (min-width: 480px) { .iform-grid2 { grid-template-columns: 1fr 1fr; } }

  .iform-grid3 { display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
  @media (min-width: 480px) { .iform-grid3 { grid-template-columns: 1fr 1fr; } }
  @media (min-width: 768px) { .iform-grid3 { grid-template-columns: repeat(3,1fr); } }

  .iform-footer {
    display: flex; flex-direction: column; gap: 0.5rem;
    padding: 1rem; border-top: 1px solid;
  }
  @media (min-width: 480px) {
    .iform-footer { flex-direction: row; justify-content: flex-end; }
  }
`;

export default function InterventionFormModal({ dark, theme, intervention, technicians, responsables, userRole, onClose, onSaved }: Props) {
  const swal   = useSwal();
  const isEdit = !!intervention;
  const isCommercial = ["commercial", "Commercial"].includes(userRole);
  const isRT         = ["Responsable Technique", "responsable_technique"].includes(userRole);
  const isAdmin      = ["Administrateur", "Dev_administration", "administration"].includes(userRole);
  const [saving, setSaving] = useState(false);
  const [clientLibre, setClientLibre] = useState(!intervention?.client && !!intervention?.client_libre_nom);

  const [form, setForm] = useState({
    description:           intervention?.description           ?? "",
    client_libre_nom:      intervention?.client_libre_nom      ?? "",
    client_libre_telephone:intervention?.client_libre_telephone?? "",
    technicien:            intervention?.technicien?.toString() ?? "",
    responsable:           intervention?.responsable?.toString() ?? "",
    autres_intervenants:   intervention?.autres_intervenants   ?? [] as number[],
    date_prevue:           intervention?.date_prevue
      ? new Date(intervention.date_prevue).toISOString().slice(0, 16)
      : "",
    duree_estimee:         intervention?.duree_estimee?.toString() ?? "",
    type_intervention:     intervention?.type_intervention     ?? "",
    priorite:              intervention?.priorite              ?? "normale",
    adresse:               intervention?.adresse               ?? "",
    notes:                 intervention?.notes                 ?? "",
    statut:                intervention?.statut                ?? "planifiee",
    // Champs terrain
    taches_realisees:      intervention?.taches_realisees      ?? "",
    observations_technicien:intervention?.observations_technicien ?? "",
    heure_arrivee:         intervention?.heure_arrivee         ?? "",
    heure_depart:          intervention?.heure_depart          ?? "",
    id_dvr_nvr:            intervention?.id_dvr_nvr            ?? "",
    mdp_dvr_nvr:           intervention?.mdp_dvr_nvr           ?? "",
  });

  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

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
    <div style={{ fontSize: "0.68rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ flex: 1, height: 1, background: theme.border }} />{title}<div style={{ flex: 1, height: 1, background: theme.border }} />
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date_prevue)       { swal.error("Requis", "La date prévue est obligatoire."); return; }
    if (!form.type_intervention) { swal.error("Requis", "Le type est obligatoire."); return; }

    setSaving(true);
    try {
        const payload: any = {
        description:            form.description             || null,
        client_libre_nom:       clientLibre ? form.client_libre_nom       || null : null,
        client_libre_telephone: clientLibre ? form.client_libre_telephone  || null : null,
        client:                 clientLibre ? null : undefined,
        technicien:             form.technicien  ? parseInt(form.technicien)  : null,
        responsable:            form.responsable ? parseInt(form.responsable) : null,
        autres_intervenants:    form.autres_intervenants,
        date_prevue:            form.date_prevue,
        duree_estimee:          form.duree_estimee ? parseInt(form.duree_estimee) : null,
        type_intervention:      form.type_intervention,
        priorite:               form.priorite,
        adresse:                form.adresse     || null,
        notes:                  form.notes       || null,
        statut:                 form.statut,
        // ── Champs optionnels : "" → null ──────────────────────────────────────
        taches_realisees:        form.taches_realisees        || null,
        observations_technicien: form.observations_technicien || null,
        heure_arrivee:           form.heure_arrivee           || null,
        heure_depart:            form.heure_depart            || null,
        id_dvr_nvr:              form.id_dvr_nvr              || null,
        mdp_dvr_nvr:             form.mdp_dvr_nvr             || null,
        };

        if (isEdit) {
        await interventionsService.update(intervention!.id, payload);
        swal.updated("L'intervention");
        } else {
        await interventionsService.create(payload);
        swal.saved("L'intervention");
        }
        onSaved();
    } catch (err: any) {
        const d = err?.response?.data;
        const msg = d?.detail ?? d?.date_prevue?.[0] ?? d?.type_intervention?.[0] ?? JSON.stringify(d) ?? "Une erreur est survenue.";
        swal.error("Erreur", msg);
    } finally { setSaving(false); }
    };

  return (
    <>
      <style>{CSS}</style>
      <div className="iform-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="iform-modal" style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

          {/* Header */}
          <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: theme.popupBg, zIndex: 2, borderRadius: "18px 18px 0 0" }}>
            <div>
              <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: theme.textPrimary, marginBottom: 2 }}>
                {isEdit ? `Modifier intervention #${intervention!.id}` : "Nouvelle intervention"}
              </h2>
              <p style={{ fontSize: "0.75rem", color: theme.textMuted }}>
                {isEdit ? "Modifiez les informations" : "Renseignez les informations de l'intervention"}
              </p>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1, flexShrink: 0 }}>✕</button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="iform-body">

              {/* ── Infos principales ── */}
              <div style={{ marginBottom: "1.25rem" }}>
                {sep("Informations générales")}
                <div className="iform-grid3" style={{ marginBottom: "0.75rem" }}>
                  <div>
                    <label style={lbl}>Type d'intervention *</label>
                    <select required value={form.type_intervention} onChange={e => setF("type_intervention", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                      <option value="">— Sélectionner —</option>
                      {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Date prévue *</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", overflow: "hidden" }}>
                      <input
                        required
                        type="date"
                        value={form.date_prevue ? form.date_prevue.slice(0, 10) : ""}
                        onChange={e => {
                          const time = form.date_prevue ? form.date_prevue.slice(11, 16) || "00:00" : "00:00";
                          setF("date_prevue", e.target.value ? `${e.target.value}T${time}` : "");
                        }}
                        style={{ ...inp, minWidth: 0 }}
                      />
                      <input
                        type="time"
                        value={form.date_prevue ? form.date_prevue.slice(11, 16) : ""}
                        onChange={e => {
                          const date = form.date_prevue ? form.date_prevue.slice(0, 10) : "";
                          if (date) setF("date_prevue", `${date}T${e.target.value}`);
                        }}
                        style={{ ...inp, minWidth: 0 }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Priorité</label>
                    <select value={form.priorite} onChange={e => setF("priorite", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                      <option value="basse">Basse</option>
                      <option value="normale">Normale</option>
                      <option value="haute">Haute</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                  {/* Commercial : choisit le Responsable Technique */}
                  {(isCommercial || isAdmin) && (
                    <div>
                      <label style={lbl}>Responsable Technique</label>
                      <select value={form.responsable} onChange={e => setF("responsable", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                        <option value="">— Assigner un RT —</option>
                        {responsables.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
                      </select>
                    </div>
                  )}
                  {/* RT / Admin : choisit le technicien */}
                  {(isRT || isAdmin) && (
                    <div>
                      <label style={lbl}>Technicien principal</label>
                      <select value={form.technicien} onChange={e => {
                        const newId = e.target.value;
                        setF("technicien", newId);
                        if (newId) setF("autres_intervenants", form.autres_intervenants.filter((id: number) => id !== parseInt(newId)));
                      }} style={{ ...inp, cursor: "pointer" }}>
                        <option value="">Assigner plus tard</option>
                        {technicians.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label style={lbl}>Durée estimée (minutes)</label>
                    <input type="number" min="1" value={form.duree_estimee} onChange={e => setF("duree_estimee", e.target.value)} style={inp} placeholder="Ex: 120" />
                  </div>
                  {isEdit && (
                    <div>
                      <label style={lbl}>Statut</label>
                      <select value={form.statut} onChange={e => setF("statut", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                        <option value="planifiee">Planifiée</option>
                        <option value="en_cours">En cours</option>
                        <option value="terminee">Terminée</option>
                        <option value="annulee">Annulée</option>
                      </select>
                    </div>
                  )}
                </div>
                {/* Techniciens accompagnants */}
                {technicians.filter(t => !form.technicien || t.id !== parseInt(form.technicien)).length > 0 && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <label style={lbl}>Techniciens accompagnants</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.25rem" }}>
                      {technicians
                        .filter(t => !form.technicien || t.id !== parseInt(form.technicien))
                        .map(t => {
                          const selected = form.autres_intervenants.includes(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                const current: number[] = form.autres_intervenants;
                                setF("autres_intervenants", selected
                                  ? current.filter((id: number) => id !== t.id)
                                  : [...current, t.id]
                                );
                              }}
                              style={{
                                padding: "0.3rem 0.75rem",
                                borderRadius: RADIUS.full,
                                border: `1px solid ${selected ? PALETTE.primary : theme.border}`,
                                background: selected ? `${PALETTE.primary}18` : "transparent",
                                color: selected ? PALETTE.primary : theme.textSecondary,
                                fontSize: "0.8rem",
                                fontWeight: selected ? 600 : 400,
                                cursor: "pointer",
                                fontFamily: FONTS.body,
                                transition: "all 0.15s",
                              }}
                            >
                              {selected ? "✓ " : ""}{t.nom}
                            </button>
                          );
                        })}
                    </div>
                    {form.autres_intervenants.length > 0 && (
                      <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: "0.4rem" }}>
                        {form.autres_intervenants.length} technicien{form.autres_intervenants.length > 1 ? "s" : ""} sélectionné{form.autres_intervenants.length > 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label style={lbl}>Description</label>
                  <textarea rows={3} value={form.description} onChange={e => setF("description", e.target.value)} style={{ ...inp, resize: "vertical" }} placeholder="Description de l'intervention…" />
                </div>
              </div>

              {/* ── Client ── */}
              <div style={{ marginBottom: "1.25rem" }}>
                {sep("Client")}
                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", color: theme.textSecondary }}>
                    <input type="checkbox" checked={clientLibre} onChange={e => setClientLibre(e.target.checked)} />
                    Client non enregistré
                  </label>
                </div>
                {clientLibre ? (
                  <div className="iform-grid2">
                    <div>
                      <label style={lbl}>Nom du client *</label>
                      <input value={form.client_libre_nom} onChange={e => setF("client_libre_nom", e.target.value)} style={inp} placeholder="Nom complet" />
                    </div>
                    <div>
                      <label style={lbl}>Téléphone</label>
                      <input value={form.client_libre_telephone} onChange={e => setF("client_libre_telephone", e.target.value)} style={inp} placeholder="77XXXXXXX" />
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(6,182,212,0.06)", border: `1px solid rgba(6,182,212,0.2)`, fontSize: "0.82rem", color: theme.textSecondary }}>
                    💡 La liaison avec un client enregistré se fait depuis la fiche client. Cochez la case pour un client non enregistré.
                  </div>
                )}
              </div>

              {/* ── Localisation ── */}
              <div style={{ marginBottom: "1.25rem" }}>
                {sep("Localisation & Notes")}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div>
                    <label style={lbl}>Adresse d'intervention</label>
                    <textarea rows={2} value={form.adresse} onChange={e => setF("adresse", e.target.value)} style={{ ...inp, resize: "vertical" }} placeholder="Adresse complète…" />
                  </div>
                  <div>
                    <label style={lbl}>Notes internes</label>
                    <textarea rows={2} value={form.notes} onChange={e => setF("notes", e.target.value)} style={{ ...inp, resize: "vertical" }} placeholder="Notes pour l'équipe…" />
                  </div>
                </div>
              </div>

              {/* ── Champs terrain (si modification) ── */}
              {isEdit && (
                <div style={{ marginBottom: "1.25rem" }}>
                  {sep("Rapport terrain")}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div className="iform-grid2">
                      <div>
                        <label style={lbl}>ID DVR/NVR</label>
                        <input value={form.id_dvr_nvr} onChange={e => setF("id_dvr_nvr", e.target.value)} style={inp} placeholder="Identifiant…" />
                      </div>
                      <div>
                        <label style={lbl}>MDP DVR/NVR</label>
                        <input value={form.mdp_dvr_nvr} onChange={e => setF("mdp_dvr_nvr", e.target.value)} style={inp} placeholder="Mot de passe…" />
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Tâches réalisées</label>
                      <textarea rows={3} value={form.taches_realisees} onChange={e => setF("taches_realisees", e.target.value)} style={{ ...inp, resize: "vertical" }} placeholder="Décrivez les tâches effectuées…" />
                    </div>
                    <div>
                      <label style={lbl}>Observations technicien</label>
                      <textarea rows={3} value={form.observations_technicien} onChange={e => setF("observations_technicien", e.target.value)} style={{ ...inp, resize: "vertical" }} placeholder="Observations, remarques…" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="iform-footer" style={{ borderTopColor: theme.border }}>
              <button type="submit" disabled={saving}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? `${PALETTE.primary}66` : `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.9rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
                {saving
                  ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "iform-spin 0.7s linear infinite", display: "inline-block" }} /> Enregistrement…</>
                  : isEdit ? "Enregistrer les modifications" : "Créer l'intervention"}
              </button>
              <button type="button" onClick={onClose}
                style={{ width: "100%", padding: "0.7rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}