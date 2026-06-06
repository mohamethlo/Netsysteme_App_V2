// src/pages/LandingPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// ─── Feature data ─────────────────────────────────────────────────────────────
const FEATURES = [
  { emoji: "📍", title: "Pointage géolocalisé", color: "#06b6d4", bg: "rgba(6,182,212,0.12)" },
  { emoji: "🔧", title: "Interventions",         color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  { emoji: "📦", title: "Gestion de stock",      color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  { emoji: "👥", title: "Gestion clientèle",     color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  { emoji: "💰", title: "Suivi des dépenses",    color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  { emoji: "🛡️", title: "Gestion des rôles",     color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
];

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ feat, index, delay }: { feat: typeof FEATURES[0]; index: number; delay: number }) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  // Délai décalé par carte pour que les animations ne soient pas synchronisées
  const stagger = `${index * 0.38}s`;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => setHovered(true)}
      onTouchEnd={() => setTimeout(() => setHovered(false), 400)}
      className={`lp-card${hovered ? " lp-card--hovered" : ""}`}
      style={{
        ["--card-color" as any]: feat.color,
        ["--card-bg"    as any]: feat.bg,
        ["--stagger"    as any]: stagger,
        opacity:   visible ? 1 : 0,
        transition: `opacity 0.5s ease, transform 0.35s cubic-bezier(.34,1.56,.64,1),
                     background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease`,
        // quand visible et non survolé : animation de flottement automatique
        animation: visible && !hovered
          ? `lp-card-float 3.2s ease-in-out ${stagger} infinite`
          : undefined,
        transform: !visible ? "translateY(16px)" : hovered ? "translateY(-6px) scale(1.03)" : undefined,
      }}
    >
      {/* Shimmer automatique */}
      <div
        className="lp-card__shimmer"
        style={{ animation: visible ? `lp-shimmer 4s ease-in-out ${stagger} infinite` : "none" }}
      />

      {/* Corner dot — pulse automatique */}
      <div
        className="lp-card__dot"
        style={{ animation: visible ? `lp-dot-pulse 2.5s ease-in-out ${stagger} infinite` : "none" }}
      />

      {/* Icon */}
      <div
        className={`lp-card__icon-wrap${hovered ? " lp-card__icon-wrap--on" : ""}`}
        style={{ animation: visible ? `lp-icon-glow 3s ease-in-out ${stagger} infinite` : "none" }}
      >
        <span
          className="lp-card__emoji"
          style={{ animation: visible ? `lp-icon-wiggle 3.5s ease-in-out ${stagger} infinite` : "none" }}
        >
          {feat.emoji}
        </span>
        {/* Anneau au survol uniquement */}
        {hovered && <div className="lp-card__ring" />}
      </div>

      <h3
        className="lp-card__title"
        style={{
          color: hovered ? feat.color : undefined,
          animation: visible ? `lp-title-pulse 3s ease-in-out ${stagger} infinite` : "none",
        }}
      >
        {feat.title}
      </h3>

      {/* Barre — respiration automatique */}
      <div
        className="lp-card__bar"
        style={{ animation: visible ? `lp-bar-breathe 2.8s ease-in-out ${stagger} infinite` : "none" }}
      />
    </div>
  );
}

