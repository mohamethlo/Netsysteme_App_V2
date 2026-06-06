// src/pages/auth/LoginPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";

// ─── Icons ────────────────────────────────────────────────────────────────────
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width={17} height={17} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ) : (
    <svg width={17} height={17} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" style={{ animation: "lg-spin 0.8s linear infinite" }}>
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
      <path d="M12 2a10 10 0 0110 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ─── Feature item (panneau gauche) ────────────────────────────────────────────
const LEFT_FEATURES = [
  { emoji: "📍", text: "Pointage géolocalisé en temps réel",   color: "#06b6d4" },
  { emoji: "🔧", text: "Suivi des interventions techniques",   color: "#3b82f6" },
  { emoji: "📦", text: "Gestion de stock et inventaire",        color: "#8b5cf6" },
  { emoji: "💰", text: "Tableaux de bord financiers",           color: "#10b981" },
];

function FeatureItem({ item, index }: { item: typeof LEFT_FEATURES[0]; index: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 300 + index * 120);
    return () => clearTimeout(t);
  }, [index]);

  const stagger = `${index * 0.5}s`;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(-12px)",
        transition: "all 0.5s ease",
        animation: visible ? `lg-item-float 3.5s ease-in-out ${stagger} infinite` : undefined,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: item.color + "18",
        border: `1px solid ${item.color}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "1rem",
        animation: visible ? `lg-icon-glow 3s ease-in-out ${stagger} infinite` : undefined,
        ["--item-color" as any]: item.color,
      }}>
        {item.emoji}
      </div>
      <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>
        {item.text}
      </span>
    </div>
  );
}

// ─── LoginPage ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [username, setUsername]     = useState("");
  const [password, setPassword]     = useState("");
  const [showPwd,  setShowPwd]      = useState(false);
  const [loading,  setLoading]      = useState(false);
  const [error,    setError]        = useState("");
  const [focused,  setFocused]      = useState<"username" | "password" | null>(null);
  const [visible,  setVisible]      = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login/", { username, password });
      localStorage.setItem("access_token",  data.access);
      localStorage.setItem("refresh_token", data.refresh);
      login(data.user, data.access, data.refresh);
      const role = data.user.role;
      const isAdmin = data.user.is_staff || role === "Administrateur";
      const isRT    = role === "Responsable Technique";
      if (isAdmin)   navigate("/dashboard");
      else if (isRT) navigate("/dashboard/tech");
      else           navigate("/dashboard/attendance");
    } catch (err: any) {
      const msg = err?.response?.data?.detail;
      setError(
        msg === "No active account found with the given credentials"
          ? "Identifiants incorrects. Vérifiez votre nom d'utilisateur et mot de passe."
          : msg || "Une erreur est survenue. Veuillez réessayer."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lg-root">

      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* ── Blobs ── */}
      <div className="lg-blob lg-blob-1" />
      <div className="lg-blob lg-blob-2" />
      <div className="lg-blob lg-blob-3" />

      {/* ── Grid overlay ── */}
      <div className="lg-grid-bg" />

      {/* ══════════ PANNEAU GAUCHE ══════════ */}
      <div className="lg-left">

        {/* Retour */}
        <button className="lg-back-btn" onClick={() => navigate("/")}>
          <svg width={15} height={15} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Retour
        </button>

        {/* Logo + titre */}
        <div style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(14px)",
          transition: "all 0.6s ease 0.1s",
        }}>
          {/* Badge */}
          <div className="lg-badge" style={{ marginBottom: "1.8rem" }}>
            <span className="lg-badge__dot" />
            Plateforme de gestion interne
          </div>

          {/* Logo image */}
          <div style={{ marginBottom: "1.5rem" }}>
            <img
              src="/logo.png"
              alt="Netsysteme"
              className="lg-logo-img"
            />
          </div>

          <h2 className="lg-left__title">
            Bienvenue sur votre{" "}
            <span className="lg-left__title--grad">espace de gestion</span>
          </h2>
        </div>

        {/* Features */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: "2rem" }}>
          {LEFT_FEATURES.map((f, i) => (
            <FeatureItem key={f.text} item={f} index={i} />
          ))}
        </div>

        {/* Copyright */}
        <p style={{
          marginTop: "auto", paddingTop: "2rem",
          fontSize: "0.72rem", color: "rgba(255,255,255,0.18)",
        }}>
          © {new Date().getFullYear()} Groupe NETSYSTEME – SSE
        </p>
      </div>

      {/* ── Séparateur vertical ── */}
      <div className="lg-divider" />

      {/* ══════════ PANNEAU DROIT (formulaire) ══════════ */}
      <div className="lg-right">

        {/* Bouton retour mobile */}
        <button className="lg-back-btn lg-back-btn--mobile" onClick={() => navigate("/")}>
          <svg width={15} height={15} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Retour
        </button>

        {/* Card formulaire */}
        <div
          className="lg-card"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.65s cubic-bezier(.34,1.2,.64,1) 0.15s",
          }}
        >
          {/* Shimmer auto */}
          <div className="lg-card__shimmer" />

          {/* Logo mobile */}
          <div className="lg-mobile-logo">
            <img
              src="/logo.png"
              alt="Netsysteme"
              style={{ height: 44, width: "auto", objectFit: "contain", filter: "drop-shadow(0 0 10px rgba(6,182,212,0.45))" }}
            />
          </div>

          {/* En-tête */}
          <div style={{ marginBottom: "1.6rem" }}>
            <h1 className="lg-form-title">Connexion</h1>
            <p className="lg-form-subtitle" style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.38)", marginTop: "0.35rem", lineHeight: 1.5 }}>
              Identifiant, email ou numéro de téléphone
            </p>
          </div>

          {/* Erreur */}
          {error && (
            <div className="lg-error">
              <span>⚠</span>
              {error}
            </div>
          )}

          {/* Formulaire */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* Identifiant */}
            <div>
              <label className="lg-label">Identifiant</label>
              <div style={{ position: "relative" }}>
                <div className={`lg-input-icon${focused === "username" ? " lg-input-icon--on" : ""}`}>
                  <svg width={18} height={18} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onFocus={() => setFocused("username")}
                  onBlur={() => setFocused(null)}
                  placeholder="Nom d'utilisateur, email ou téléphone"
                  autoComplete="username"
                  className={`lg-input${focused === "username" ? " lg-input--focused" : ""}`}
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label className="lg-label">Mot de passe</label>
              <div style={{ position: "relative" }}>
                <div className={`lg-input-icon${focused === "password" ? " lg-input-icon--on" : ""}`}>
                  <svg width={18} height={18} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`lg-input${focused === "password" ? " lg-input--focused" : ""}`}
                  style={{ paddingRight: "3rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="lg-eye-btn"
                >
                  <EyeIcon open={showPwd} />
                </button>
              </div>
            </div>

            {/* Bouton soumettre */}
            <button
              type="submit"
              disabled={loading}
              className={`lg-submit${loading ? " lg-submit--loading" : ""}`}
            >
              {loading
                ? <><SpinnerIcon /> Connexion…</>
                : <>
                    Se connecter
                    <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </>
              }
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: "0.72rem", color: "rgba(255,255,255,0.2)", marginTop: "1.5rem" }}>
            Accès réservé aux membres du groupe NETSYSTEME – SSE
          </p>
        </div>
      </div>

      {/* ══════════ STYLES ══════════ */}
      <style>{`
        /* ═══════════════════════════════════
           Keyframes
        ═══════════════════════════════════ */
        @keyframes lg-spin   { to { transform: rotate(360deg); } }

        @keyframes lg-float-1 {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(28px,-38px) scale(1.05); }
          66%      { transform: translate(-18px,18px) scale(0.97); }
        }
        @keyframes lg-float-2 {
          0%,100% { transform: translate(0,0) scale(1); }
          40%      { transform: translate(-36px,28px) scale(1.08); }
          75%      { transform: translate(18px,-18px) scale(0.95); }
        }
        @keyframes lg-float-3 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(22px,30px) scale(1.04); }
        }
        @keyframes lg-ping {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.35; transform:scale(1.55); }
        }
        /* Shimmer de la card */
        @keyframes lg-card-shimmer {
          0%,70%,100% { transform: translateX(-110%) skewX(-12deg); }
          80%          { transform: translateX(210%)  skewX(-12deg); }
        }
        /* Lueur pulsante de la card */
        @keyframes lg-card-glow {
          0%,100% { box-shadow: 0 0 0 1px rgba(6,182,212,0.1), 0 8px 32px rgba(0,0,0,0.4); }
          50%      { box-shadow: 0 0 0 1px rgba(6,182,212,0.3), 0 8px 40px rgba(6,182,212,0.12), 0 16px 48px rgba(0,0,0,0.4); }
        }
        /* Logo glow */
        @keyframes lg-logo-glow {
          0%,100% { filter: drop-shadow(0 0 12px rgba(6,182,212,0.38)) drop-shadow(0 0 24px rgba(59,130,246,0.15)); }
          50%      { filter: drop-shadow(0 0 26px rgba(6,182,212,0.72)) drop-shadow(0 0 48px rgba(59,130,246,0.35)); }
        }
        /* Bouton submit respiration */
        @keyframes lg-btn-breathe {
          0%,100% { box-shadow: 0 0 28px rgba(6,182,212,0.25), 0 4px 14px rgba(0,0,0,0.3); }
          50%      { box-shadow: 0 0 48px rgba(6,182,212,0.5), 0 8px 24px rgba(0,0,0,0.4); }
        }
        /* Feature items float */
        @keyframes lg-item-float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        /* Icône feature glow */
        @keyframes lg-icon-glow {
          0%,100% { box-shadow: none; border-color: color-mix(in srgb, var(--item-color,#06b6d4) 20%, transparent); }
          50%      { box-shadow: 0 0 12px color-mix(in srgb, var(--item-color,#06b6d4) 35%, transparent);
                     border-color: color-mix(in srgb, var(--item-color,#06b6d4) 50%, transparent); }
        }
        /* Input focus ring pulse */
        @keyframes lg-input-focus {
          0%,100% { box-shadow: 0 0 0 2px rgba(6,182,212,0.15); }
          50%      { box-shadow: 0 0 0 4px rgba(6,182,212,0.25); }
        }

        /* ═══════════════════════════════════
           Root
        ═══════════════════════════════════ */
        .lg-root {
          background: #080e1f;
          color: #fff;
          height: 100dvh;
          overflow: hidden;
          display: flex;
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
          position: relative;
        }

        /* ═══════════════════════════════════
           Background
        ═══════════════════════════════════ */
        .lg-blob {
          position: fixed; border-radius: 50%;
          pointer-events: none; filter: blur(80px); z-index: 0;
        }
        .lg-blob-1 {
          width: min(560px,65vw); height: min(560px,65vw);
          top: -15%; right: -5%;
          background: radial-gradient(circle, rgba(59,130,246,0.09) 0%, transparent 70%);
          animation: lg-float-1 20s ease-in-out infinite;
        }
        .lg-blob-2 {
          width: min(480px,55vw); height: min(480px,55vw);
          bottom: -10%; left: -8%;
          background: radial-gradient(circle, rgba(6,182,212,0.09) 0%, transparent 70%);
          animation: lg-float-2 24s ease-in-out infinite;
        }
        .lg-blob-3 {
          width: min(300px,40vw); height: min(300px,40vw);
          top: 35%; left: 40%;
          background: radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%);
          animation: lg-float-3 28s ease-in-out infinite;
        }
        .lg-grid-bg {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(6,182,212,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6,182,212,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        /* ═══════════════════════════════════
           Panneau gauche
        ═══════════════════════════════════ */
        .lg-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 2rem 2.5rem;
          position: relative;
          z-index: 1;
          max-width: 460px;
          overflow: hidden;
        }
        .lg-left__title {
          font-size: clamp(1.4rem, 2.5vw, 2rem);
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -0.03em;
          margin: 0;
        }
        .lg-left__title--grad {
          background: linear-gradient(135deg, #06b6d4, #3b82f6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        /* ═══════════════════════════════════
           Séparateur
        ═══════════════════════════════════ */
        .lg-divider {
          width: 1px;
          background: rgba(255,255,255,0.06);
          align-self: stretch;
          position: relative;
          z-index: 1;
        }

        /* ═══════════════════════════════════
           Panneau droit
        ═══════════════════════════════════ */
        .lg-right {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          position: relative;
          z-index: 1;
          overflow: hidden;
        }

        /* ═══════════════════════════════════
           Card formulaire
        ═══════════════════════════════════ */
        .lg-card {
          position: relative;
          overflow: hidden;
          width: 100%;
          max-width: 400px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 20px;
          padding: 2rem 1.75rem;
          animation: lg-card-glow 3.5s ease-in-out infinite;
        }
        .lg-card__shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.06) 50%, transparent 70%);
          pointer-events: none;
          animation: lg-card-shimmer 5s ease-in-out infinite;
        }

        /* ═══════════════════════════════════
           Logo image
        ═══════════════════════════════════ */
        .lg-logo-img {
          height: 64px;
          width: auto;
          object-fit: contain;
          filter: drop-shadow(0 0 14px rgba(6,182,212,0.45))
                  drop-shadow(0 0 28px rgba(59,130,246,0.2));
          animation: lg-logo-glow 3s ease-in-out infinite;
        }

        /* ═══════════════════════════════════
           Badge
        ═══════════════════════════════════ */
        .lg-badge {
          display: inline-flex; align-items: center; gap: 0.4rem;
          background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.25);
          border-radius: 100px; padding: 0.28rem 0.8rem;
          font-size: 0.68rem; font-weight: 600; letter-spacing: 0.08em;
          color: #06b6d4; text-transform: uppercase;
        }
        .lg-badge__dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #06b6d4; display: inline-block;
          animation: lg-ping 1.5s ease-in-out infinite;
        }

        /* ═══════════════════════════════════
           Bouton retour
        ═══════════════════════════════════ */
        .lg-back-btn {
          display: flex; align-items: center; gap: 0.4rem;
          background: none; border: none;
          color: rgba(255,255,255,0.38); cursor: pointer;
          font-size: 0.8rem; font-weight: 500;
          padding: 0; margin-bottom: 2rem;
          transition: color 0.2s;
        }
        .lg-back-btn:hover { color: #fff; }
        .lg-back-btn--mobile { display: none; }

        /* ═══════════════════════════════════
           Formulaire
        ═══════════════════════════════════ */
        .lg-form-title {
          font-size: 1.55rem; font-weight: 800;
          letter-spacing: -0.03em; margin: 0;
        }
        .lg-label {
          display: block;
          font-size: 0.75rem; font-weight: 600;
          color: rgba(255,255,255,0.45);
          letter-spacing: 0.04em; text-transform: uppercase;
          margin-bottom: 0.45rem;
        }
        .lg-input {
          width: 100%; box-sizing: border-box;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 11px;
          padding: 0.8rem 1rem 0.8rem 2.9rem;
          color: #fff; font-size: 0.9rem;
          outline: none;
          transition: background 0.25s, border-color 0.25s, box-shadow 0.25s;
        }
        .lg-input::placeholder { color: rgba(255,255,255,0.2); }
        .lg-input--focused {
          background: rgba(6,182,212,0.07);
          border-color: rgba(6,182,212,0.5);
          animation: lg-input-focus 2s ease-in-out infinite;
        }
        .lg-input-icon {
          position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%);
          color: rgba(255,255,255,0.25);
          transition: color 0.25s;
          display: flex;
        }
        .lg-input-icon--on { color: #06b6d4; }

        .lg-eye-btn {
          position: absolute; right: 0.8rem; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; padding: 0;
          color: rgba(255,255,255,0.25); display: flex;
          transition: color 0.2s;
        }
        .lg-eye-btn:hover { color: rgba(255,255,255,0.65); }

        .lg-submit {
          display: flex; align-items: center; justify-content: center; gap: 0.55rem;
          background: linear-gradient(135deg, #06b6d4, #3b82f6);
          border: none; border-radius: 12px;
          padding: 0.85rem; width: 100%;
          color: #fff; font-size: 0.9rem; font-weight: 700;
          cursor: pointer; margin-top: 0.25rem;
          transition: transform 0.25s, box-shadow 0.25s, background 0.25s;
          animation: lg-btn-breathe 2.8s ease-in-out infinite;
        }
        .lg-submit:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 52px rgba(6,182,212,0.55), 0 8px 22px rgba(0,0,0,0.4) !important;
          animation: none;
        }
        .lg-submit:active { transform: scale(0.98); animation: none; }
        .lg-submit--loading {
          background: rgba(6,182,212,0.35);
          cursor: not-allowed;
          animation: none;
        }

        .lg-error {
          display: flex; align-items: flex-start; gap: 0.6rem;
          background: rgba(239,68,68,0.09);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 10px; padding: 0.75rem 0.9rem;
          font-size: 0.82rem; color: #fca5a5;
          margin-bottom: 1.2rem;
        }

        /* ═══════════════════════════════════
           Logo mobile
        ═══════════════════════════════════ */
        .lg-mobile-logo {
          display: none;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.5rem;
        }

        /* ═══════════════════════════════════
           Responsive
        ═══════════════════════════════════ */
        @media (max-width: 700px) {
          .lg-left    { display: none !important; }
          .lg-divider { display: none !important; }
          .lg-back-btn--mobile  { display: flex; margin-bottom: 1.2rem; }
          .lg-mobile-logo { display: flex !important; }
          .lg-right { padding: 1.5rem 1rem; justify-content: flex-start; padding-top: 1.8rem; }
          .lg-card  { padding: 1.5rem 1.2rem; border-radius: 16px; }
          .lg-form-title    { text-align: center; }
          .lg-form-subtitle { text-align: center; }
        }
        @media (max-width: 380px) {
          .lg-card      { padding: 1.2rem 1rem; }
          .lg-form-title { font-size: 1.35rem; }
          .lg-submit    { padding: 0.75rem; font-size: 0.85rem; }
        }
      `}</style>
    </div>
  );
}
