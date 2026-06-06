// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/attendance/WorkLocationsPage.tsx
//  Gestion des zones de travail (admin only)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import { attendanceService, type WorkLocation } from "../../services/attendanceService";
import { useSwal } from "../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../theme";

// ── Formulaire modal ──────────────────────────────────────────────────────────
function WorkLocationFormModal({ dark, theme, location, onClose, onSaved }: {
  dark: boolean; theme: LayoutContext["theme"];
  location: WorkLocation | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const swal   = useSwal();
  const isEdit = !!location;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name:      location?.name      ?? "",
    type:      location?.type      ?? "bureau",
    address:   location?.address   ?? "",
    latitude:  location?.latitude?.toString()  ?? "",
    longitude: location?.longitude?.toString() ?? "",
    radius:    location?.radius?.toString()    ?? "100",
  });

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handlePreview = () => {
    const lat = parseFloat(form.latitude);
    const lon = parseFloat(form.longitude);
    if (isNaN(lat) || isNaN(lon)) {
      swal.error("Coordonnées invalides", "Saisissez des coordonnées numériques valides.");
      return;
    }
    window.open(`https://www.google.com/maps?q=${lat},${lon}`, "_blank");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(form.latitude);
    const lon = parseFloat(form.longitude);
    const rad = parseInt(form.radius);
    if (!form.name.trim())  { swal.error("Requis", "Le nom est obligatoire."); return; }
    if (isNaN(lat) || isNaN(lon)) { swal.error("Requis", "Coordonnées GPS invalides."); return; }
    if (isNaN(rad) || rad < 10)   { swal.error("Requis", "Le rayon doit être ≥ 10 m."); return; }

    setSaving(true);
    try {
      const payload = {
        name:      form.name.trim(),
        type:      form.type as "bureau" | "chantier",
        address:   form.address.trim() || undefined,
        latitude:  lat,
        longitude: lon,
        radius:    rad,
      };
      if (isEdit) {
        await attendanceService.updateLocation(location!.id, payload);
        swal.updated("La zone de travail");
      } else {
        await attendanceService.createLocation(payload);
        swal.saved("La zone de travail");
      }
      onSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.response?.data?.name?.[0] ?? "Une erreur est survenue.";
      swal.error("Erreur", msg);
    } finally { setSaving(false); }
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.62rem 0.85rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: "0.72rem", fontWeight: 600,
    color: theme.textSecondary, marginBottom: "0.28rem",
    textTransform: "uppercase", letterSpacing: "0.05em",
  };
  const sep = (t: string) => (
    <div style={{ fontSize: "0.68rem", fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", margin: "1.1rem 0 0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ flex: 1, height: 1, background: theme.border }} />{t}<div style={{ flex: 1, height: 1, background: theme.border }} />
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 580, maxHeight: "94vh", overflowY: "auto", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontFamily: FONTS.display, fontSize: "1.05rem", fontWeight: 700, color: theme.textPrimary, marginBottom: 2 }}>
              {isEdit ? `Modifier « ${location!.name} »` : "Nouvelle zone de travail"}
            </h2>
            <p style={{ fontSize: "0.78rem", color: theme.textMuted }}>
              Zone géolocalisée pour le système de pointage
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem", padding: 4 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>

          {sep("Informations générales")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lbl}>Nom de la zone *</label>
              <input required value={form.name} onChange={e => setF("name", e.target.value)} placeholder="Ex: Siège social, Chantier Almadies…" style={inp} />
            </div>
            <div>
              <label style={lbl}>Type *</label>
              <select value={form.type} onChange={e => setF("type", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                <option value="bureau">🏢 Bureau</option>
                <option value="chantier">🔧 Chantier / Terrain</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Rayon (mètres) *</label>
              <input type="number" required min="10" max="5000" value={form.radius} onChange={e => setF("radius", e.target.value)} style={inp} />
              <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 3 }}>Distance autorisée pour pointer</div>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lbl}>Adresse</label>
              <input value={form.address} onChange={e => setF("address", e.target.value)} placeholder="Ex: Ouest Foire, route de l'aéroport, Dakar" style={inp} />
            </div>
          </div>

          {sep("Coordonnées GPS")}

          {/* Info box */}
          <div style={{ padding: "0.85rem 1rem", borderRadius: RADIUS.md, background: dark ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.2)", marginBottom: "0.85rem", fontSize: "0.8rem", color: theme.textSecondary, lineHeight: 1.6 }}>
            <strong style={{ color: "#3b82f6" }}>ℹ Comment obtenir les coordonnées ?</strong>
            <ul style={{ margin: "0.4rem 0 0 1rem", padding: 0 }}>
              <li><strong>Google Maps :</strong> Clic droit sur l'adresse → "Qu'est-ce qu'il y a ici ?" → coordonnées affichées</li>
              <li><strong>Smartphone :</strong> Allez sur place, l'app GPS indique vos coordonnées</li>
            </ul>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
            <div>
              <label style={lbl}>Latitude *</label>
              <input required type="number" step="any" value={form.latitude} onChange={e => setF("latitude", e.target.value)} placeholder="Ex: 14.7167" style={inp} />
            </div>
            <div>
              <label style={lbl}>Longitude *</label>
              <input required type="number" step="any" value={form.longitude} onChange={e => setF("longitude", e.target.value)} placeholder="Ex: -17.4677" style={inp} />
            </div>
          </div>

          {/* Bouton prévisualiser */}
          {form.latitude && form.longitude && !isNaN(parseFloat(form.latitude)) && !isNaN(parseFloat(form.longitude)) && (
            <div style={{ marginTop: "0.75rem" }}>
              <button type="button" onClick={handlePreview}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.48rem 0.9rem", borderRadius: RADIUS.md, border: `1px solid rgba(59,130,246,0.4)`, background: "transparent", color: "#3b82f6", fontSize: "0.82rem", cursor: "pointer", fontFamily: FONTS.body }}>
                🗺 Prévisualiser sur Google Maps
              </button>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "1.25rem", marginTop: "0.5rem", borderTop: `1px solid ${theme.border}` }}>
            <button type="button" onClick={onClose}
              style={{ padding: "0.65rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
              Annuler
            </button>
            <button type="submit" disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.65rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: saving ? "rgba(6,182,212,0.45)" : `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONTS.body }}>
              {saving
                ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> Enregistrement…</>
                : isEdit ? "Enregistrer les modifications" : "Créer la zone"}
            </button>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── WorkLocationsPage ─────────────────────────────────────────────────────────
export default function WorkLocationsPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const swal = useSwal();

  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<WorkLocation | null>(null);
  const [search,    setSearch]    = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setLocations(await attendanceService.getLocations()); }
    catch { swal.serverError(); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (loc: WorkLocation) => {
    if (!await swal.confirmDelete(`la zone "${loc.name}"`)) return;
    try { await attendanceService.deleteLocation(loc.id); swal.deleted("La zone"); load(); }
    catch { swal.serverError(); }
  };

  const filtered = locations.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    (l.address ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const TYPE_CFG = {
    bureau:   { label: "Bureau",   bg: "rgba(59,130,246,0.12)",  text: "#3b82f6", icon: "🏢" },
    chantier: { label: "Chantier", bg: "rgba(245,158,11,0.12)", text: "#f59e0b", icon: "🔧" },
  };

  return (
    <div style={{ fontFamily: FONTS.body }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem" }}>
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontSize: "1.5rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>
            Zones de travail
          </h1>
          <p style={{ fontSize: "0.85rem", color: theme.textMuted, marginTop: 3 }}>
            Zones géolocalisées pour le système de pointage
          </p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.62rem 1.25rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, boxShadow: `0 0 20px ${PALETTE.primary}22` }}>
          + Ajouter une zone
        </button>
      </div>

      {/* Stats */}
      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.85rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Total",     value: locations.length,                                       color: PALETTE.primary, icon: "📍" },
            { label: "Bureaux",   value: locations.filter(l => l.type === "bureau").length,       color: "#3b82f6",       icon: "🏢" },
            { label: "Chantiers", value: locations.filter(l => l.type === "chantier").length,     color: "#f59e0b",       icon: "🔧" },
          ].map(s => (
            <div key={s.label} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: 40, height: 40, borderRadius: "10px", background: s.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1 }}>{s.label}</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1 }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Barre recherche */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ position: "relative", maxWidth: 280 }}>
          <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une zone…"
            style={{ width: "100%", padding: "0.55rem 0.85rem 0.55rem 2.3rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", outline: "none", fontFamily: FONTS.body }} />
        </div>
      </div>

      {/* Table / Empty state */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: "0.75rem" }}>📍</div>
            <div style={{ fontWeight: 600, color: theme.textPrimary, marginBottom: "0.4rem" }}>
              {search ? "Aucune zone trouvée" : "Aucune zone de travail définie"}
            </div>
            <div style={{ fontSize: "0.875rem", color: theme.textMuted, marginBottom: "1.25rem" }}>
              {search
                ? "Modifiez votre recherche"
                : "Ajoutez les coordonnées de votre entreprise pour activer le pointage géolocalisé."}
            </div>
            {!search && (
              <button onClick={() => setShowForm(true)}
                style={{ padding: "0.65rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
                + Ajouter ma première zone
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  {["Nom", "Type", "Adresse", "Coordonnées GPS", "Rayon (m)", "Créée le", "Actions"].map(h => (
                    <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((loc, i) => {
                  const tc = TYPE_CFG[loc.type as keyof typeof TYPE_CFG] ?? TYPE_CFG.bureau;
                  return (
                    <tr key={loc.id}
                      style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${theme.border}` : "none", transition: "background 0.12s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Nom */}
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <div style={{ fontWeight: 700, color: theme.textPrimary }}>{loc.name}</div>
                      </td>

                      {/* Type */}
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: tc.bg, color: tc.text }}>
                          {tc.icon} {tc.label}
                        </span>
                      </td>

                      {/* Adresse */}
                      <td style={{ padding: "0.85rem 1rem", color: theme.textMuted, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {loc.address ?? "Non spécifiée"}
                      </td>

                      {/* Coordonnées */}
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <div style={{ fontSize: "0.78rem", color: theme.textMuted, lineHeight: 1.5 }}>
                          <span style={{ color: theme.textSecondary }}>Lat : </span>{loc.latitude.toFixed(5)}
                          <br />
                          <span style={{ color: theme.textSecondary }}>Lng : </span>{loc.longitude.toFixed(5)}
                        </div>
                      </td>

                      {/* Rayon */}
                      <td style={{ padding: "0.85rem 1rem", color: theme.textSecondary, fontWeight: 600 }}>
                        {loc.radius} m
                      </td>

                      {/* Date création */}
                      <td style={{ padding: "0.85rem 1rem", color: theme.textMuted, whiteSpace: "nowrap" }}>
                        {new Date(loc.created_at).toLocaleDateString("fr-FR")}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <div style={{ display: "flex", gap: "0.35rem" }}>
                          {/* Voir sur la carte */}
                          <button
                            onClick={() => window.open(`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`, "_blank")}
                            title="Voir sur Google Maps"
                            style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid ${PALETTE.primary}33`, background: "transparent", color: PALETTE.primary, cursor: "pointer", fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={e => (e.currentTarget.style.background = PALETTE.primary + "18")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >🗺</button>

                          {/* Modifier */}
                          <button
                            onClick={() => { setEditing(loc); setShowForm(true); }}
                            title="Modifier"
                            style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: "1px solid rgba(59,130,246,0.33)", background: "transparent", color: "#3b82f6", cursor: "pointer", fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(59,130,246,0.1)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >✏️</button>

                          {/* Supprimer */}
                          <button
                            onClick={() => handleDelete(loc)}
                            title="Désactiver la zone"
                            style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: "1px solid rgba(239,68,68,0.33)", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal formulaire */}
      {showForm && (
        <WorkLocationFormModal
          dark={dark} theme={theme}
          location={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}