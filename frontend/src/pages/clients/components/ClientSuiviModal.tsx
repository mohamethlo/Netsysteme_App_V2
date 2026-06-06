// src/pages/clients/components/ClientSuiviModal.tsx
import { useState, useEffect, useCallback } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { clientsService, type CRMClient, type CallHistoryEntry } from "../../../services/clientsService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark: boolean; theme: LayoutContext["theme"];
  client: CRMClient;
  onClose: () => void;
  onSaved: () => void;  // ← AJOUT
}

const MOTIFS_JOINT = [
  { group: "Accords",       options: [{ v: "accord_oneshot", l: "Accord Oneshot" }, { v: "accord_maintenance", l: "Accord Maintenance" }] },
  { group: "Communication", options: [{ v: "dialogue_impossible", l: "Dialogue impossible" }, { v: "entretien_interrompu", l: "Entretien interrompu" }] },
  { group: "Situations",    options: [{ v: "deja_installe", l: "Déjà installé" }, { v: "doublon", l: "Doublon" }] },
  { group: "Rappels",       options: [{ v: "rappel_decisionnaire_absent", l: "Rappel : Décisionnaire absent" }, { v: "rappel_reflechir", l: "Rappel : Souhaite réfléchir" }, { v: "rappel", l: "Rappel" }] },
];

const MOTIFS_NON_JOINT = [
  { v: "faux_numero",     l: "Faux numéro" },
  { v: "pas_de_contact",  l: "Pas de contact" },
  { v: "numero_suspendu", l: "Numéro suspendu" },
  { v: "nd_resilie",      l: "ND Résilié" },
  { v: "nrp",             l: "NRP" },
  { v: "occupe",          l: "Occupé" },
  { v: "repondeur",       l: "Répondeur" },
  { v: "refus",           l: "Refus" },
];

const DETAIL_REFUS = [
  { v: "refus_repondre",   l: "Refus de répondre" },
  { v: "pas_temps",        l: "N'a pas le temps" },
  { v: "deplore_sav",      l: "Déplore le SAV" },
  { v: "offre_trop_chere", l: "Offre trop chère" },
  { v: "pas_interesse",    l: "Pas intéressé" },
  { v: "reticent",         l: "Réticent" },
  { v: "menace",           l: "Menace" },
];

const todayStr = () => new Date().toISOString().split("T")[0];

