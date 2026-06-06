import { useState } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { smsService, type SMSDomain, type SMSDomainInfo } from "../../../services/smsService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark:     boolean;
  theme:    LayoutContext["theme"];
  domains?: SMSDomainInfo[];
  onClose:  () => void;
  onSent:   () => void;
}

function formatPhone(p: string): string {
  p = p.replace(/\s+/g, "").replace(/[^\d+]/g, "");
  if (p.startsWith("tel:+"))  return p.replace("tel:", "");
  if (p.startsWith("+"))      return p;
  if (p.startsWith("00221"))  return "+" + p.slice(2);
  if (p.startsWith("221"))    return "+" + p;
  if (p.length === 9 && (p[0] === "7" || p[0] === "8")) return "+221" + p;
  return "+221" + p;
}

function isValid(p: string): boolean {
  return /^\+221[7-9]\d{8}$/.test(p);
}

const DEFAULT_DOMAINS: SMSDomainInfo[] = [
  { value: "NETSYSTEME", label: "NETSYSTEME", sender_name: "NETSYSTEME" },
  { value: "SSE",        label: "SSE",        sender_name: "SSE" },
];

const CSS = `
  @keyframes qs-spin { to { transform: rotate(360deg); } }

  .qs-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 500;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  @media (min-width: 640px) {
    .qs-overlay { align-items: center; padding: 1rem; }
  }

  .qs-modal {
    width: 100%;
    max-height: 97vh;
    overflow-y: auto;
    border-radius: 18px 18px 0 0;
  }
  @media (min-width: 640px) {
    .qs-modal { max-width: 820px; border-radius: 18px; max-height: 95vh; }
  }

  .qs-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
  @media (min-width: 640px) {
    .qs-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
      padding: 1.5rem;
    }
  }
`;

