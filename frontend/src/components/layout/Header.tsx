// ─────────────────────────────────────────────────────────────────────────────
//  src/components/layout/Header.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useSwal } from "../../hooks/useSwal";
import { getTheme, GRADIENT_PRIMARY, FONTS, RADIUS } from "../../theme";
import { notificationService, getNotifColor, type Notification } from "../../services/notificationService";

const P: Record<string, string> = {
  chevron: "M8.25 4.5l7.5 7.5-7.5 7.5",
  bell:    "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0",
  logout:  "M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75",
  sun:     "M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z",
  moon:    "M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z",
  menu:    "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5",
  user:    "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  key:     "M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z",
};

function Icon({ n, s = 17 }: { n: string; s?: number }) {
  return (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
      <path strokeLinecap="round" strokeLinejoin="round" d={P[n] ?? ""} />
    </svg>
  );
}


interface HeaderProps {
  dark: boolean;
  onToggleDark: () => void;
  onBurger: () => void;
}

export default function Header({ dark, onToggleDark, onBurger }: HeaderProps) {
  const { user, logout }  = useAuthStore();
  const navigate          = useNavigate();
  const location          = useLocation();
  const { confirmLogout } = useSwal();
  const t = getTheme(dark);

  const [profOpen,    setProfOpen]    = useState(false);
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [notifs,      setNotifs]      = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const profRef  = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // ── Polling unread count toutes les 30s ───────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    try {
      const { count } = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const id = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(id);
  }, [fetchUnreadCount]);

  // ── Charger la liste quand le dropdown s'ouvre ────────────────────────────
  const fetchNotifs = useCallback(async () => {
    setNotifLoading(true);
    try {
      const data = await notificationService.getAll();
      setNotifs(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch {}
    finally { setNotifLoading(false); }
  }, []);

  useEffect(() => {
    if (notifOpen) fetchNotifs();
  }, [notifOpen, fetchNotifs]);

  // ── Marquer une notif lue ─────────────────────────────────────────────────
  const handleMarkRead = async (notif: Notification) => {
    if (notif.is_read) return;
    const updated = await notificationService.markRead(notif.id);
    setNotifs(prev => prev.map(n => n.id === updated.id ? updated : n));
    setUnreadCount(c => Math.max(0, c - 1));
  };

  // ── Tout marquer lu ───────────────────────────────────────────────────────
  const handleMarkAllRead = async () => {
    await notificationService.markAllRead();
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  // ── Supprimer ─────────────────────────────────────────────────────────────
  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await notificationService.delete(id);
    setNotifs(prev => {
      const next = prev.filter(n => n.id !== id);
      setUnreadCount(next.filter(n => !n.is_read).length);
      return next;
    });
  };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (profRef.current  && !profRef.current.contains(e.target as Node))  setProfOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    setProfOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  const segs   = location.pathname.replace("/dashboard", "").split("/").filter(Boolean);
  const crumbs = [
    { label: "Dashboard", path: "/dashboard" },
    ...segs.map((s, i) => ({
      label: s.charAt(0).toUpperCase() + s.slice(1),
      path:  "/dashboard/" + segs.slice(0, i + 1).join("/"),
    })),
  ];

  const handleLogout = async () => {
    const ok = await confirmLogout();
    if (ok) { logout(); navigate("/login"); }
  };

  const iconBtn: React.CSSProperties = {
    width: 34, height: 34, borderRadius: RADIUS.md,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "none", border: `1px solid ${t.border}`,
    color: t.textMuted, cursor: "pointer",
    transition: "all 0.15s", fontFamily: FONTS.body,
  };

  const popup: React.CSSProperties = {
    position: "absolute", top: "calc(100% + 8px)", right: 0,
    background: t.popupBg,
    border: `1px solid ${t.border}`,
    borderRadius: RADIUS.lg,
    boxShadow: dark ? "0 24px 64px rgba(0,0,0,0.55)" : "0 16px 48px rgba(0,0,0,0.12)",
    zIndex: 200, overflow: "hidden",
    fontFamily: FONTS.body,
  };

  return (
    <>
    <header style={{
      height: 62, flexShrink: 0,
      background: t.headerBg,
      borderBottom: `1px solid ${t.border}`,
      display: "flex", alignItems: "center",
      padding: "0 1rem",
      gap: "0.5rem",
      position: "sticky", top: 0, zIndex: 30,
      fontFamily: FONTS.body,
    }}>

      {/* ── Burger (mobile only) ── */}
      <button
        onClick={onBurger}
        className="mob-burger"
        style={{ ...iconBtn, display: "none", border: "none", flexShrink: 0 }}
        aria-label="Ouvrir le menu"
      >
        <Icon n="menu" s={20} />
      </button>

      {/* ── Logo + marque — largeur calée sur la sidebar ── */}
      <div
        className="hdr-brand"
        style={{
          display: "flex", alignItems: "center", gap: "0.6rem",
          flexShrink: 0,
          borderRight: `1px solid ${t.border}`,
          /* 252px sidebar − 1rem padding header gauche */
          width: "calc(252px - 1rem)",
          overflow: "hidden",
        }}
      >
        <img
          src="/logo.png"
          alt="Netsysteme"
          style={{
            height: 34, width: "auto",
            objectFit: "contain",
            flexShrink: 0,
            filter: "drop-shadow(0 0 6px rgba(6,182,212,0.35))",
          }}
        />
        <div className="hdr-brand-text">
          <div style={{
            fontSize: "0.82rem", fontWeight: 700,
            color: t.textPrimary, letterSpacing: "-0.01em", lineHeight: 1.2,
            whiteSpace: "nowrap",
          }}>
            NETSYSTEME
          </div>
          <div style={{
            fontSize: "0.55rem", color: t.textMuted,
            letterSpacing: "0.1em", textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}>
            Groupe SSE
          </div>
        </div>
      </div>

      {/* ── Breadcrumb (masqué sur mobile) ── */}
      <nav
        className="hdr-breadcrumb"
        style={{
          flex: 1,
          display: "flex", alignItems: "center", gap: "0.35rem",
          fontSize: "0.82rem",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        {crumbs.map((c, i) => (
          <span
            key={c.path}
            style={{
              display: "flex", alignItems: "center", gap: "0.35rem",
              flexShrink: i < crumbs.length - 1 ? 1 : 0,
              minWidth: 0,
            }}
          >
            {i > 0 && (
              <span style={{ color: t.textMuted, display: "flex", opacity: 0.5, flexShrink: 0 }}>
                <Icon n="chevron" s={12} />
              </span>
            )}
            <span
              onClick={() => i < crumbs.length - 1 && navigate(c.path)}
              style={{
                color:      i === crumbs.length - 1 ? t.textPrimary : t.textMuted,
                fontWeight: i === crumbs.length - 1 ? 500 : 400,
                cursor:     i < crumbs.length - 1 ? "pointer" : "default",
                transition: "color 0.15s",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {c.label}
            </span>
          </span>
        ))}
      </nav>

      {/* ── Spacer mobile (pousse les actions à droite) ── */}
      <div className="hdr-spacer-mobile" style={{ display: "none", flex: 1 }} />

      {/* ── Actions droite ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>

        {/* Theme toggle */}
        <button
          onClick={onToggleDark}
          style={iconBtn}
          onMouseEnter={(e) => (e.currentTarget.style.background = t.navHoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          title={dark ? "Mode clair" : "Mode sombre"}
        >
          {dark ? <Icon n="sun" /> : <Icon n="moon" />}
        </button>

        {/* Notifications */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            onClick={() => { setNotifOpen(!notifOpen); setProfOpen(false); }}
            style={{ ...iconBtn, position: "relative" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = t.navHoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            aria-label="Notifications"
          >
            <Icon n="bell" />
            {unreadCount > 0 && (
              <span style={{
                position: "absolute",
                top: -5, right: -5,
                minWidth: 17, height: 17,
                padding: "0 4px",
                borderRadius: "999px",
                background: "#ef4444",
                border: `2px solid ${t.headerBg}`,
                color: "#fff",
                fontSize: "0.6rem",
                fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                lineHeight: 1,
                fontFamily: FONTS.body,
              }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="hdr-notif-panel" style={{ ...popup, width: "min(340px, calc(100vw - 1.5rem))" }}>

              {/* ── Header dropdown ── */}
              <div style={{ padding: "0.85rem 1rem", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, fontSize: "0.875rem", color: t.textPrimary }}>
                  Notifications{" "}
                  {unreadCount > 0 && (
                    <span style={{ fontSize: "0.7rem", background: "#ef4444", color: "#fff", borderRadius: RADIUS.full, padding: "1px 6px", marginLeft: 6 }}>
                      {unreadCount}
                    </span>
                  )}
                </span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead}
                    style={{ fontSize: "0.72rem", color: "#06b6d4", background: "none", border: "none", cursor: "pointer", fontFamily: FONTS.body, padding: 0 }}>
                    Tout marquer lu
                  </button>
                )}
              </div>

              {/* ── Liste ── */}
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {notifLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "1.5rem" }}>
                    <div style={{ width: 22, height: 22, border: "2.5px solid #06b6d433", borderTopColor: "#06b6d4", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  </div>
                ) : notifs.length === 0 ? (
                  <div style={{ padding: "2rem 1rem", textAlign: "center", color: t.textMuted, fontSize: "0.83rem" }}>
                    <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>🔕</div>
                    Aucune notification
                  </div>
                ) : (
                  notifs.map((n, i) => (
                    <div key={n.id}
                      onClick={() => handleMarkRead(n)}
                      style={{ padding: "0.72rem 1rem", display: "flex", gap: "0.72rem", cursor: "pointer", transition: "background 0.12s", background: !n.is_read ? (dark ? "rgba(255,255,255,0.025)" : "rgba(6,182,212,0.03)") : "transparent", borderBottom: i < notifs.length - 1 ? `1px solid ${t.border}` : "none", position: "relative" }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.navHoverBg)}
                      onMouseLeave={e => (e.currentTarget.style.background = !n.is_read ? (dark ? "rgba(255,255,255,0.025)" : "rgba(6,182,212,0.03)") : "transparent")}
                    >
                      {/* Dot couleur */}
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: getNotifColor(n.message, n.is_read), marginTop: 6, flexShrink: 0 }} />

                      {/* Texte */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.83rem", color: t.textPrimary, fontWeight: n.is_read ? 400 : 600, lineHeight: 1.35, wordBreak: "break-word" }}>{n.message}</div>
                        <div style={{ fontSize: "0.72rem", color: t.textMuted, marginTop: 3 }}>{n.time_ago}</div>
                      </div>

                      {/* Bouton supprimer */}
                      <button onClick={e => handleDelete(e, n.id)}
                        title="Supprimer"
                        style={{ position: "absolute", top: "0.55rem", right: "0.55rem", width: 20, height: 20, borderRadius: "50%", border: "none", background: "transparent", color: t.textMuted, fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.body, opacity: 0.6 }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "#ef4444"; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = "0.6"; e.currentTarget.style.color = t.textMuted; }}>
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* ── Footer ── */}
              {notifs.length > 0 && (
                <div style={{ padding: "0.55rem 1rem", borderTop: `1px solid ${t.border}`, textAlign: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: t.textMuted }}>
                    {notifs.length} notification{notifs.length > 1 ? "s" : ""} — {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile dropdown */}
        <div ref={profRef} style={{ position: "relative" }}>
          <button
            onClick={() => { setProfOpen(!profOpen); setNotifOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.3rem 0.5rem 0.3rem 0.3rem",
              borderRadius: RADIUS.md,
              background: "none", border: `1px solid ${t.border}`,
              cursor: "pointer", transition: "all 0.15s",
              fontFamily: FONTS.body,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = t.navHoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            aria-label="Menu profil"
          >
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: GRADIENT_PRIMARY,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.65rem", fontWeight: 700, color: "#fff", flexShrink: 0,
            }}>
              {user ? `${user.prenom[0]}${user.nom[0]}`.toUpperCase() : "??"}
            </div>
            <span
              className="hdr-profile-name"
              style={{
                fontSize: "0.82rem", fontWeight: 500, color: t.textPrimary,
                maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {user?.prenom}
            </span>
            <span className="hdr-profile-chevron" style={{ color: t.textMuted, display: "flex" }}>
              <Icon n="chevron" s={13} />
            </span>
          </button>

          {profOpen && (
            <div className="hdr-prof-panel" style={{ ...popup, minWidth: 230, right: 0 }}>
              <div style={{ padding: "0.85rem 1rem", borderBottom: `1px solid ${t.border}` }}>
                <div style={{ fontWeight: 600, fontSize: "0.875rem", color: t.textPrimary }}>
                  {user?.prenom} {user?.nom}
                </div>
                <div style={{ fontSize: "0.75rem", color: t.textMuted, marginTop: 2 }}>
                  {user?.email}
                </div>
                <span style={{
                  display: "inline-flex", marginTop: 7,
                  fontSize: "0.68rem", fontWeight: 600,
                  padding: "2px 9px", borderRadius: RADIUS.full,
                  background: "rgba(6,182,212,0.12)", color: "#06b6d4",
                  textTransform: "capitalize",
                }}>
                  {user?.role?.name ?? "—"}
                </span>
              </div>

              {[
                { label: "Mon profil",           icon: "user", path: "/dashboard/profile"         },
                { label: "Changer mot de passe", icon: "key",  path: "/dashboard/change-password" },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => { setProfOpen(false); navigate(item.path); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.65rem",
                    width: "100%", textAlign: "left",
                    padding: "0.62rem 1rem",
                    background: "none", border: "none",
                    fontSize: "0.85rem", color: t.textPrimary,
                    cursor: "pointer", transition: "background 0.15s",
                    fontFamily: FONTS.body,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = t.navHoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ color: t.textMuted, display: "flex" }}>
                    <Icon n={item.icon} s={16} />
                  </span>
                  {item.label}
                </button>
              ))}

              <div style={{ borderTop: `1px solid ${t.border}` }}>
                <button
                  onClick={handleLogout}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.65rem",
                    width: "100%", textAlign: "left",
                    padding: "0.62rem 1rem",
                    background: "none", border: "none",
                    fontSize: "0.85rem", color: "#ef4444",
                    cursor: "pointer", transition: "background 0.15s",
                    fontFamily: FONTS.body,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <Icon n="logout" s={16} />
                  Se déconnecter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </>
  );
}