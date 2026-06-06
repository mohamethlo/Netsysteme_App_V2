// ─────────────────────────────────────────────────────────────────────────────
//  src/layouts/MainLayout.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { Outlet }  from "react-router-dom";
import Sidebar     from "../components/layout/Sidebar";
import Header      from "../components/layout/Header";
import { getTheme, FONTS, type Theme } from "../theme";

export interface LayoutContext {
  dark:  boolean;
  theme: Theme;
}

export default function MainLayout() {
  const [dark,    setDark]    = useState(() => localStorage.getItem("ns_theme") !== "light");
  const [mobOpen, setMobOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 769px)");
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setMobOpen(false); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    localStorage.setItem("ns_theme", dark ? "dark" : "light");
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  const theme = getTheme(dark);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: theme.pageBg,
      fontFamily: FONTS.body,
      overflow: "hidden",
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&display=swap"
        rel="stylesheet"
      />

      {/* Header pleine largeur en haut */}
      <Header
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
        onBurger={() => setMobOpen((o) => !o)}
      />

      {/* Sidebar + contenu en dessous */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minWidth: 0 }}>
        <Sidebar dark={dark} mobileOpen={mobOpen} onClose={() => setMobOpen(false)} />

        <main
          className="ns-main"
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "1.75rem",
            scrollbarWidth: "thin",
            scrollbarColor: `${theme.scrollThumb} transparent`,
          }}
        >
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            <Outlet context={{ dark, theme } satisfies LayoutContext} />
          </div>
        </main>
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${theme.scrollThumb}; border-radius: 10px; }

        /* ── Tablette 769–1024 px : sidebar icon-only (64px) ─────────────── */
        @media (max-width: 1024px) and (min-width: 769px) {
          aside { width: 64px !important; }
          .sb-label, .sb-group-label, .sb-user-info { display: none !important; }
          .sb-nav-item  { justify-content: center !important; padding: 0.52rem !important; }
          .sb-user-card { justify-content: center !important; padding: 0.6rem !important; }
          /* Rétrécit la zone logo du header pour s'aligner avec la sidebar réduite */
          .hdr-brand { width: calc(64px - 1rem) !important; }
          .hdr-brand-text { display: none !important; }
          .sb-nav-item { position: relative; }
          .sb-nav-item:hover::after {
            content: attr(data-label);
            position: absolute;
            left: calc(100% + 10px);
            top: 50%; transform: translateY(-50%);
            background: ${theme.popupBg ?? "#1e293b"};
            color: ${theme.textPrimary};
            border: 1px solid ${theme.border};
            padding: 4px 10px; border-radius: 6px;
            font-size: 0.78rem; white-space: nowrap;
            pointer-events: none; z-index: 999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.18);
          }
        }

        /* ── Mobile ≤768 px : drawer ──────────────────────────────────────── */
        @media (max-width: 768px) {
          .mob-burger        { display: flex !important; }
          .mob-overlay       { display: block !important; }
          /* Sur mobile : logo visible mais sans texte, centré */
          .hdr-brand         { width: auto !important; border-right: none !important; }
          .hdr-brand-text    { display: none !important; }
          /* Breadcrumb masqué sur mobile */
          .hdr-breadcrumb    { display: none !important; }
          /* Spacer prend la place du breadcrumb pour pousser les actions à droite */
          .hdr-spacer-mobile { display: flex !important; }
          aside {
            position: fixed !important;
            top: 62px !important;
            left: 0 !important;
            height: calc(100vh - 62px) !important;
            width: 252px !important;
            transform: ${mobOpen ? "translateX(0)" : "translateX(-100%)"} !important;
            transition: transform 0.28s cubic-bezier(0.4,0,0.2,1) !important;
            z-index: 50 !important;
          }
          .ns-main { padding: 0.85rem !important; }
        }

        /* ── Très petit (<480 px) ─────────────────────────────────────────── */
        @media (max-width: 480px) {
          .hdr-profile-name, .hdr-profile-chevron { display: none !important; }
          .hdr-brand-text { display: none !important; }
          .ns-main { padding: 0.65rem !important; }

          /* Notification panel — ancré en position fixe, pleine largeur avec marges */
          .hdr-notif-panel {
            position: fixed !important;
            left: 0.75rem !important;
            right: 0.75rem !important;
            top: 70px !important;
            width: auto !important;
            max-height: calc(100vh - 80px) !important;
            overflow-y: auto !important;
          }

          /* Profile dropdown — ancré à droite en position fixe */
          .hdr-prof-panel {
            position: fixed !important;
            right: 0.75rem !important;
            left: auto !important;
            top: 70px !important;
            min-width: calc(100vw - 1.5rem) !important;
          }
        }
      `}</style>
    </div>
  );
}