export default function QuickSendPanel({ dark, theme, domains, onClose, onSent }: Props) {
  const swal = useSwal();

  const domainList: SMSDomainInfo[] = Array.isArray(domains) && domains.length > 0
    ? domains : DEFAULT_DOMAINS;

  const [domain,   setDomain]   = useState<SMSDomain>("NETSYSTEME");
  const [numbers,  setNumbers]  = useState<Set<string>>(new Set());
  const [input,    setInput]    = useState("");
  const [bulk,     setBulk]     = useState("");
  const [message,  setMessage]  = useState("");
  const [sending,  setSending]  = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const addNumber = (raw: string) => {
    const f = formatPhone(raw.trim());
    if (!isValid(f))     { swal.error("Numéro invalide", `${raw} — format : 77XXXXXXX`); return false; }
    if (numbers.has(f))  { swal.error("Doublon", "Ce numéro est déjà dans la liste.");   return false; }
    setNumbers(prev => new Set([...prev, f]));
    return true;
  };

  const removeNumber = (n: string) =>
    setNumbers(prev => { const s = new Set(prev); s.delete(n); return s; });

  const addBulk = () => {
    let added = 0, failed = 0;
    bulk.split("\n").forEach(line => { if (line.trim()) { addNumber(line) ? added++ : failed++; } });
    setBulk("");
    swal.success(`${added} numéro(s) ajouté(s)${failed > 0 ? `, ${failed} invalide(s)` : ""}`);
  };

  const handleSend = async () => {
    if (numbers.size === 0) { swal.error("Requis", "Ajoutez au moins un numéro."); return; }
    if (!message.trim())   { swal.error("Requis", "Rédigez un message."); return; }
    if (!await swal.confirm({ title: `Envoyer à ${numbers.size} numéro(s) via ${domain} ?`, icon: "question", confirmText: "Envoyer" })) return;

    setSending(true);
    const list = Array.from(numbers);
    setProgress({ done: 0, total: list.length });
    let ok = 0, fail = 0;

    for (let i = 0; i < list.length; i++) {
      try {
        const r = await smsService.sendQuick({ phone: list[i], message, sender_domain: domain });
        r.success ? ok++ : fail++;
      } catch { fail++; }
      setProgress({ done: i + 1, total: list.length });
    }

    setSending(false);
    swal.success(`✅ ${ok} envoyé(s)${fail > 0 ? ` — ❌ ${fail} échec(s)` : ""}`);
    if (ok > 0) { setNumbers(new Set()); setMessage(""); onSent(); }
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.6rem 0.85rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };

  const card: React.CSSProperties = {
    background: theme.cardBg, border: `1px solid ${theme.border}`,
    borderRadius: "14px", padding: "1.1rem",
  };

  const secTitle: React.CSSProperties = {
    fontSize: "0.7rem", fontWeight: 700, color: theme.textMuted,
    textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem",
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="qs-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="qs-modal" style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>

          {/* Header */}
          <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: theme.popupBg, zIndex: 2, borderRadius: "18px 18px 0 0" }}>
            <div>
              <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: theme.textPrimary, marginBottom: 2 }}>
                ⚡ Envoi rapide SMS
              </h2>
              <p style={{ fontSize: "0.75rem", color: theme.textMuted }}>
                Envoyez un SMS à un ou plusieurs destinataires
              </p>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1 }}>✕</button>
          </div>

          <div className="qs-grid">

            {/* ── Colonne gauche : numéros ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>

              {/* Domaine */}
              <div style={card}>
                <div style={secTitle}>🏢 Domaine d'envoi</div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  {domainList.map(d => (
                    <button key={d.value} onClick={() => setDomain(d.value)}
                      style={{ flex: 1, padding: "0.75rem 0.5rem", borderRadius: "12px", cursor: "pointer", fontFamily: FONTS.body, transition: "all 0.15s", border: `2px solid ${domain === d.value ? (d.value === "SSE" ? "#10b981" : PALETTE.primary) : theme.border}`, background: domain === d.value ? (d.value === "SSE" ? "rgba(16,185,129,0.08)" : `rgba(0,175,212,0.08)`) : "transparent", color: domain === d.value ? (d.value === "SSE" ? "#10b981" : PALETTE.primary) : theme.textMuted }}>
                      <div style={{ fontSize: "1.3rem", marginBottom: "0.2rem" }}>{d.value === "SSE" ? "⚡" : "🌐"}</div>
                      <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{d.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ajout numéro unique */}
              <div style={card}>
                <div style={secTitle}>📱 Ajouter un numéro</div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { addNumber(input) && setInput(""); } }}
                    placeholder="771234567"
                    style={{ ...inp, flex: 1 }} />
                  <button onClick={() => { addNumber(input) && setInput(""); }}
                    style={{ padding: "0.6rem 0.9rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap" }}>
                    +
                  </button>
                </div>
                <div style={{ fontSize: "0.7rem", color: theme.textMuted, marginTop: "0.3rem" }}>
                  Formats : 77XXXXXXX · +221 77 XXX XX XX
                </div>
              </div>

              {/* Ajout multiple */}
              <div style={card}>
                <div style={secTitle}>📋 Plusieurs numéros (un par ligne)</div>
                <textarea rows={3} value={bulk} onChange={e => setBulk(e.target.value)}
                  placeholder={"771234567\n781234567"}
                  style={{ ...inp, resize: "vertical" }} />
                <button onClick={addBulk}
                  style={{ marginTop: "0.5rem", padding: "0.48rem 0.9rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body }}>
                  Ajouter tous
                </button>
              </div>

              {/* Liste numéros */}
              {numbers.size > 0 && (
                <div style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                    <div style={secTitle}>✅ {numbers.size} numéro(s)</div>
                    <button onClick={() => setNumbers(new Set())}
                      style={{ background: "none", border: "none", color: "#ef4444", fontSize: "0.75rem", cursor: "pointer", fontFamily: FONTS.body }}>
                      Tout supprimer
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", maxHeight: 110, overflowY: "auto" }}>
                    {Array.from(numbers).map(n => (
                      <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.28rem 0.6rem", borderRadius: RADIUS.full, background: `rgba(0,175,212,0.12)`, color: PALETTE.primary, fontSize: "0.78rem", fontWeight: 600 }}>
                        {n}
                        <button onClick={() => removeNumber(n)} style={{ background: "none", border: "none", color: PALETTE.primary, cursor: "pointer", padding: 0, fontSize: "0.7rem", lineHeight: 1 }}>✕</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Colonne droite : message + envoi ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>

              {/* Message */}
              <div style={{ ...card, flex: 1 }}>
                <div style={secTitle}>💬 Message</div>
                <textarea rows={7} maxLength={1000} value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Rédigez votre message ici…"
                  style={{ ...inp, resize: "vertical" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.35rem", fontSize: "0.72rem" }}>
                  <span style={{ color: message.length > 160 ? "#f59e0b" : theme.textMuted }}>
                    {message.length}/160{message.length > 160 ? " (multi-SMS)" : ""}
                  </span>
                  <span style={{ color: theme.textMuted }}>{numbers.size} dest.</span>
                </div>

                {/* Templates rapides */}
                <div style={{ marginTop: "0.75rem" }}>
                  <div style={{ fontSize: "0.68rem", color: theme.textMuted, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Templates rapides</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {[
                      { l: "📝 Rappel",          t: "Bonjour, ceci est un rappel important." },
                      { l: "📅 Confirmation RDV", t: "Votre rendez-vous est confirmé pour demain à 14h. À bientôt !" },
                      { l: "💰 Relance facture",  t: "Bonjour, ceci est un rappel concernant votre facture. Merci de votre attention." },
                    ].map(tp => (
                      <button key={tp.l} onClick={() => setMessage(tp.t)}
                        style={{ padding: "0.4rem 0.7rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body, textAlign: "left", transition: "background 0.12s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >{tp.l}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bouton envoi */}
              <div style={card}>
                {sending ? (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ width: 32, height: 32, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "qs-spin 0.8s linear infinite", margin: "0 auto 0.75rem" }} />
                    <div style={{ fontSize: "0.875rem", color: theme.textPrimary, fontWeight: 600 }}>
                      Envoi {progress.done}/{progress.total}…
                    </div>
                    <div style={{ marginTop: "0.5rem", height: 6, borderRadius: RADIUS.full, background: theme.border, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(progress.done / progress.total) * 100}%`, background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, transition: "width 0.3s", borderRadius: RADIUS.full }} />
                    </div>
                  </div>
                ) : (
                  <button onClick={handleSend} disabled={numbers.size === 0 || !message.trim()}
                    style={{ width: "100%", padding: "0.9rem", borderRadius: RADIUS.md, border: "none", background: numbers.size === 0 || !message.trim() ? theme.border : "linear-gradient(135deg,#11998e,#38ef7d)", color: numbers.size === 0 || !message.trim() ? theme.textMuted : "#fff", fontSize: "0.95rem", fontWeight: 700, cursor: numbers.size === 0 || !message.trim() ? "not-allowed" : "pointer", fontFamily: FONTS.body, transition: "all 0.15s" }}>
                    📤 Envoyer via {domain}
                  </button>
                )}
                <div style={{ textAlign: "center", fontSize: "0.7rem", color: theme.textMuted, marginTop: "0.5rem" }}>
                  1 SMS = 160 car. · Au-delà = plusieurs SMS facturés
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}