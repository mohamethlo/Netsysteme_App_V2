import { useState, useEffect, useCallback } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { smsService, type SMSTemplate } from "../../../services/smsService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark:    boolean;
  theme:   LayoutContext["theme"];
  onClose: () => void;
}

const CATEGORIES = ["facture", "rappel", "promotion", "confirmation", "relance", "info", "autre"];
const VARS       = ["{entreprise}", "{contact}", "{prenom}", "{nom}", "{email}", "{telephone}", "{ville}"];

const CSS = `
  @keyframes tpl-spin { to { transform: rotate(360deg); } }

  .tpl-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 500;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  @media (min-width: 640px) {
    .tpl-overlay { align-items: center; padding: 1rem; }
  }

  .tpl-modal {
    width: 100%;
    max-height: 97vh;
    overflow-y: auto;
    border-radius: 18px 18px 0 0;
  }
  @media (min-width: 640px) {
    .tpl-modal { max-width: 760px; border-radius: 18px; max-height: 95vh; }
  }

  .tpl-body { padding: 1rem; }
  @media (min-width: 640px) { .tpl-body { padding: 1.5rem; } }

  .tpl-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  @media (min-width: 500px) {
    .tpl-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 768px) {
    .tpl-grid { grid-template-columns: repeat(3, 1fr); }
  }
`;