export default function ClientSuiviModal({ dark, theme, client, onClose, onSaved }: Props) {
  const swal = useSwal();
  const [tab,     setTab]     = useState<"form" | "history">("form");
  const [history, setHistory] = useState<CallHistoryEntry[]>([]);
  const [loadingH,setLoadingH]= useState(false);
  const [saving,  setSaving]  = useState(false);
  const [periodF, setPeriodF] = useState("all");
  const [resultF, setResultF] = useState("all");

  const [callResult,       setCallResult]       = useState("");
  const [categorie,        setCategorie]        = useState("");
  const [motifPrincipal,   setMotifPrincipal]   = useState("");
  const [motifRefus,       setMotifRefus]       = useState("");
  const [motifRefusDetail, setMotifRefusDetail] = useState("");
  const [commentaires,     setCommentaires]     = useState("");
  const [dateAppel,        setDateAppel]        = useState(todayStr());
  const [dateInstallation, setDateInstallation] = useState("");
  const [dateMaintenance1, setDateMaintenance1] = useState("");
  const [dateMaintenance2, setDateMaintenance2] = useState("");

  const isJoint    = callResult === "client_joint";
  const isNonJoint = callResult === "client_non_joint";
  const isAccord   = ["accord_oneshot", "accord_maintenance"].includes(motifPrincipal);

  const loadHistory = useCallback(async () => {
    setLoadingH(true);
    try {
      const params: any = {};
      if (periodF !== "all") params.period = periodF;
      if (resultF !== "all") params.result = resultF;
      const data = await clientsService.calls.getAll(client.id, params);
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      swal.serverError();
      setHistory([]);
    } finally { setLoadingH(false); }
  }, [client.id, periodF, resultF]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSave = async () => {
    if (!callResult) { swal.error("Requis", "Sélectionnez un résultat d'appel."); return; }
    if (!client.telephone) { swal.error("Requis", "Contact 1 manquant."); return; }
    setSaving(true);
    try {
      await clientsService.calls.create({
        client:             client.id,
        nom:                client.nom,
        prenom:             client.prenom ?? "",
        adresse:            client.adresse ?? "",
        contact_1:          client.telephone,
        resultat_appel:     callResult as "client_joint" | "client_non_joint",
        categorie,
        motif_principal:    motifPrincipal,
        motif_refus:        motifRefus,
        motif_refus_detail: motifRefusDetail,
        commentaires,
        date_appel:         dateAppel,
        date_installation:  dateInstallation || undefined,
        date_maintenance_1: dateMaintenance1 || undefined,
        date_maintenance_2: dateMaintenance2 || undefined,
      } as any);
      swal.success("Résultat d'appel enregistré !");
      onSaved();        // ← AJOUT : rafraîchit la liste des clients
      setTab("history");
    } catch { swal.serverError(); } finally { setSaving(false); }
  };

  const handleDeleteCall = async (id: number) => {
    if (!await swal.confirm({ title: "Supprimer cet appel ?", icon: "warning", confirmText: "Supprimer" })) return;
    try { await clientsService.calls.delete(id); loadHistory(); }
    catch { swal.serverError(); }
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.55rem 0.75rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };

  const sec = (title: string) => (
    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0.85rem 0 0.4rem", paddingBottom: "0.3rem", borderBottom: `1px solid ${theme.border}` }}>
      {title}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 620, maxHeight: "94vh", overflowY: "auto", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: theme.textPrimary }}>
              📞 Suivi — {client.display_name}
            </h2>
            {client.telephone && (
              <a href={`tel:${client.telephone}`} style={{ fontSize: "0.82rem", color: PALETTE.primary, textDecoration: "none" }}>
                {client.telephone}
              </a>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
        </div>

        {/* Onglets */}
        <div style={{ display: "flex", borderBottom: `1px solid ${theme.border}` }}>
          {(["form", "history"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                flex: 1, padding: "0.75rem", border: "none", background: "transparent",
                color: tab === t ? PALETTE.primary : theme.textMuted,
                fontWeight: tab === t ? 700 : 400, fontSize: "0.875rem",
                cursor: "pointer", fontFamily: FONTS.body,
                borderBottom: `2px solid ${tab === t ? PALETTE.primary : "transparent"}`,
              }}>
              {t === "form" ? "📋 Résultat d'appel" : `📚 Historique (${loadingH ? "…" : history.length})`}
            </button>
          ))}
        </div>

        {/* ── Formulaire ── */}
        {tab === "form" && (
          <div style={{ padding: "1.25rem 1.5rem" }}>
            {sec("Résultat d'appel *")}
            <select value={callResult} onChange={e => {
              setCallResult(e.target.value);
              setMotifPrincipal(""); setMotifRefus(""); setMotifRefusDetail("");
            }} style={inp}>
              <option value="">Sélectionner…</option>
              <option value="client_joint">✅ CLIENT JOINT</option>
              <option value="client_non_joint">❌ CLIENT NON JOINT</option>
            </select>

            {isJoint && (
              <>
                {sec("Catégorie")}
                <select value={categorie} onChange={e => setCategorie(e.target.value)} style={inp}>
                  <option value="">Sélectionner…</option>
                  <option value="télévendeur">📞 Télévendeur</option>
                  <option value="professionnel">💼 Professionnel</option>
                  <option value="particulier">👨 Particulier</option>
                </select>

                {sec("Motif principal *")}
                <select value={motifPrincipal} onChange={e => setMotifPrincipal(e.target.value)} style={inp}>
                  <option value="">Sélectionner…</option>
                  {MOTIFS_JOINT.map(g => (
                    <optgroup key={g.group} label={g.group}>
                      {g.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </optgroup>
                  ))}
                </select>

                {isAccord && (
                  <>
                    {sec("Dates installation")}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                      {([
                        ["Date installation", dateInstallation, setDateInstallation],
                        ["Maintenance 1",     dateMaintenance1, setDateMaintenance1],
                        ["Maintenance 2",     dateMaintenance2, setDateMaintenance2],
                      ] as [string, string, (v: string) => void][]).map(([l, v, set]) => (
                        <div key={l}>
                          <div style={{ fontSize: "0.68rem", color: theme.textMuted, marginBottom: 3 }}>{l}</div>
                          <input type="date" value={v} onChange={e => set(e.target.value)} style={inp} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {isNonJoint && (
              <>
                {sec("Motif (non joint)")}
                <select value={motifRefus} onChange={e => { setMotifRefus(e.target.value); setMotifRefusDetail(""); }} style={inp}>
                  <option value="">Sélectionner…</option>
                  {MOTIFS_NON_JOINT.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                {motifRefus === "refus" && (
                  <>
                    {sec("Détail du refus")}
                    <select value={motifRefusDetail} onChange={e => setMotifRefusDetail(e.target.value)} style={inp}>
                      <option value="">Sélectionner…</option>
                      {DETAIL_REFUS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </>
                )}
              </>
            )}

            {callResult && (
              <>
                {sec("Date de l'appel")}
                <input type="date" value={dateAppel} onChange={e => setDateAppel(e.target.value)} style={inp} />

                {sec("Commentaires")}
                <textarea rows={3} value={commentaires} onChange={e => setCommentaires(e.target.value)}
                  placeholder="Notes détaillées sur l'appel…"
                  style={{ ...inp, resize: "vertical" }} />

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", paddingTop: "1rem", borderTop: `1px solid ${theme.border}` }}>
                  <button onClick={handleSave} disabled={saving}
                    style={{ flex: 1, padding: "0.65rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body, opacity: saving ? 0.7 : 1 }}>
                    {saving ? "Enregistrement…" : "💾 Enregistrer"}
                  </button>
                  <button onClick={onClose}
                    style={{ padding: "0.65rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
                    Annuler
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Historique ── */}
        {tab === "history" && (
          <div style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              <select value={periodF} onChange={e => setPeriodF(e.target.value)} style={{ ...inp, maxWidth: 160 }}>
                <option value="all">Toute période</option>
                <option value="today">Aujourd'hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
              </select>
              <select value={resultF} onChange={e => setResultF(e.target.value)} style={{ ...inp, maxWidth: 190 }}>
                <option value="all">Tous les résultats</option>
                <option value="client_joint">Client joint</option>
                <option value="client_non_joint">Client non joint</option>
              </select>
              <button onClick={() => clientsService.calls.exportCsv(client.id)}
                style={{ padding: "0.52rem 0.85rem", borderRadius: RADIUS.md, border: "1px solid rgba(16,185,129,0.4)", background: "transparent", color: "#10b981", fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body }}>
                ⬇ Export CSV
              </button>
            </div>

            {loadingH ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
                <div style={{ width: 28, height: 28, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              </div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: theme.textMuted }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📞</div>
                <div>Aucun appel enregistré</div>
              </div>
            ) : history.map((call) => (
              <div key={call.id} style={{ padding: "0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, marginBottom: "0.65rem", background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.4rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: call.resultat_appel === "client_joint" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.1)", color: call.resultat_appel === "client_joint" ? "#10b981" : "#ef4444" }}>
                      {call.resultat_appel === "client_joint" ? "✅ Joint" : "❌ Non joint"}
                    </span>
                    <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>
                      {new Date(call.created_at).toLocaleString("fr-FR")}
                    </span>
                  </div>
                  <button onClick={() => handleDeleteCall(call.id)} title="Supprimer"
                    style={{ width: 26, height: 26, borderRadius: RADIUS.md, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "0.72rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >🗑</button>
                </div>
                {call.motif_principal && <div style={{ fontSize: "0.78rem", color: theme.textSecondary }}>Motif : {call.motif_principal}</div>}
                {call.motif_refus     && <div style={{ fontSize: "0.78rem", color: theme.textSecondary }}>Refus : {call.motif_refus}{call.motif_refus_detail ? ` — ${call.motif_refus_detail}` : ""}</div>}
                {call.categorie       && <div style={{ fontSize: "0.78rem", color: theme.textMuted }}>Catégorie : {call.categorie}</div>}
                {call.commentaires    && <div style={{ fontSize: "0.78rem", color: theme.textMuted, marginTop: 3 }}>{call.commentaires}</div>}
                {call.date_installation && <div style={{ fontSize: "0.72rem", color: PALETTE.primary, marginTop: 3 }}>🔧 Installation : {call.date_installation}</div>}
                <div style={{ fontSize: "0.68rem", color: theme.textMuted, marginTop: 4 }}>Par : {call.created_by_name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}