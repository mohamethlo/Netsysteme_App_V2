// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/attendance/AttendancePage.tsx  — Responsive version
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import {
  attendanceService, type Attendance, type WorkLocation,
  type TodayResponse, type DailySummary,
} from "../../services/attendanceService";
import { useSwal } from "../../hooks/useSwal";
import { useAuthStore } from "../../store/authStore";
import { FONTS, PALETTE, RADIUS } from "../../theme";
import LateJustifyModal from "./components/LateJustifyModal";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const p1 = (lat2 - lat1) * Math.PI / 180;
  const p2 = (lon2 - lon1) * Math.PI / 180;
  const a  = Math.sin(p1 / 2) ** 2 +
             Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
             Math.sin(p2 / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestZone(lat: number, lon: number, zones: WorkLocation[]) {
  let nearest: WorkLocation | null = null;
  let minDist = Infinity;
  for (const z of zones) {
    const d = haversine(lat, lon, z.latitude, z.longitude);
    if (d < minDist) { minDist = d; nearest = z; }
  }
  return { nearest, minDist };
}

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  present:  { label: "Présent",       bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  late:     { label: "En retard",     bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
  absent:   { label: "Absent",        bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
  half_day: { label: "Demi-journée",  bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  on_leave: { label: "Congé",         bg: "rgba(139,92,246,0.12)",  text: "#8b5cf6" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CFG[status] ?? STATUS_CFG.present;
  return (
    <span style={{
      fontSize: "0.7rem", fontWeight: 600, padding: "3px 8px",
      borderRadius: RADIUS.full, background: s.bg, color: s.text,
      whiteSpace: "nowrap", display: "inline-block",
    }}>
      {s.label}
    </span>
  );
}

// ── Mobile attendance row (card style) ───────────────────────────────────────
function MobileAttendanceRow({ a, theme, dark }: { a: Attendance; theme: any; dark: boolean }) {
  return (
    <div style={{
      padding: "0.85rem 1rem",
      borderBottom: `1px solid ${theme.border}`,
      display: "flex", flexDirection: "column", gap: "0.4rem",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 600, color: theme.textPrimary, fontSize: "0.875rem" }}>
          {a.user_detail?.full_name ?? "—"}
        </div>
        <StatusBadge status={a.status} />
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>
          📅 {new Date(a.date).toLocaleDateString("fr-FR")}
        </span>
        {a.work_location_type && (
          <span style={{
            fontSize: "0.68rem", fontWeight: 600, padding: "2px 7px",
            borderRadius: RADIUS.full,
            background: a.work_location_type === "bureau" ? "rgba(59,130,246,0.12)" : "rgba(6,182,212,0.1)",
            color: a.work_location_type === "bureau" ? "#3b82f6" : PALETTE.primary,
          }}>
            {a.work_location_type === "bureau" ? "Bureau" : "Chantier"}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: "1rem", fontSize: "0.8rem", color: theme.textSecondary }}>
        <span>
          🟢 {a.check_in_str ?? "—"}
          {a.is_late && <span style={{ marginLeft: 4, fontSize: "0.68rem", color: "#f59e0b" }}>⚠</span>}
        </span>
        <span>🔴 {a.check_out_str ?? "—"}</span>
        {a.total_hours > 0 && <span>⏱ {a.total_hours.toFixed(1)}h</span>}
      </div>
      {a.work_location_name && (
        <div style={{ fontSize: "0.75rem", color: theme.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          📍 {a.work_location_name}
        </div>
      )}
    </div>
  );
}

// ── GpsMapCard ────────────────────────────────────────────────────────────────
function GpsMapCard({ gpsPos, gpsErr, nearestZoneObj, inZone, minDist, zones, theme }: {
  gpsPos:        { lat: number; lon: number; accuracy: number } | null;
  gpsErr:        string | null;
  nearestZoneObj: WorkLocation | null;
  inZone:        boolean;
  minDist:       number;
  zones:         WorkLocation[];
  theme:         any;
}) {
  const mapRef    = useRef<HTMLDivElement>(null);
  const mapInst   = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Initialise la carte à la première position GPS disponible
  useEffect(() => {
    if (!gpsPos || !mapRef.current || mapInst.current) return;

    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false })
      .setView([gpsPos.lat, gpsPos.lon], 16);
    mapInst.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

    // Cercles des zones
    zones.forEach(zone => {
      L.circle([zone.latitude, zone.longitude], {
        radius: zone.radius,
        color: "#3b82f6", fillColor: "#3b82f6",
        fillOpacity: 0.08, weight: 2, dashArray: "5 4",
      }).addTo(map).bindPopup(`<b>${zone.name}</b><br>Rayon : ${zone.radius} m`);
    });

    // Marqueur position utilisateur
    const icon = L.divIcon({
      html: `<div style="width:14px;height:14px;border-radius:50%;background:#3b82f6;border:2.5px solid #fff;box-shadow:0 0 0 5px rgba(59,130,246,0.25)"></div>`,
      className: "",
      iconSize:   [14, 14],
      iconAnchor: [7, 7],
    });
    markerRef.current = L.marker([gpsPos.lat, gpsPos.lon], { icon }).addTo(map);

    return () => { map.remove(); mapInst.current = null; markerRef.current = null; };
  }, [!!gpsPos, zones]); // eslint-disable-line react-hooks/exhaustive-deps

  // Met à jour le marqueur à chaque nouvelle position GPS
  useEffect(() => {
    if (!gpsPos || !mapInst.current || !markerRef.current) return;
    markerRef.current.setLatLng([gpsPos.lat, gpsPos.lon]);
    mapInst.current.panTo([gpsPos.lat, gpsPos.lon], { animate: true });
  }, [gpsPos?.lat, gpsPos?.lon]);

  return (
    <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "16px", overflow: "hidden" }}>
      {/* En-tête */}
      <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}` }}>
        <h3 style={{ fontFamily: FONTS.display, fontSize: "0.95rem", fontWeight: 700, color: theme.textPrimary, margin: 0 }}>
          📡 Votre position
        </h3>
      </div>

      {/* États : erreur / chargement / carte */}
      {gpsErr ? (
        <div style={{ padding: "1.25rem" }}>
          <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "0.875rem", color: "#ef4444" }}>
            ❌ {gpsErr}
          </div>
        </div>
      ) : !gpsPos ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2.5rem 1.25rem", gap: "0.6rem" }}>
          <div style={{ width: 28, height: 28, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <div style={{ fontSize: "0.78rem", color: theme.textMuted }}>Localisation en cours…</div>
        </div>
      ) : (
        <>
          {/* Carte Leaflet */}
          <div ref={mapRef} style={{ height: 210, width: "100%" }} />

          {/* Barre de statut */}
          <div style={{ padding: "0.7rem 1.25rem", borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>
              Précision : ±{Math.round(gpsPos.accuracy)} m
            </span>
            {nearestZoneObj ? (
              <div style={{ padding: "0.35rem 0.8rem", borderRadius: RADIUS.full, background: inZone ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)", border: `1px solid ${inZone ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`, fontSize: "0.76rem", fontWeight: 600, color: inZone ? "#10b981" : "#f59e0b", whiteSpace: "nowrap" }}>
                {inZone
                  ? `✅ ${nearestZoneObj.name} (${Math.round(minDist)} m)`
                  : `⚠ Hors zone — ${Math.round(minDist)} m`
                }
              </div>
            ) : (
              <div style={{ padding: "0.35rem 0.8rem", borderRadius: RADIUS.full, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", fontSize: "0.76rem", color: "#3b82f6" }}>
                ℹ Nouvelle zone
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── AttendancePage ────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const swal = useSwal();
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.permissions.includes("all") || user?.role === "Administrateur" || user?.role === "Administration";

  // Responsive breakpoint detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 640 && window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
      setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // State
  const [todayData,  setTodayData]  = useState<TodayResponse | null>(null);
  const [summary,    setSummary]    = useState<DailySummary | null>(null);
  const [history,    setHistory]    = useState<Attendance[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [checkBusy,  setCheckBusy]  = useState(false);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState("");
  const [showJustify,setShowJustify]= useState(false);
  const [zoneName,   setZoneName]   = useState("");
  const [needZone,   setNeedZone]   = useState(false);
  const PAGE = 15;

  // GPS
  const [gpsPos,  setGpsPos]  = useState<{ lat: number; lon: number; accuracy: number } | null>(null);
  const [gpsErr,  setGpsErr]  = useState<string | null>(null);
  const watchRef  = useRef<number | null>(null);

  // ── GPS ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) { setGpsErr("Géolocalisation non supportée."); return; }
    watchRef.current = navigator.geolocation.watchPosition(
      p => setGpsPos({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      e => setGpsErr(`GPS : ${e.message}`),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
    return () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: PAGE };
      if (search) params.search = search;
      const [td, hist] = await Promise.all([
        attendanceService.getToday(),
        attendanceService.getAll(params),
      ]);
      setTodayData(td);
      setHistory(hist.results);
      setTotal(hist.count);
      if (td.needs_justification) setShowJustify(true);

      if (isAdmin) {
        const sum = await attendanceService.getDailySummary();
        setSummary(sum);
      }
    } catch { swal.serverError(); } finally { setLoading(false); }
  }, [page, search, isAdmin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  const att = todayData?.today_attendance;
  const zones = todayData?.work_locations ?? [];

  const { nearest: nearestZoneObj, minDist } = gpsPos
    ? nearestZone(gpsPos.lat, gpsPos.lon, zones)
    : { nearest: null, minDist: Infinity };
  const inZone = nearestZoneObj ? minDist <= nearestZoneObj.radius : false;

  // ── Check-in ──────────────────────────────────────────────────────────────
  const handleCheckIn = async (zName?: string) => {
    if (!gpsPos) { swal.error("GPS", "Position non disponible."); return; }
    setCheckBusy(true);
    try {
      const res = await attendanceService.checkIn({
        latitude:      gpsPos.lat,
        longitude:     gpsPos.lon,
        location_name: zName || (inZone ? nearestZoneObj!.name : undefined),
      });
      if (res.need_zone_name) { setNeedZone(true); setCheckBusy(false); return; }
      if (res.success) { swal.success(res.message); load(); }
      else             { swal.error("Erreur", res.message); }
    } catch { swal.serverError(); } finally { setCheckBusy(false); setNeedZone(false); }
  };

  // ── Check-out ─────────────────────────────────────────────────────────────
  const handleCheckOut = async () => {
    if (!gpsPos) { swal.error("GPS", "Position non disponible."); return; }
    setCheckBusy(true);
    try {
      const res = await attendanceService.checkOut({ latitude: gpsPos.lat, longitude: gpsPos.lon, location: "Position sortie" });
      if (res.success) { swal.success(res.message); load(); }
      else             { swal.error("Erreur", res.message); }
    } catch { swal.serverError(); } finally { setCheckBusy(false); }
  };

  // ── Justification retard ──────────────────────────────────────────────────
  const handleJustify = async (reason: string) => {
    const res = await attendanceService.justifyLate(reason);
    if (res.success) { swal.success("Justification envoyée."); setShowJustify(false); load(); }
    else             { throw new Error(res.message); }
  };

  const gpsOk = gpsPos && gpsPos.accuracy <= 1000;

  // ── Carte pointage du jour ────────────────────────────────────────────────
  const renderTodayCard = () => (
    <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "16px", overflow: "hidden" }}>
      <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}` }}>
        <h3 style={{ fontFamily: FONTS.display, fontSize: "0.95rem", fontWeight: 700, color: theme.textPrimary, margin: 0 }}>
          🕐 Pointage du jour
        </h3>
        <div style={{ fontSize: "0.78rem", color: theme.textMuted, marginTop: 2 }}>
          {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </div>
      </div>
      <div style={{ padding: "1.25rem" }}>
        {att?.check_in && att?.check_out ? (
          <>
            <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", marginBottom: "0.75rem", fontSize: "0.875rem", color: "#10b981", fontWeight: 600 }}>
              ✅ Journée terminée
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr",
              gap: "0.75rem",
            }}>
              {[["Entrée", att.check_in_str], ["Sortie", att.check_out_str], ["Durée", `${att.total_hours.toFixed(1)}h`]].map(([l, v]) => (
                <div key={l} style={{ textAlign: "center", padding: "0.65rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)", border: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: "0.7rem", color: theme.textMuted, marginBottom: 2 }}>{l}</div>
                  <div style={{ fontWeight: 700, color: theme.textPrimary, fontSize: isMobile ? "0.9rem" : "1rem" }}>{v}</div>
                </div>
              ))}
            </div>
          </>
        ) : att?.check_in ? (
          <>
            <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", marginBottom: "0.75rem", fontSize: "0.875rem", color: "#3b82f6" }}>
              🔄 En service depuis <strong>{att.check_in_str}</strong>
              {att.check_in_location && <> — {att.check_in_location}</>}
              {att.is_late && <span style={{ marginLeft: 6, fontSize: "0.72rem", fontWeight: 600, color: "#f59e0b" }}>⚠ Retard</span>}
            </div>
            <button
              onClick={handleCheckOut}
              disabled={checkBusy || !gpsOk}
              style={{
                width: "100%",
                padding: isMobile ? "0.9rem" : "0.75rem",
                borderRadius: RADIUS.md, border: "none",
                background: gpsOk ? "linear-gradient(135deg,#ef4444,#dc2626)" : theme.border,
                color: "#fff", fontSize: "0.875rem", fontWeight: 600,
                cursor: gpsOk ? "pointer" : "not-allowed",
                fontFamily: FONTS.body, opacity: !gpsOk ? 0.5 : 1,
                touchAction: "manipulation",
              }}>
              {checkBusy ? "⏳ Enregistrement…" : "🚪 Pointer la sortie"}
            </button>
          </>
        ) : (
          <>
            <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", marginBottom: "0.75rem", fontSize: "0.875rem", color: "#f59e0b" }}>
              ⏰ Vous n'avez pas encore pointé aujourd'hui
            </div>
            {needZone ? (
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ fontSize: "0.78rem", color: theme.textMuted, display: "block", marginBottom: 4 }}>Nom du lieu *</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    value={zoneName}
                    onChange={e => setZoneName(e.target.value)}
                    placeholder="Ex: Chantier Almadies"
                    style={{
                      flex: 1, padding: "0.65rem 0.85rem", borderRadius: RADIUS.md,
                      border: `1px solid ${theme.border}`, background: theme.inputBg,
                      color: theme.textPrimary, fontSize: "0.875rem",
                      fontFamily: FONTS.body, outline: "none",
                    }}
                  />
                  <button
                    onClick={() => handleCheckIn(zoneName)}
                    disabled={!zoneName.trim() || checkBusy}
                    style={{
                      padding: "0.65rem 1rem", borderRadius: RADIUS.md, border: "none",
                      background: PALETTE.primary, color: "#fff", fontSize: "0.875rem",
                      cursor: "pointer", fontFamily: FONTS.body,
                      minWidth: 44, touchAction: "manipulation",
                    }}>
                    ✓
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => handleCheckIn()}
                disabled={checkBusy || !gpsOk}
                style={{
                  width: "100%",
                  padding: isMobile ? "0.9rem" : "0.75rem",
                  borderRadius: RADIUS.md, border: "none",
                  background: gpsOk ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : theme.border,
                  color: "#fff", fontSize: "0.875rem", fontWeight: 600,
                  cursor: gpsOk ? "pointer" : "not-allowed",
                  fontFamily: FONTS.body, opacity: !gpsOk ? 0.5 : 1,
                  touchAction: "manipulation",
                }}>
                {checkBusy ? "⏳ Enregistrement…" : "📍 Pointer l'entrée"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );


  // ── Résumé journalier admin ───────────────────────────────────────────────
  const renderDailySummary = () => {
    if (!summary) return null;
    return (
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(3,1fr)",
        gap: "1rem",
        marginBottom: "1.5rem",
      }}>
        {[
          { title: `✅ Présents (${summary.presents.length})`, color: "#10b981", users: summary.presents, retards: summary.retards },
          { title: `❌ Absents (${summary.absents.length})`,   color: "#ef4444", users: summary.absents, retards: [] },
          { title: `⚠ En retard (${summary.retards.length})`, color: "#f59e0b", users: summary.retards, retards: [] },
        ].map(({ title, color, users, retards }) => (
          <div key={title} style={{ background: theme.cardBg, border: `1px solid ${color}33`, borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ padding: "0.75rem 1rem", background: color + "12", borderBottom: `1px solid ${color}22`, fontWeight: 700, fontSize: "0.875rem", color }}>
              {title}
            </div>
            <div style={{ padding: "0.75rem 1rem", maxHeight: 180, overflowY: "auto" }}>
              {users.length === 0 ? (
                <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>Aucun</span>
              ) : users.map((u: any) => (
                <div key={u.id} style={{ fontSize: "0.82rem", color: theme.textSecondary, marginBottom: 4 }}>
                  {u.full_name}
                  {u.notes && <div style={{ fontSize: "0.72rem", color: theme.textMuted }}>↳ {u.notes}</div>}
                  {retards.find((r: any) => r.id === u.id) && (
                    <span style={{ marginLeft: 4, fontSize: "0.68rem", fontWeight: 600, padding: "1px 5px", borderRadius: RADIUS.full, background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>Retard</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const totalPages = Math.ceil(total / PAGE);

  // ── Pagination compacte pour mobile ──────────────────────────────────────
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    // Sur mobile : affiche moins de boutons de page
    const maxVisible = isMobile ? 3 : 7;
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    return (
      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        justifyContent: "space-between",
        alignItems: isMobile ? "stretch" : "center",
        padding: "0.85rem 1.25rem",
        borderTop: `1px solid ${theme.border}`,
        gap: isMobile ? "0.65rem" : 0,
      }}>
        <span style={{ fontSize: "0.8rem", color: theme.textMuted, textAlign: isMobile ? "center" : "left" }}>
          Page {page} / {totalPages} — {total} résultat{total > 1 ? "s" : ""}
        </span>
        <div style={{ display: "flex", gap: "0.35rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: isMobile ? "0.5rem 0.85rem" : "0.38rem 0.75rem",
              borderRadius: RADIUS.md, border: `1px solid ${theme.border}`,
              background: "transparent", color: theme.textMuted,
              cursor: page === 1 ? "not-allowed" : "pointer",
              opacity: page === 1 ? 0.4 : 1, fontFamily: FONTS.body,
              fontSize: "0.8rem", touchAction: "manipulation",
              minWidth: 44, minHeight: 38,
            }}>← Préc.</button>

          {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                width: isMobile ? 38 : 32,
                height: isMobile ? 38 : 32,
                borderRadius: RADIUS.md,
                border: `1px solid ${p === page ? PALETTE.primary : theme.border}`,
                background: p === page ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : "transparent",
                color: p === page ? "#fff" : theme.textMuted,
                fontSize: "0.8rem", cursor: "pointer",
                fontFamily: FONTS.body, touchAction: "manipulation",
              }}>
              {p}
            </button>
          ))}

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              padding: isMobile ? "0.5rem 0.85rem" : "0.38rem 0.75rem",
              borderRadius: RADIUS.md, border: `1px solid ${theme.border}`,
              background: "transparent", color: theme.textMuted,
              cursor: page === totalPages ? "not-allowed" : "pointer",
              opacity: page === totalPages ? 0.4 : 1, fontFamily: FONTS.body,
              fontSize: "0.8rem", touchAction: "manipulation",
              minWidth: 44, minHeight: 38,
            }}>Suiv. →</button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: FONTS.body }}>
      {/* Header */}
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontFamily: FONTS.display, fontSize: isMobile ? "1.25rem" : "1.5rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em", margin: 0 }}>
          Pointage
        </h1>
        <p style={{ fontSize: "0.85rem", color: theme.textMuted, marginTop: 3, marginBottom: 0 }}>
          Gestion des présences et absences
        </p>
      </div>

      {/* Pointage + GPS — empilement sur mobile, côte à côte sinon */}
      <div className="att-top-grid">
        {renderTodayCard()}
        <GpsMapCard
          gpsPos={gpsPos}
          gpsErr={gpsErr}
          nearestZoneObj={nearestZoneObj}
          inZone={inZone}
          minDist={minDist}
          zones={zones}
          theme={theme}
        />
      </div>

      {/* Résumé journalier admin */}
      {isAdmin && renderDailySummary()}

      {/* Historique */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>

        {/* En-tête historique */}
        <div style={{
          padding: "1rem 1.25rem",
          borderBottom: `1px solid ${theme.border}`,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          alignItems: isMobile ? "stretch" : "center",
          gap: isMobile ? "0.65rem" : 0,
        }}>
          <h3 style={{ fontFamily: FONTS.display, fontSize: "0.95rem", fontWeight: 700, color: theme.textPrimary, margin: 0 }}>
            📋 Historique des pointages
          </h3>
          <div style={{ position: "relative", width: isMobile ? "100%" : "auto" }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Chercher…"
              style={{
                padding: "0.5rem 0.85rem 0.5rem 2rem",
                borderRadius: RADIUS.md,
                border: `1px solid ${theme.border}`,
                background: theme.inputBg,
                color: theme.textPrimary,
                fontSize: "0.85rem", outline: "none",
                fontFamily: FONTS.body,
                width: isMobile ? "100%" : 180,
                boxSizing: "border-box",
                minHeight: 38,
              }}
            />
            <span style={{ position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted, fontSize: "0.85rem" }}>🔍</span>
          </div>
        </div>

        {/* Contenu */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: theme.textMuted }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🕐</div>
            <div>Aucun pointage enregistré</div>
          </div>
        ) : isMobile ? (
          // ── Vue mobile : cards ───────────────────────────────────────────
          <div>
            {history.map((a) => (
              <MobileAttendanceRow key={a.id} a={a} theme={theme} dark={dark} />
            ))}
          </div>
        ) : (
          // ── Vue desktop/tablette : tableau ───────────────────────────────
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body, minWidth: isTablet ? 600 : "auto" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  {(isTablet
                    ? ["Date", "Agent", "Entrée", "Sortie", "Statut"]
                    : ["Date", "Agent", "Type", "Entrée", "Sortie", "Durée", "Lieu", "Statut"]
                  ).map(h => (
                    <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((a, i) => (
                  <tr key={a.id} style={{ borderBottom: i < history.length - 1 ? `1px solid ${theme.border}` : "none", transition: "background 0.12s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap", color: theme.textSecondary }}>
                      {new Date(a.date).toLocaleDateString("fr-FR")}
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <div style={{ fontWeight: 600, color: theme.textPrimary }}>{a.user_detail?.full_name ?? "—"}</div>
                    </td>
                    {!isTablet && (
                      <td style={{ padding: "0.85rem 1rem" }}>
                        {a.work_location_type && (
                          <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 7px", borderRadius: RADIUS.full, background: a.work_location_type === "bureau" ? "rgba(59,130,246,0.12)" : "rgba(6,182,212,0.1)", color: a.work_location_type === "bureau" ? "#3b82f6" : PALETTE.primary }}>
                            {a.work_location_type === "bureau" ? "Bureau" : "Chantier"}
                          </span>
                        )}
                      </td>
                    )}
                    <td style={{ padding: "0.85rem 1rem", color: a.is_late ? "#f59e0b" : theme.textSecondary, fontWeight: a.is_late ? 600 : 400 }}>
                      {a.check_in_str ?? "—"}
                      {a.is_late && <span style={{ marginLeft: 4, fontSize: "0.68rem" }}>⚠</span>}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", color: theme.textSecondary }}>{a.check_out_str ?? "—"}</td>
                    {!isTablet && (
                      <>
                        <td style={{ padding: "0.85rem 1rem", color: theme.textMuted }}>
                          {a.total_hours > 0 ? `${a.total_hours.toFixed(1)}h` : "—"}
                        </td>
                        <td style={{ padding: "0.85rem 1rem", color: theme.textMuted, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.work_location_name ?? "—"}
                        </td>
                      </>
                    )}
                    <td style={{ padding: "0.85rem 1rem" }}><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {renderPagination()}
      </div>

      {/* Modal justification retard */}
      {showJustify && (
        <LateJustifyModal dark={dark} theme={theme}
          onClose={() => setShowJustify(false)}
          onSubmit={handleJustify} />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }

        /* Grille Pointage + GPS */
        .att-top-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
          margin-bottom: 1.5rem;
        }
        @media (max-width: 639px) {
          .att-top-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}