export default function TemplatesPanel({ dark, theme, onClose }: Props) {
  const swal = useSwal();
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<SMSTemplate | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [form, setForm] = useState({ name: "", description: "", content: "", category: "", is_active: true });
  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try { setTemplates(await smsService.templates.getAll()); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openForm = (tpl?: SMSTemplate) => {
    setEditing(tpl ?? null);
    setForm(tpl
      ? { name: tpl.name, description: tpl.description ?? "", content: tpl.content, category: tpl.category ?? "", is_active: tpl.is_active }
      : { name: "", description: "", content: "", category: "", is_active: true });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.content.trim()) { swal.error("Requis", "Nom et contenu obligatoires."); return; }
    setSaving(true);
    try {
      if (editing) { await smsService.templates.update(editing.id, form); swal.updated("Le template"); }
      else         { await smsService.templates.create(form);              swal.saved("Le template");   }
      setShowForm(false); load();
    } catch { swal.serverError(); } finally { setSaving(false); }
  };

  const handleDelete = async (t: SMSTemplate) => {
    if (!await swal.confirmDelete(t.name)) return;
    try { await smsService.templates.delete(t.id); swal.deleted("Le template"); load(); }
    catch { swal.serverError(); }
  };

  const copyToClipboard = (content: string) =>
    navigator.clipboard.writeText(content).then(() => swal.success("Copié !"));

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.58rem 0.8rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: "0.7rem", fontWeight: 700,
    color: theme.textSecondary, marginBottom: "0.25rem",
    textTransform: "uppercase", letterSpacing: "0.06em",
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="tpl-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="tpl-modal" style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

          {/* Header */}
          <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: theme.popupBg, zIndex: 2, borderRadius: "18px 18px 0 0" }}>
            <div>
              <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: theme.textPrimary, marginBottom: 2 }}>
                📋 Templates SMS
              </h2>
              <p style={{ fontSize: "0.75rem", color: theme.textMuted }}>
                {templates.length} template{templates.length > 1 ? "s" : ""} disponible{templates.length > 1 ? "s" : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button onClick={() => openForm()}
                style={{ padding: "0.52rem 0.9rem", borderRadius: RADIUS.md, border: "none", background: "linear-gradient(135deg,#667eea,#764ba2)", color: "#fff", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap" }}>
                + Nouveau
              </button>
              <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1 }}>✕</button>
            </div>
          </div>

          <div className="tpl-body">
            {/* Info variables */}
            <div style={{ padding: "0.7rem 0.9rem", borderRadius: RADIUS.md, background: "rgba(102,126,234,0.06)", border: "1px solid rgba(102,126,234,0.2)", marginBottom: "1rem", fontSize: "0.78rem", color: theme.textSecondary }}>
              <strong style={{ color: "#667eea" }}>📝 Variables :</strong>{" "}
              {VARS.map(v => (
                <code key={v} style={{ background: "rgba(102,126,234,0.12)", padding: "1px 5px", borderRadius: 4, margin: "0 2px", fontSize: "0.72rem" }}>{v}</code>
              ))}
            </div>

            {/* Liste templates */}
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                <div style={{ width: 30, height: 30, border: "3px solid rgba(102,126,234,0.2)", borderTopColor: "#667eea", borderRadius: "50%", animation: "tpl-spin 0.8s linear infinite" }} />
              </div>
            ) : templates.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", color: theme.textMuted }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📝</div>
                <div style={{ marginBottom: "1rem" }}>Aucun template — créez le premier !</div>
                <button onClick={() => openForm()}
                  style={{ padding: "0.58rem 1.25rem", borderRadius: RADIUS.md, border: "none", background: "#667eea", color: "#fff", fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
                  + Créer
                </button>
              </div>
            ) : (
              <div className="tpl-grid">
                {templates.map(t => (
                  <div key={t.id} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, color: theme.textPrimary, fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.name}
                        </div>
                        {t.category && (
                          <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "1px 6px", borderRadius: RADIUS.full, background: "rgba(102,126,234,0.12)", color: "#667eea", display: "inline-block", marginTop: 3 }}>
                            {t.category}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0, marginLeft: "0.5rem" }}>
                        <button onClick={() => copyToClipboard(t.content)} title="Copier"
                          style={{ width: 26, height: 26, borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: "pointer", fontSize: "0.7rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          📋
                        </button>
                        <button onClick={() => openForm(t)} title="Modifier"
                          style={{ width: 26, height: 26, borderRadius: RADIUS.md, border: "1px solid rgba(59,130,246,0.4)", background: "transparent", color: "#3b82f6", cursor: "pointer", fontSize: "0.7rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          ✏️
                        </button>
                        <button onClick={() => handleDelete(t)} title="Supprimer"
                          style={{ width: 26, height: 26, borderRadius: RADIUS.md, border: "1px solid rgba(239,68,68,0.4)", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "0.7rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          🗑
                        </button>
                      </div>
                    </div>

                    {t.description && (
                      <div style={{ fontSize: "0.73rem", color: theme.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.description}
                      </div>
                    )}

                    <div style={{ padding: "0.55rem 0.7rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}`, fontSize: "0.78rem", color: theme.textSecondary, lineHeight: 1.5, maxHeight: 70, overflow: "hidden" }}>
                      {t.content}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.67rem", color: theme.textMuted }}>
                      <span>Utilisé {t.usage_count}×</span>
                      <span style={{ color: t.is_active ? "#10b981" : "#ef4444" }}>
                        {t.is_active ? "✅ Actif" : "⏸ Inactif"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal formulaire template */}
          {showForm && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 600, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
              onClick={e => e.target === e.currentTarget && setShowForm(false)}>
              <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px 18px 0 0", width: "100%", maxHeight: "95vh", overflowY: "auto", boxShadow: dark ? "0 -8px 40px rgba(0,0,0,0.6)" : "0 -4px 24px rgba(0,0,0,0.12)", fontFamily: FONTS.body }}>
                <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: theme.popupBg, zIndex: 2 }}>
                  <h3 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: theme.textPrimary }}>
                    {editing ? "Modifier le template" : "Nouveau template"}
                  </h3>
                  <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
                </div>

                <form onSubmit={handleSave} style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  <div>
                    <label style={lbl}>Nom *</label>
                    <input required value={form.name} onChange={e => setF("name", e.target.value)} style={inp} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label style={lbl}>Catégorie</label>
                      <select value={form.category} onChange={e => setF("category", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                        <option value="">Aucune</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: "0.2rem" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", color: theme.textSecondary }}>
                        <input type="checkbox" checked={form.is_active} onChange={e => setF("is_active", e.target.checked)} />
                        Actif
                      </label>
                    </div>
                  </div>

                  <div>
                    <label style={lbl}>Description</label>
                    <input value={form.description} onChange={e => setF("description", e.target.value)} placeholder="Optionnel" style={inp} />
                  </div>

                  <div>
                    <label style={lbl}>Contenu *</label>
                    {/* Variables cliquables */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginBottom: "0.4rem" }}>
                      {VARS.map(v => (
                        <button key={v} type="button" onClick={() => setF("content", form.content + v)}
                          style={{ padding: "2px 7px", borderRadius: 4, border: "1px solid rgba(102,126,234,0.4)", background: "rgba(102,126,234,0.08)", color: "#667eea", fontSize: "0.7rem", cursor: "pointer", fontFamily: "monospace" }}>
                          {v}
                        </button>
                      ))}
                    </div>
                    <textarea required rows={5} value={form.content} onChange={e => setF("content", e.target.value)}
                      placeholder="Bonjour {contact}, …"
                      style={{ ...inp, resize: "vertical" }} />
                    <div style={{ fontSize: "0.7rem", color: form.content.length > 160 ? "#f59e0b" : theme.textMuted, textAlign: "right", marginTop: 2 }}>
                      {form.content.length} car.
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "0.5rem", borderTop: `1px solid ${theme.border}` }}>
                    <button type="submit" disabled={saving}
                      style={{ width: "100%", padding: "0.7rem", borderRadius: RADIUS.md, border: "none", background: saving ? "rgba(102,126,234,0.5)" : "linear-gradient(135deg,#667eea,#764ba2)", color: "#fff", fontSize: "0.9rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
                      {saving ? "Enregistrement…" : editing ? "Modifier" : "Créer le template"}
                    </button>
                    <button type="button" onClick={() => setShowForm(false)}
                      style={{ width: "100%", padding: "0.65rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
                      Annuler
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}