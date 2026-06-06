// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/attendance/TechLocationsPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import { attendanceService, type TechLocation } from "../../services/attendanceService";
import { FONTS, PALETTE, RADIUS } from "../../theme";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function TechLocationsPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();

  const mapRef  = useRef<HTMLDivElement>(null);
  const mapInst = useRef<L.Map | null>(null);
  const [techs,   setTechs]   = useState<TechLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try { setTechs(await attendanceService.getTechLocations()); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (loading || !mapRef.current) return;
    if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; }

    // Zones uniques
    const zoneMap = new Map<number, TechLocation["work_location"]>();
    techs.forEach(t => { if (t.work_location) zoneMap.set(t.work_location.id, t.work_location); });
    const zones = [...zoneMap.values()];

    // Techniciens avec position GPS
    const withPos = techs.filter(t => t.check_in_lat != null && t.check_in_lng != null);

    // Centre de la carte
    let center: [number, number] = [14.7167, -17.4677]; // Dakar par défaut
    if (zones.length > 0) center = [zones[0]!.latitude, zones[0]!.longitude];
    if (withPos.length > 0) {
      center = [
        withPos.reduce((s, t) => s + t.check_in_lat!, 0) / withPos.length,
        withPos.reduce((s, t) => s + t.check_in_lng!, 0) / withPos.length,
      ];
    }

    const map = L.map(mapRef.current, { zoomControl: true }).setView(center, 14);
    mapInst.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    // Cercles de zones affectées
    zones.forEach(zone => {
      if (!zone) return;
      L.circle([zone.latitude, zone.longitude], {
        radius: zone.radius,
        color: "#3b82f6", fillColor: "#3b82f6",
        fillOpacity: 0.08, weight: 2, dashArray: "6 4",
      }).addTo(map).bindPopup(`<b>${zone.name}</b><br>Rayon : ${zone.radius} m`);

      L.marker([zone.latitude, zone.longitude], {
        icon: L.divIcon({
          html: `<div style="background:#3b82f6;color:#fff;padding:2px 9px;border-radius:5px;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 1px 5px rgba(0,0,0,.3)">${zone.name}</div>`,
          className: "",
          iconAnchor: [-4, 10],
        }),
        interactive: false,
      }).addTo(map);
    });

    // Marqueurs techniciens
    withPos.forEach(tech => {
      const color    = tech.is_in_zone ? "#10b981" : "#f59e0b";
      const initials = tech.full_name.split(" ").map((n: string) => n[0] ?? "").join("").slice(0, 2).toUpperCase();
      const icon     = L.divIcon({
        html: `<div style="width:36px;height:36px;border-radius:50%;background:${color};border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.35)">${initials}</div>`,
        className: "",
        iconSize:   [36, 36],
        iconAnchor: [18, 18],
      });
      const statusLabel = tech.is_in_zone ? "✅ Dans sa zone" : "⚠️ Hors zone";
      const lateLabel   = tech.is_late ? `<br><span style="color:#f59e0b;font-size:11px">⚠ En retard</span>` : "";
      L.marker([tech.check_in_lat!, tech.check_in_lng!], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:155px">
            <b style="font-size:13px">${tech.full_name}</b><br>
            <span style="font-size:12px">${statusLabel}</span><br>
            <span style="font-size:11px;color:#666">Zone : ${tech.work_location?.name ?? "—"}</span><br>
            <span style="font-size:11px;color:#666">Entrée : ${tech.check_in_time ?? "—"}</span>
            ${lateLabel}
          </div>
        `);
    });

    return () => { map.remove(); mapInst.current = null; };
  }, [loading, techs]);

  const inZone  = techs.filter(t => t.check_in_lat != null && t.is_in_zone);
  const outZone = techs.filter(t => t.check_in_lat != null && !t.is_in_zone);
  const absents = techs.filter(t => t.check_in_lat == null);

  return (
    <div style={{ fontFamily: FONTS.body }}>
      {/* En-tête page */}
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontSize: "1.4rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em", margin: 0 }}>
            Localisation des techniciens
          </h1>
          <p style={{ fontSize: "0.85rem", color: theme.textMuted, marginTop: 3, marginBottom: 0 }}>
            Positions GPS du jour · {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: "0.4rem",
            padding: "0.55rem 1.1rem", borderRadius: RADIUS.md,
            border: `1px solid ${theme.border}`,
            background: "transparent", color: theme.textSecondary,
            fontSize: "0.85rem", cursor: loading ? "not-allowed" : "pointer",
            fontFamily: FONTS.body, opacity: loading ? 0.5 : 1,
            transition: "background 0.15s",
          }}
        >
          <span style={{ fontSize: "1rem", lineHeight: 1 }}>{loading ? "⏳" : "↺"}</span>
          Actualiser
        </button>
      </div>

      {/* Compteurs rapides */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.85rem", marginBottom: "1.25rem" }}>
        {[
          { label: "Dans leur zone",  count: inZone.length,  color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)" },
          { label: "Hors zone",       count: outZone.length, color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)" },
          { label: "Absents",         count: absents.length, color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)" },
        ].map(({ label, count, color, bg, border }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: "12px", padding: "0.85rem 1rem" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
            <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginTop: "0.25rem" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Carte */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "16px", overflow: "hidden", marginBottom: "1.25rem" }}>

        {/* Légende */}
        <div style={{ padding: "0.75rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
          {[
            { color: "#10b981", label: "Dans sa zone affectée" },
            { color: "#f59e0b", label: "Hors zone affectée" },
            { color: "#3b82f6", label: "Zone de travail (rayon)" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.78rem", color: theme.textSecondary }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
              {label}
            </div>
          ))}
        </div>

        {/* Zone carte */}
        {error ? (
          <div style={{ height: 480, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem", color: "#ef4444" }}>
            <div style={{ fontSize: "2rem" }}>⚠</div>
            <div style={{ fontSize: "0.875rem" }}>Impossible de charger les données</div>
            <button onClick={load} style={{ padding: "0.5rem 1rem", borderRadius: RADIUS.md, border: "1px solid #ef444450", background: "rgba(239,68,68,0.08)", color: "#ef4444", cursor: "pointer", fontSize: "0.8rem", fontFamily: FONTS.body }}>
              Réessayer
            </button>
          </div>
        ) : loading ? (
          <div style={{ height: 480, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 36, height: 36, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "tlp-spin 0.8s linear infinite" }} />
          </div>
        ) : (
          <div ref={mapRef} style={{ height: 480, width: "100%" }} />
        )}
      </div>

      {/* Grille récapitulative */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
        <div style={{ padding: "0.85rem 1.25rem", borderBottom: `1px solid ${theme.border}` }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: theme.textPrimary }}>
            Récapitulatif — {techs.length} technicien{techs.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ padding: "1rem 1.25rem" }}>
          {techs.length === 0 && !loading ? (
            <div style={{ textAlign: "center", color: theme.textMuted, fontSize: "0.875rem", padding: "1.5rem" }}>
              Aucun technicien enregistré
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.6rem" }}>
              {techs.map(tech => {
                const hasPing     = tech.check_in_lat != null;
                const color       = !hasPing ? "#94a3b8" : tech.is_in_zone ? "#10b981" : "#f59e0b";
                const statusLabel = !hasPing ? "Absent" : tech.is_in_zone ? "Dans sa zone" : "Hors zone";
                const initials    = tech.full_name.split(" ").map((n: string) => n[0] ?? "").join("").slice(0, 2).toUpperCase();
                return (
                  <div key={tech.id} style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.6rem 0.85rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)", border: `1px solid ${theme.border}` }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "11px", fontWeight: 700, flexShrink: 0, boxShadow: `0 0 0 3px ${color}30` }}>
                      {initials}
                    </div>
                    <div style={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.83rem", fontWeight: 600, color: theme.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {tech.full_name}
                      </div>
                      <div style={{ fontSize: "0.72rem", color, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        {statusLabel}
                        {tech.check_in_time && <span style={{ color: theme.textMuted }}>· {tech.check_in_time}</span>}
                        {tech.is_late && <span title="En retard" style={{ color: "#f59e0b" }}>⚠</span>}
                      </div>
                      {hasPing && tech.work_location && (
                        <div style={{ fontSize: "0.68rem", color: theme.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          📍 {tech.work_location.name}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes tlp-spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
