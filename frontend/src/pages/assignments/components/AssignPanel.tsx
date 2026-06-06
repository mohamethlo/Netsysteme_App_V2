// src/pages/assignments/components/AssignPanel.tsx
import { useState, useEffect, useCallback } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { assignmentsService, type TechnicianRow } from "../../../services/assignmentsService";
import { attendanceService } from "../../../services/attendanceService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props { dark: boolean; theme: LayoutContext["theme"]; }

interface WorkLoc { id: number; name: string; type?: string; address?: string; latitude?: number; longitude?: number; }

const today = () => new Date().toISOString().split("T")[0];

export default function AssignPanel({ dark, theme }: Props) {
  const swal = useSwal();
  const [date,       setDate]       = useState(today());
  const [techs,      setTechs]      = useState<TechnicianRow[]>([]);
  const [locations,  setLocations]  = useState<WorkLoc[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [busy,       setBusy]       = useState<number | null>(null);
  const [selected,   setSelected]   = useState<Record<number, string>>({});
  const [showHist,   setShowHist]   = useState<TechnicianRow | null>(null);
  const [histData,   setHistData]   = useState<any>(null);
  const [smsDomain,  setSmsDomain]  = useState<"NETSYSTEME" | "SSE">("NETSYSTEME");
  const [search,     setSearch]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tr, lr] = await Promise.all([
        assignmentsService.getTechnicians(date),
        attendanceService.getLocations?.() ?? Promise.resolve([]),
      ]);
      setTechs(tr.technicians);
      setLocations(Array.isArray(lr) ? lr : lr.results ?? []);
    } catch { swal.serverError(); } finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const handleAssign = async (tech: TechnicianRow) => {
    const loc = selected[tech.id];
    if (!loc) { swal.error("Requis", "Sélectionnez une zone de travail."); return; }
    if (!await swal.confirm({ title: `Affecter ${tech.name} à ${locations.find(l => String(l.id) === loc)?.name} ?`, confirmText: "Affecter", icon: "question" })) return;
    setBusy(tech.id);
    try {
      const r = await assignmentsService.assign({ technician_id: tech.id, location_id: Number(loc), date, sms_domain: smsDomain });
      swal.success(r.message + (r.sms_sent ? "\n📱 SMS envoyé !" : r.sms_error ? `\n⚠️ SMS : ${r.sms_error}` : ""));
      load();
    } catch (e: any) { swal.error("Erreur", e?.response?.data?.error ?? "Erreur lors de l'affectation."); }
    finally { setBusy(null); }
  };

  const handleFree = async (tech: TechnicianRow) => {
    if (!await swal.confirm({ title: `Libérer ${tech.name} ?`, icon: "warning", confirmText: "Libérer" })) return;
    setBusy(tech.id);
    try {
      const r = await assignmentsService.assign({ technician_id: tech.id, location_id: null, date, sms_domain: smsDomain });
      swal.success(r.message);
      load();
    } catch (e: any) { swal.error("Erreur", e?.response?.data?.error ?? "Erreur."); }
    finally { setBusy(null); }
  };

  const openHistory = async (tech: TechnicianRow) => {
    setShowHist(tech); setHistData(null);
    try { setHistData(await assignmentsService.getHistory(tech.id, date)); }
    catch { setHistData({ error: true }); }
  };

  const filtered = techs.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()));

  const inp: React.CSSProperties = { padding: "0.52rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.82rem", fontFamily: FONTS.body, outline: "none" };

  return (
    <div>
      {/* Barre de contrôle */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", padding: "1rem 1.25rem" }}>
        <div>
          <label style={{ fontSize: "0.7rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", display: "block", marginBottom: 3 }}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} max={today()}
            style={{ ...inp, width: 155 }} />
        </div>
        <div>
          <label style={{ fontSize: "0.7rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", display: "block", marginBottom: 3 }}>Domaine SMS</label>
          <select value={smsDomain} onChange={e => setSmsDomain(e.target.value as any)} style={{ ...inp, width: 145, cursor: "pointer" }}>
            <option value="NETSYSTEME">🌐 NETSYSTEME</option>
            <option value="SSE">⚡ SSE</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={{ fontSize: "0.7rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", display: "block", marginBottom: 3 }}>Recherche</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom technicien…" style={{ ...inp, width: "100%" }} />
        </div>
        <button onClick={load} style={{ marginTop: 14, padding: "0.52rem 1rem", borderRadius: RADIUS.md, border: `1px solid ${PALETTE.primary}44`, background: "transparent", color: PALETTE.primary, fontSize: "0.82rem", cursor: "pointer", fontFamily: FONTS.body }}>
          🔄 Actualiser
        </button>
        {/* Info */}
        <div style={{ marginTop: 14, fontSize: "0.72rem", color: theme.textMuted, display: "flex", gap: "0.75rem" }}>
          <span>✅ {techs.filter(t => t.is_present).length} présent(s)</span>
          <span>❌ {techs.filter(t => !t.is_present).length} absent(s)</span>
          <span>📍 {techs.filter(t => t.active_location).length} affecté(s)</span>
        </div>
      </div>

      {/* Alerte date future */}
      {date > today() && (
        <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", marginBottom: "1rem", fontSize: "0.85rem" }}>
          ⚠️ Date future — l'affectation est impossible pour une date qui n'est pas encore arrivée.
        </div>
      )}

      {/* Tableau */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <div style={{ width: 32, height: 32, border: `3px solid rgba(59,130,246,0.2)`, borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: theme.textMuted }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>👷</div>
            <div>Aucun technicien trouvé</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  {["Technicien", "Contact", "Statut actuel", "Affecter à", "Actions"].map(h => (
                    <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.67rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tech, i) => (
                  <tr key={tech.id}
                    style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${theme.border}` : "none", opacity: !tech.is_present ? 0.55 : 1, background: tech.is_present && tech.active_location ? (dark ? "rgba(59,130,246,0.04)" : "rgba(59,130,246,0.03)") : "transparent" }}>

                    {/* Nom */}
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <div style={{ fontWeight: 600, color: theme.textPrimary }}>{tech.name}</div>
                      {tech.check_in_time && <div style={{ fontSize: "0.72rem", color: "#10b981" }}>✅ Pointé à {tech.check_in_time}</div>}
                      {!tech.is_present && <div style={{ fontSize: "0.72rem", color: "#ef4444" }}>❌ Absent</div>}
                    </td>

                    {/* Contact */}
                    <td style={{ padding: "0.85rem 1rem", fontSize: "0.8rem" }}>
                      {tech.phone
                        ? <span style={{ color: "#10b981", fontWeight: 500 }}>📱 {tech.phone}</span>
                        : <span style={{ color: "#f59e0b", fontSize: "0.72rem" }}>⚠️ Pas de numéro</span>}
                    </td>

                    {/* Statut */}
                    <td style={{ padding: "0.85rem 1rem" }}>
                      {!tech.is_present
                        ? <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>Absent</span>
                        : tech.active_location
                          ? <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: "rgba(59,130,246,0.12)", color: "#3b82f6" }}>📍 {tech.active_location}</span>
                          : <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>⏳ Disponible</span>}
                    </td>

                    {/* Select zone */}
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <select
                        value={selected[tech.id] ?? ""}
                        onChange={e => setSelected(s => ({ ...s, [tech.id]: e.target.value }))}
                        disabled={!tech.is_present || date > today()}
                        style={{ ...inp, width: 200, cursor: tech.is_present ? "pointer" : "not-allowed", opacity: tech.is_present ? 1 : 0.5 }}>
                        <option value="">-- Sélectionner --</option>
                        {locations.map(l => (
                          <option key={l.id} value={String(l.id)}>{l.name}{l.type ? ` (${l.type})` : ""}</option>
                        ))}
                      </select>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                        {tech.is_present && date <= today() && (
                          <>
                            <button onClick={() => handleAssign(tech)} disabled={busy === tech.id || !selected[tech.id]}
                              style={{ padding: "0.42rem 0.75rem", borderRadius: RADIUS.md, border: "none", background: "#3b82f6", color: "#fff", fontSize: "0.78rem", fontWeight: 600, cursor: busy === tech.id || !selected[tech.id] ? "not-allowed" : "pointer", fontFamily: FONTS.body, opacity: busy === tech.id || !selected[tech.id] ? 0.5 : 1 }}>
                              {busy === tech.id ? "…" : "✓ Affecter"}
                            </button>
                            {tech.active_location && (
                              <button onClick={() => handleFree(tech)} disabled={busy === tech.id}
                                style={{ padding: "0.42rem 0.75rem", borderRadius: RADIUS.md, border: "1px solid rgba(245,158,11,0.4)", background: "transparent", color: "#f59e0b", fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body }}>
                                🔓 Libérer
                              </button>
                            )}
                          </>
                        )}
                        <button onClick={() => openHistory(tech)}
                          style={{ padding: "0.42rem 0.65rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body }}>
                          🕐
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal historique */}
      {showHist && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          onClick={e => e.target === e.currentTarget && setShowHist(null)}>
          <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: theme.textPrimary }}>
                🕐 Historique — {showHist.name} ({date})
              </h2>
              <button onClick={() => setShowHist(null)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
            </div>
            <div style={{ padding: "1.25rem 1.5rem" }}>
              {!histData ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
                  <div style={{ width: 28, height: 28, border: "3px solid rgba(59,130,246,0.2)", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                </div>
              ) : histData.error ? (
                <div style={{ color: "#ef4444", textAlign: "center" }}>Erreur de chargement</div>
              ) : histData.assignments.length === 0 ? (
                <div style={{ textAlign: "center", color: theme.textMuted, padding: "1.5rem" }}>Aucune affectation ce jour</div>
              ) : (
                <>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                        {["Zone", "Début", "Fin", "Durée", "État"].map(h => (
                          <th key={h} style={{ padding: "0.55rem 0.75rem", textAlign: "left", fontSize: "0.67rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {histData.assignments.map((a: any, i: number) => (
                        <tr key={a.id} style={{ borderBottom: i < histData.assignments.length - 1 ? `1px solid ${theme.border}` : "none" }}>
                          <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600, color: theme.textPrimary }}>{a.location}</td>
                          <td style={{ padding: "0.6rem 0.75rem", color: theme.textSecondary }}>{a.assigned_at}</td>
                          <td style={{ padding: "0.6rem 0.75rem", color: theme.textSecondary }}>{a.unassigned_at}</td>
                          <td style={{ padding: "0.6rem 0.75rem" }}>
                            <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: "rgba(59,130,246,0.12)", color: "#3b82f6" }}>{a.duration_hours}h</span>
                          </td>
                          <td style={{ padding: "0.6rem 0.75rem" }}>
                            {a.is_active
                              ? <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "1px 6px", borderRadius: RADIUS.full, background: "rgba(16,185,129,0.12)", color: "#10b981" }}>Actif</span>
                              : <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "1px 6px", borderRadius: RADIUS.full, background: theme.border, color: theme.textMuted }}>Terminé</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginTop: "0.85rem", padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", fontSize: "0.85rem", color: "#3b82f6", fontWeight: 600 }}>
                    Total journée : {histData.total_hours}h ({histData.total_minutes} min)
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}