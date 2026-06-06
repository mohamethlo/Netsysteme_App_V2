import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark:      boolean;
  theme:     LayoutContext["theme"];
  busy?:     boolean;
  onConfirm: (signatureData: string | null) => void;
  onCancel:  () => void;
}

const CSS = `
  .sig-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    z-index: 600; display: flex; align-items: center; justify-content: center;
    padding: 1rem;
  }

  .sig-modal {
    width: 100%; max-width: 680px; border-radius: 18px;
    display: flex; flex-direction: column; overflow: hidden;
  }

  .sig-header {
    padding: 1rem 1.25rem;
    display: flex; justify-content: space-between; align-items: center;
  }

  .sig-body {
    padding: 0 1.25rem 1rem;
    display: flex; flex-direction: column; gap: 0.75rem;
  }

  .sig-canvas-wrapper {
    border-radius: 12px; overflow: hidden;
    touch-action: none; cursor: crosshair;
  }

  .sig-canvas {
    width: 100% !important;
    height: 220px !important;
    display: block;
  }
  @media (min-width: 500px) {
    .sig-canvas { height: 260px !important; }
  }

  .sig-footer {
    padding: 0.9rem 1.25rem;
    display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end;
  }

  .sig-btn {
    padding: 0.55rem 1rem; border-radius: 8px;
    font-size: 0.85rem; font-weight: 600; cursor: pointer;
    border: none; font-family: inherit;
    transition: opacity 0.15s;
  }
  .sig-btn:disabled { opacity: 0.5; cursor: not-allowed; }
`;

export default function SignatureModal({ dark, theme, busy, onConfirm, onCancel }: Props) {
  const sigRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleClear = () => {
    sigRef.current?.clear();
    setIsEmpty(true);
  };

  const handleSkip = () => onConfirm(null);

  const handleValidate = () => {
    if (isEmpty || !sigRef.current || sigRef.current.isEmpty()) {
      onConfirm(null);
    } else {
      onConfirm(sigRef.current.toDataURL("image/png"));
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="sig-overlay">
        <div
          className="sig-modal"
          style={{
            background:  theme.popupBg,
            border:      `1px solid ${theme.border}`,
            boxShadow:   dark
              ? "0 32px 80px rgba(0,0,0,0.7)"
              : "0 24px 60px rgba(0,0,0,0.18)",
            fontFamily: FONTS.body,
          }}
        >
          {/* Header */}
          <div
            className="sig-header"
            style={{ borderBottom: `1px solid ${theme.border}` }}
          >
            <div>
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontSize:   "1.05rem",
                  fontWeight: 700,
                  color:      theme.textPrimary,
                  marginBottom: 2,
                }}
              >
                ✍️ Signature du représentant
              </div>
              <div style={{ fontSize: "0.78rem", color: theme.textMuted }}>
                Demandez au client de signer ci-dessous pour valider l'intervention
              </div>
            </div>
            <button
              onClick={onCancel}
              disabled={busy}
              style={{
                background: "none",
                border:     "none",
                color:      theme.textMuted,
                cursor:     "pointer",
                fontSize:   "1.3rem",
                padding:    4,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>

          {/* Corps — canvas */}
          <div className="sig-body" style={{ paddingTop: "1rem" }}>
            <div
              style={{
                fontSize:   "0.78rem",
                color:      theme.textMuted,
                textAlign:  "center",
              }}
            >
              Zone de signature — tracez avec le doigt ou la souris
            </div>

            <div
              className="sig-canvas-wrapper"
              style={{
                border:     `2px dashed ${theme.border}`,
                background: "#ffffff",
              }}
            >
              <SignatureCanvas
                ref={sigRef}
                penColor="#1a1a1a"
                backgroundColor="#ffffff"
                canvasProps={{ className: "sig-canvas" }}
                onBegin={() => setIsEmpty(false)}
              />
            </div>

            {!isEmpty && (
              <button
                onClick={handleClear}
                style={{
                  alignSelf:   "flex-start",
                  background:  "none",
                  border:      `1px solid ${theme.border}`,
                  borderRadius: RADIUS.md,
                  color:       theme.textMuted,
                  fontSize:    "0.78rem",
                  cursor:      "pointer",
                  padding:     "0.3rem 0.75rem",
                  fontFamily:  FONTS.body,
                }}
              >
                🗑 Effacer la signature
              </button>
            )}
          </div>

          {/* Footer */}
          <div
            className="sig-footer"
            style={{ borderTop: `1px solid ${theme.border}` }}
          >
            <button
              className="sig-btn"
              onClick={handleSkip}
              disabled={busy}
              style={{
                background: "transparent",
                border:     `1px solid ${theme.border}`,
                color:      theme.textSecondary,
                marginRight: "auto",
              }}
            >
              Passer sans signature
            </button>

            <button
              className="sig-btn"
              onClick={onCancel}
              disabled={busy}
              style={{
                background: "transparent",
                border:     `1px solid ${theme.border}`,
                color:      theme.textSecondary,
              }}
            >
              Annuler
            </button>

            <button
              className="sig-btn"
              onClick={handleValidate}
              disabled={busy || isEmpty}
              style={{
                background: isEmpty
                  ? "#aaa"
                  : `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`,
                color: "#fff",
                cursor: isEmpty ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Enregistrement…" : "✓ Valider et terminer"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
