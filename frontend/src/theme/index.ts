// ─────────────────────────────────────────────────────────────────────────────
//  src/theme/index.ts
//  Thème NETSYSTEME v2 — Plus ergonomique, contrasté et agréable
// ─────────────────────────────────────────────────────────────────────────────

export const PALETTE = {
  // Couleurs principales du logo NETSYSTEME
  primary:       "#00afd4",   // cyan vif
  primaryEnd:    "#0077b6",   // bleu marine

  // Accent rouge du logo
  red:           "#cc2222",
  redEnd:        "#e53535",

  // Bleu profond
  navy:          "#1a3a6b",
  navyLight:     "#1e4fa0",

  // États sémantiques
  success:       "#10b981",
  warning:       "#f59e0b",
  danger:        "#e53535",
  info:          "#0077b6",
  purple:        "#7c3aed",

  white:         "#ffffff",
  black:         "#000000",
} as const;

// ── Thème sombre ──────────────────────────────────────────────────────────────
// Problème actuel : tout est trop uniformément sombre (#080e1c partout)
// Solution : créer une vraie hiérarchie de profondeur avec 4 niveaux distincts


// ── Thème sombre — textes plus lisibles ───────────────────────────────────────
export const DARK = {
  pageBg:        "#0d1117",
  sidebarBg:     "#161b27",
  headerBg:      "#161b27",
  cardBg:        "#1c2333",
  cardBgHover:   "#222a3d",
  popupBg:       "#242e45",
  inputBg:       "#1a2234",
  inputBgFocus:  "#1e2a40",

  // ── Textes — contrastes significativement rehaussés ───────────────────────
  textPrimary:   "#f0f4ff",          // blanc très légèrement bleuté, pas agressif
  textSecondary: "#a8bfd8",          // bleu grisé clair — bien lisible (était #8fa8c8)
  textMuted:     "#6e8fad",          // plus clair qu'avant (#4a6080 était trop sombre)
  textDisabled:  "#3d5570",          // un peu plus visible

  border:        "#2a3650",
  borderHover:   "#3a4f70",
  borderFocus:   "#00afd4",

  navActiveBg:     "rgba(0,175,212,0.18)",
  navHoverBg:      "rgba(255,255,255,0.06)",
  navActiveAccent: PALETTE.primary,

  scrollThumb:   "#2a3650",
} as const;

// ── Thème clair — textes plus lisibles ───────────────────────────────────────
export const LIGHT = {
  pageBg:        "#eef2f7",
  sidebarBg:     "#ffffff",
  headerBg:      "#ffffff",
  cardBg:        "#ffffff",
  cardBgHover:   "#f5f8fc",
  popupBg:       "#ffffff",
  inputBg:       "#f0f4f9",
  inputBgFocus:  "#e8f4f8",

  // ── Textes — contrastes rehaussés ────────────────────────────────────────
  textPrimary:   "#0a0f1a",          // quasi noir, contraste maximal (était #111827)
  textSecondary: "#1f2d40",          // gris très foncé — bien lisible (était #374151)
  textMuted:     "#4b5e74",          // gris bleuté foncé (était #6b7280 trop clair)
  textDisabled:  "#9eb0c4",          // un peu plus foncé qu'avant

  border:        "#dde3ed",
  borderHover:   "#b8c8de",
  borderFocus:   "#00afd4",

  navActiveBg:     "rgba(0,175,212,0.12)",
  navHoverBg:      "rgba(0,100,160,0.06)",
  navActiveAccent: PALETTE.primary,

  scrollThumb:   "#c8d5e5",
} as const;


export type Theme = typeof DARK;

export function getTheme(dark: boolean): Theme {
  return dark ? DARK : LIGHT;
}

// ── Gradients ─────────────────────────────────────────────────────────────────
export const GRADIENT_PRIMARY = `linear-gradient(135deg, ${PALETTE.primary}, ${PALETTE.primaryEnd})`;
export const GRADIENT_RED     = `linear-gradient(135deg, ${PALETTE.red}, ${PALETTE.redEnd})`;
export const GRADIENT_LOGO    = `linear-gradient(135deg, ${PALETTE.primary}, ${PALETTE.navy}, ${PALETTE.red})`;

