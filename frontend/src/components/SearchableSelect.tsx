// ─────────────────────────────────────────────────────────────────────────────
//  src/components/SearchableSelect.tsx
//  Champ de sélection avec recherche intégrée (remplacement des <select>).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from "react";
import { FONTS, RADIUS } from "../theme";

export interface SelectOption {
  value: string;
  label: string;
  sub?: string;   // sous-titre optionnel (ex : prix du produit)
}

interface Theme {
  border: string;
  inputBg: string;
  textPrimary: string;
  textMuted: string;
  popupBg: string;
}

interface Props {
  options:      SelectOption[];
  value:        string;
  onChange:     (value: string) => void;
  placeholder?: string;
  theme:        Theme;
  dark?:        boolean;
  style?:       React.CSSProperties;
}

export function SearchableSelect({
  options, value, onChange,
  placeholder = "Rechercher…",
  theme, dark, style,
}: Props) {
  const selected = options.find(o => o.value === value);
  const [search, setSearch] = useState(selected?.label ?? "");
  const [open,   setOpen]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronise le texte affiché si la valeur change depuis l'extérieur
  useEffect(() => {
    const found = options.find(o => o.value === value);
    setSearch(found?.label ?? "");
  }, [value, options]);

  const filtered = search.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        (o.sub?.toLowerCase().includes(search.toLowerCase()) ?? false)
      )
    : options;

  const handleSelect = (opt: SelectOption) => {
    onChange(opt.value);
    setSearch(opt.label);
    setOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setOpen(true);
    if (!e.target.value) onChange("");
  };

  const handleFocus = () => {
    setSearch(""); // vide pour montrer toutes les options
    setOpen(true);
  };

  const handleBlur = () => {
    // Délai pour laisser le clic sur une option se déclencher avant la fermeture
    setTimeout(() => {
      setOpen(false);
      const found = options.find(o => o.value === value);
      setSearch(found?.label ?? "");
    }, 160);
  };

  const inpStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.6rem 0.85rem",
    borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`,
    background: theme.inputBg,
    color: theme.textPrimary,
    fontSize: "0.875rem",
    fontFamily: FONTS.body,
    outline: "none",
    boxSizing: "border-box",
    ...(style ?? {}),
  };

  return (
    <div style={{ position: "relative", flex: (style as any)?.flex ?? undefined }}>
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoComplete="off"
        style={inpStyle}
      />

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 3px)",
          left: 0,
          right: 0,
          background: theme.popupBg,
          border: `1px solid ${theme.border}`,
          borderRadius: RADIUS.md,
          boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
          zIndex: 9999,
          maxHeight: 230,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch" as any,
        }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: "0.7rem 0.85rem",
              fontSize: "0.82rem",
              color: theme.textMuted,
              fontFamily: FONTS.body,
            }}>
              Aucun résultat
            </div>
          ) : (
            filtered.map((opt, idx) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value || idx}
                  onMouseDown={() => handleSelect(opt)}
                  style={{
                    padding: "0.55rem 0.85rem",
                    cursor: "pointer",
                    borderBottom: idx < filtered.length - 1
                      ? `1px solid ${theme.border}`
                      : "none",
                    background: isSelected
                      ? (dark ? "rgba(6,182,212,0.18)" : "rgba(6,182,212,0.09)")
                      : "transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => {
                    if (!isSelected)
                      e.currentTarget.style.background = dark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.04)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = isSelected
                      ? (dark ? "rgba(6,182,212,0.18)" : "rgba(6,182,212,0.09)")
                      : "transparent";
                  }}
                >
                  <div style={{
                    fontSize: "0.875rem",
                    color: theme.textPrimary,
                    fontFamily: FONTS.body,
                    fontWeight: isSelected ? 600 : 400,
                  }}>
                    {opt.label}
                  </div>
                  {opt.sub && (
                    <div style={{
                      fontSize: "0.72rem",
                      color: theme.textMuted,
                      marginTop: 1,
                    }}>
                      {opt.sub}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