// ─── Main LandingPage ─────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="lp-root">

      {/* ── Google Fonts ── */}
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />

      {/* ── Animated background blobs ── */}
      <div className="lp-blob lp-blob-1" />
      <div className="lp-blob lp-blob-2" />
      <div className="lp-blob lp-blob-3" />

      {/* ── Grid overlay ── */}
      <div className="lp-grid-bg" />

      {/* ══════════ HEADER ══════════ */}
      <header className="lp-header">
        {/* Logo image */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <img
            src="/logo.png"
            alt="Netsysteme logo"
            style={{ height: 36, width: "auto", objectFit: "contain", filter: "drop-shadow(0 0 8px rgba(6,182,212,0.4))" }}
          />
        </div>

        {/* Login button */}
        <button onClick={() => navigate("/login")} className="lp-btn-login">
          <svg width={13} height={13} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          Se connecter
        </button>
      </header>

      {/* ══════════ MAIN ══════════ */}
      <main className="lp-main">

        {/* Hero */}
        <div className="lp-hero">
          {/* Logo hero */}
          <div style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0) scale(1)" : "translateY(-10px) scale(0.9)",
            transition: "all 0.6s cubic-bezier(.34,1.3,.64,1) 0s",
            marginBottom: "0.5rem",
          }}>
            <img
              src="/logo.png"
              alt="Netsysteme"
              className="lp-hero-logo"
            />
          </div>

          {/* Badge */}
          <div
            className="lp-badge"
            style={{
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? "translateY(0)" : "translateY(-8px)",
              transition: "all 0.5s ease 0.15s",
            }}
          >
            <span className="lp-badge__dot" />
            Plateforme de gestion interne
          </div>

          {/* Title */}
          <h1
            className="lp-title"
            style={{
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? "translateY(0)" : "translateY(12px)",
              transition: "all 0.6s ease 0.2s",
            }}
          >
            <span className="lp-title__white">Solution Complète </span>
            <span className="lp-title__gradient">de Gestion</span>
          </h1>

          {/* CTA */}
          <div style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(12px)",
            transition: "all 0.6s ease 0.38s",
          }}>
            <button onClick={() => navigate("/login")} className="lp-btn-cta">
              Accéder à l'application
              <svg width={15} height={15} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Divider */}
        <div
          className="lp-divider"
          style={{ opacity: heroVisible ? 1 : 0, transition: "opacity 0.6s ease 0.55s" }}
        >
          <div className="lp-divider__line" />
          <span className="lp-divider__label">Fonctionnalités</span>
          <div className="lp-divider__line" />
        </div>

        {/* Feature grid */}
        <div className="lp-grid">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} feat={f} index={i} delay={600 + i * 70} />
          ))}
        </div>

      </main>

      {/* ══════════ STYLES ══════════ */}
      <style>{`
        /* ═══════════════════════════════════
           Keyframes
        ═══════════════════════════════════ */
        @keyframes lp-float-1 {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(30px,-40px) scale(1.05); }
          66%      { transform: translate(-20px,20px) scale(0.97); }
        }
        @keyframes lp-float-2 {
          0%,100% { transform: translate(0,0) scale(1); }
          40%      { transform: translate(-40px,30px) scale(1.08); }
          75%      { transform: translate(20px,-20px) scale(0.95); }
        }
        @keyframes lp-float-3 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(25px,35px) scale(1.04); }
        }
        @keyframes lp-ping {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.4; transform:scale(1.5); }
        }
        @keyframes lp-shimmer {
          0%   { transform: translateX(-110%) skewX(-12deg); }
          100% { transform: translateX(210%) skewX(-12deg); }
        }
        @keyframes lp-bounce {
          0%,100% { transform: scale(1) rotate(0deg); }
          20%      { transform: scale(1.25) rotate(-8deg); }
          45%      { transform: scale(0.88) rotate(6deg); }
          65%      { transform: scale(1.1) rotate(-3deg); }
          80%      { transform: scale(0.97) rotate(1deg); }
        }
        @keyframes lp-ring {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes lp-dot-in {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.4); }
          100% { transform: scale(1);  opacity: 1; }
        }
        @keyframes lp-bar-fill {
          from { width: 20px; }
          to   { width: 56px; }
        }
        @keyframes lp-text-glow {
          0%,100% { opacity:1; }
          50%      { opacity:0.7; }
        }

        /* ── Auto-play animations ── */
        /* Flottement léger de la carte */
        @keyframes lp-card-float {
          0%,100% { transform: translateY(0)    scale(1); }
          50%      { transform: translateY(-6px) scale(1.01); }
        }
        /* Shimmer périodique (balayage toutes les 4 s) */
        @keyframes lp-shimmer {
          0%,60%,100% { transform: translateX(-110%) skewX(-12deg); }
          75%          { transform: translateX(210%)  skewX(-12deg); }
        }
        /* Point clignotant dans le coin */
        @keyframes lp-dot-pulse {
          0%,100% { opacity:0.25; transform:scale(0.8); box-shadow:none; }
          50%      { opacity:1;    transform:scale(1.2); box-shadow:0 0 8px var(--card-color); }
        }
        /* Lueur de l'icône */
        @keyframes lp-icon-glow {
          0%,100% { box-shadow:none; border-color:color-mix(in srgb,var(--card-color) 20%,transparent); }
          50%      { box-shadow:0 0 16px color-mix(in srgb,var(--card-color) 40%,transparent);
                     border-color:color-mix(in srgb,var(--card-color) 55%,transparent); }
        }
        /* Petite oscillation de l'emoji */
        @keyframes lp-icon-wiggle {
          0%,80%,100% { transform:scale(1)    rotate(0deg); }
          85%          { transform:scale(1.18) rotate(-7deg); }
          90%          { transform:scale(0.9)  rotate(5deg); }
          95%          { transform:scale(1.06) rotate(-2deg); }
        }
        /* Pulsation de la couleur du titre */
        @keyframes lp-title-pulse {
          0%,100% { color:#fff; }
          50%      { color:var(--card-color); }
        }
        /* Respiration de la barre */
        @keyframes lp-bar-breathe {
          0%,100% { width:20px; box-shadow:none; }
          50%      { width:52px; box-shadow:0 0 7px var(--card-color); }
        }

        /* ═══════════════════════════════════
           Root — full viewport, no scroll
        ═══════════════════════════════════ */
        .lp-root {
          background: #080e1f;
          color: #fff;
          height: 100dvh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
        }

        /* ═══════════════════════════════════
           Background
        ═══════════════════════════════════ */
        .lp-blob {
          position: fixed; border-radius: 50%;
          pointer-events: none; filter: blur(80px); z-index: 0;
        }
        .lp-blob-1 {
          width: min(560px,65vw); height: min(560px,65vw);
          top: -15%; left: -10%;
          background: radial-gradient(circle, rgba(6,182,212,0.09) 0%, transparent 70%);
          animation: lp-float-1 18s ease-in-out infinite;
        }
        .lp-blob-2 {
          width: min(460px,55vw); height: min(460px,55vw);
          bottom: 0%; right: -10%;
          background: radial-gradient(circle, rgba(59,130,246,0.09) 0%, transparent 70%);
          animation: lp-float-2 22s ease-in-out infinite;
        }
        .lp-blob-3 {
          width: min(320px,45vw); height: min(320px,45vw);
          top: 40%; left: 35%;
          background: radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%);
          animation: lp-float-3 26s ease-in-out infinite;
        }
        .lp-grid-bg {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(6,182,212,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6,182,212,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        /* ═══════════════════════════════════
           Header
        ═══════════════════════════════════ */
        .lp-header {
          position: relative; z-index: 10;
          padding: 0.8rem 5%;
          display: flex; align-items: center; justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          backdrop-filter: blur(12px);
          background: rgba(8,14,31,0.6);
          flex-shrink: 0;
        }
        @media (max-width: 480px) {
          .lp-header {
            justify-content: center;
            gap: 0;
          }
          .lp-header > :last-child {
            display: none;
          }
          .lp-header img {
            height: 42px;
          }
        }

        /* ═══════════════════════════════════
           Main area
        ═══════════════════════════════════ */
        .lp-main {
          position: relative; z-index: 1;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 1.2rem 5% 1rem;
          gap: 1rem;
          overflow: hidden;
        }

        /* ═══════════════════════════════════
           Hero
        ═══════════════════════════════════ */
        .lp-hero {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; gap: 0.75rem;
        }
        .lp-badge {
          display: inline-flex; align-items: center; gap: 0.4rem;
          background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.25);
          border-radius: 100px; padding: 0.28rem 0.8rem;
          font-size: 0.68rem; font-weight: 600; letter-spacing: 0.08em;
          color: #06b6d4; text-transform: uppercase;
        }
        .lp-badge__dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #06b6d4; display: inline-block;
          animation: lp-ping 1.5s ease-in-out infinite;
        }
        .lp-title {
          font-size: clamp(1.6rem, 6vw, 2.8rem);
          font-weight: 800; line-height: 1.1; letter-spacing: -0.03em;
          margin: 0; max-width: 520px;
        }
        .lp-title__white {
          background: linear-gradient(135deg,#fff 0%,rgba(255,255,255,0.75) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .lp-title__gradient {
          background: linear-gradient(135deg,#06b6d4,#3b82f6);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }

        /* ═══════════════════════════════════
           Divider
        ═══════════════════════════════════ */
        .lp-divider {
          display: flex; align-items: center; gap: 0.8rem;
          max-width: 460px; width: 100%; margin: 0 auto;
        }
        .lp-divider__line {
          flex: 1; height: 1px; background: rgba(255,255,255,0.07);
        }
        .lp-divider__label {
          font-size: 0.66rem; color: rgba(255,255,255,0.22);
          letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap;
        }

        /* ═══════════════════════════════════
           Feature grid
        ═══════════════════════════════════ */
        .lp-grid {
          display: grid;
          gap: 0.65rem;
          width: 100%;
          max-width: 820px;
          margin: 0 auto;
          grid-template-columns: repeat(2, 1fr);
        }
        @media (min-width: 600px) {
          .lp-grid { grid-template-columns: repeat(3, 1fr); gap: 0.8rem; }
        }

        /* ═══════════════════════════════════
           Buttons
        ═══════════════════════════════════ */
        .lp-btn-login {
          display: flex; align-items: center; gap: 0.4rem;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px; padding: 0.45rem 0.9rem;
          color: rgba(255,255,255,0.85);
          font-size: 0.78rem; font-weight: 600;
          cursor: pointer; white-space: nowrap;
          transition: background 0.25s, border-color 0.25s, color 0.25s, transform 0.2s, box-shadow 0.25s;
        }
        .lp-btn-login:hover {
          background: rgba(6,182,212,0.14); border-color: rgba(6,182,212,0.5);
          color: #fff; transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(6,182,212,0.2);
        }
        .lp-btn-login:active { transform: scale(0.96); }

        .lp-btn-cta {
          display: inline-flex; align-items: center; gap: 0.55rem;
          background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
          border: none; border-radius: 13px;
          padding: 0.75rem 1.6rem;
          color: #fff; font-size: 0.9rem; font-weight: 700;
          cursor: pointer; letter-spacing: -0.01em;
          transition: transform 0.25s, box-shadow 0.25s;
          box-shadow: 0 0 36px rgba(6,182,212,0.3), 0 4px 14px rgba(0,0,0,0.3);
        }
        .lp-btn-cta:hover {
          transform: translateY(-3px);
          box-shadow: 0 0 56px rgba(6,182,212,0.5), 0 10px 24px rgba(0,0,0,0.4);
        }
        .lp-btn-cta:active { transform: scale(0.97); }

        /* ═══════════════════════════════════
           Feature card
        ═══════════════════════════════════ */
        .lp-card {
          position: relative; overflow: hidden;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 0.95rem 0.9rem 0.8rem;
          cursor: default;
          transition:
            background   0.35s ease,
            border-color 0.35s ease,
            transform    0.35s cubic-bezier(.34,1.56,.64,1),
            opacity      0.5s  ease,
            box-shadow   0.35s ease;
        }
        .lp-card--hovered {
          background: var(--card-bg);
          border-color: color-mix(in srgb, var(--card-color) 45%, transparent);
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--card-color) 25%, transparent),
            0 10px 32px color-mix(in srgb, var(--card-color) 18%, transparent),
            0 4px 10px rgba(0,0,0,0.4);
        }
        .lp-card__shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.09) 50%, transparent 70%);
          transform: translateX(-110%) skewX(-12deg);
          pointer-events: none;
        }
        .lp-card--hovered .lp-card__shimmer {
          animation: lp-shimmer 0.6s ease forwards;
        }
        .lp-card__dot {
          position: absolute; top: 11px; right: 11px;
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--card-color);
          pointer-events: none;
        }
        .lp-card__icon-wrap {
          position: relative;
          width: 38px; height: 38px; border-radius: 10px;
          background: var(--card-bg);
          border: 1px solid color-mix(in srgb, var(--card-color) 25%, transparent);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 0.6rem;
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .lp-card__icon-wrap--on {
          border-color: color-mix(in srgb, var(--card-color) 55%, transparent);
          box-shadow: 0 0 18px color-mix(in srgb, var(--card-color) 35%, transparent);
        }
        .lp-card__emoji {
          font-size: 1.2rem; display: block;
        }
        .lp-card__emoji--on {
          animation: lp-bounce 0.55s cubic-bezier(.36,.07,.19,.97) forwards;
        }
        .lp-card__ring {
          position: absolute; inset: -1px; border-radius: 11px;
          border: 2px solid var(--card-color);
          animation: lp-ring 0.7s ease-out forwards;
          pointer-events: none;
        }
        .lp-card__title {
          font-size: 0.82rem; font-weight: 700;
          color: #fff; margin: 0 0 0.5rem; line-height: 1.3;
          transition: color 0.3s;
        }
        .lp-card__title--on {
          color: var(--card-color);
          animation: lp-text-glow 1.2s ease-in-out infinite;
        }
        .lp-card__bar {
          height: 2px; border-radius: 2px;
          background: var(--card-color); width: 20px;
          transition: width 0.35s ease, box-shadow 0.35s ease;
        }
        .lp-card__bar--on {
          animation: lp-bar-fill 0.4s ease forwards;
          box-shadow: 0 0 7px var(--card-color);
        }

        /* ═══════════════════════════════════
           Logo hero
        ═══════════════════════════════════ */
        .lp-hero-logo {
          height: 72px;
          width: auto;
          object-fit: contain;
          filter: drop-shadow(0 0 14px rgba(6,182,212,0.4))
                  drop-shadow(0 0 28px rgba(59,130,246,0.15));
          animation: lp-logo-breathe 3s ease-in-out infinite;
        }
        @keyframes lp-logo-breathe {
          0%,100% { filter: drop-shadow(0 0 12px rgba(6,182,212,0.38))
                            drop-shadow(0 0 26px rgba(59,130,246,0.15)); }
          50%      { filter: drop-shadow(0 0 28px rgba(6,182,212,0.7))
                            drop-shadow(0 0 52px rgba(59,130,246,0.35)); }
        }

        /* ═══════════════════════════════════
           Tiny phones
        ═══════════════════════════════════ */
        @media (max-width: 380px) {
          .lp-main  { padding: 0.8rem 4% 0.6rem; gap: 0.7rem; }
          .lp-title { font-size: 1.45rem; }
          .lp-btn-cta { padding: 0.65rem 1.3rem; font-size: 0.82rem; }
          .lp-card  { padding: 0.75rem 0.7rem 0.65rem; }
          .lp-card__icon-wrap { width: 33px; height: 33px; }
          .lp-card__emoji { font-size: 1.05rem; }
          .lp-hero-logo { height: 54px; }
          .lp-card__title { font-size: 0.75rem; }
        }
      `}</style>
    </div>
  );
}