// ── Typographie ───────────────────────────────────────────────────────────────
export const FONTS = {
  display: "'Syne', sans-serif",
  body:    "'DM Sans', sans-serif",
  mono:    "'JetBrains Mono', monospace",
} as const;

// ── Rayons ────────────────────────────────────────────────────────────────────
export const RADIUS = {
  sm:   "6px",
  md:   "10px",
  lg:   "14px",
  xl:   "18px",
  full: "9999px",
} as const;

// ── Ombres — clé de l'ergonomie, donnent du relief aux cartes ────────────────
export const SHADOW = {
  dark: {
    // Ombres plus prononcées pour que les cartes ressortent du fond sombre
    card:        "0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
    cardHover:   "0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,175,212,0.2)",
    popup:       "0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)",
    button:      "0 0 20px rgba(0,175,212,0.3)",
    buttonHover: "0 4px 24px rgba(0,175,212,0.5)",
    sidebar:     "2px 0 12px rgba(0,0,0,0.3)",
  },
  light: {
    // Ombres douces mais présentes pour donner du relief
    card:        "0 1px 4px rgba(0,40,80,0.06), 0 4px 12px rgba(0,40,80,0.08)",
    cardHover:   "0 4px 16px rgba(0,40,80,0.12), 0 0 0 1px rgba(0,175,212,0.15)",
    popup:       "0 8px 32px rgba(0,40,80,0.14), 0 2px 8px rgba(0,40,80,0.08)",
    button:      "0 2px 8px rgba(0,175,212,0.25)",
    buttonHover: "0 4px 16px rgba(0,175,212,0.38)",
    sidebar:     "2px 0 8px rgba(0,40,80,0.08)",
  },
} as const;

// ── Couleurs par module ───────────────────────────────────────────────────────
export const MODULE_COLORS: Record<string, string> = {
  dashboard:     PALETTE.primary,
  clients:       PALETTE.navyLight,
  interventions: PALETTE.info,
  installations: PALETTE.success,
  billing:       PALETTE.primary,
  inventory:     PALETTE.warning,
  expenses:      PALETTE.danger,
  advances:      "#f97316",
  attendance:       PALETTE.navyLight,
  messaging:        PALETTE.info,
  chantiers:          "#0e7490",
  outillage:          "#d97706",
  "tech-dashboard":   PALETTE.primary,
  "depenses-terrain": "#7c3aed",
} as const;

// ── Statuts ───────────────────────────────────────────────────────────────────
export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  planifiee:  { bg: "rgba(0,119,182,0.12)",  text: "#0077b6", border: "rgba(0,119,182,0.3)"  },
  en_cours:   { bg: "rgba(245,158,11,0.12)", text: "#d97706", border: "rgba(245,158,11,0.3)" },
  terminee:   { bg: "rgba(16,185,129,0.12)", text: "#059669", border: "rgba(16,185,129,0.3)" },
  annulee:    { bg: "rgba(204,34,34,0.12)",  text: "#cc2222", border: "rgba(204,34,34,0.3)"  },
  draft:      { bg: "rgba(107,114,128,0.12)", text: "#6b7280", border: "rgba(107,114,128,0.3)" },
  sent:       { bg: "rgba(0,119,182,0.12)",  text: "#0077b6", border: "rgba(0,119,182,0.3)"  },
  paid:       { bg: "rgba(16,185,129,0.12)", text: "#059669", border: "rgba(16,185,129,0.3)" },
  overdue:    { bg: "rgba(204,34,34,0.12)",  text: "#cc2222", border: "rgba(204,34,34,0.3)"  },
  en_attente: { bg: "rgba(245,158,11,0.12)", text: "#d97706", border: "rgba(245,158,11,0.3)" },
  approuve:   { bg: "rgba(16,185,129,0.12)", text: "#059669", border: "rgba(16,185,129,0.3)" },
  refuse:     { bg: "rgba(204,34,34,0.12)",  text: "#cc2222", border: "rgba(204,34,34,0.3)"  },
  prospect:   { bg: "rgba(0,119,182,0.12)",  text: "#0077b6", border: "rgba(0,119,182,0.3)"  },
  client:     { bg: "rgba(16,185,129,0.12)", text: "#059669", border: "rgba(16,185,129,0.3)" },
} as const;