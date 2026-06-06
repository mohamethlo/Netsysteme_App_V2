// src/pages/sms/components/HistoryPanel.tsx
import { useState, useEffect, useCallback } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { smsService, type SMSHistoryEntry } from "../../../services/smsService";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props { dark: boolean; theme: LayoutContext["theme"]; }

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  success: { label: "✅ Réussi",     bg: "rgba(16,185,129,0.12)", text: "#10b981" },
  failed:  { label: "❌ Échoué",     bg: "rgba(239,68,68,0.1)",   text: "#ef4444" },
  pending: { label: "⏳ En attente", bg: "rgba(245,158,11,0.12)", text: "#f59e0b" },
};

const DOMAIN_CFG: Record<string, { bg: string; text: string }> = {
  NETSYSTEME: { bg: "rgba(102,126,234,0.12)", text: "#667eea" },
  SSE:        { bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
};

/** Normalise n'importe quelle réponse en tableau */
function normArray<T>(d: any): T[] {
  if (Array.isArray(d))            return d;
  if (d && Array.isArray(d.results)) return d.results;
  return [];
}

export default function HistoryPanel({ dark, theme }: Props) {
  // ── Garde défensive : toujours initialisé avec un tableau vide ────────────
  const [items,    setItems]    = useState<SMSHistoryEntry[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState("");
  const [statusF,  setStatusF]  = useState("");
  const [domainF,  setDomainF]  = useState("");
  const [periodF,  setPeriodF]  = useState("");
  const [selected, setSelected] = useState<SMSHistoryEntry | null>(null);
  const PAGE = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: PAGE };
      if (search)  params.search        = search;
      if (statusF) params.status        = statusF;
      if (domainF) params.sender_domain = domainF;
      if (periodF) params.period        = periodF;

      const raw = await smsService.getHistory(params);
      // normArray garantit qu'on a toujours un tableau, quelle que soit la forme de la réponse
      setItems(normArray<SMSHistoryEntry>(raw));
      setTotal(raw?.count ?? (Array.isArray(raw) ? raw.length : 0));
    } catch {
      setItems([]);
      setTotal(0);
    } finally { setLoading(false); }
  }, [page, search, statusF, domainF, periodF]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusF, domainF, periodF]);

  const totalPages = Math.ceil(total / PAGE);

  const inp: React.CSSProperties = {
    padding: "0.52rem 0.75rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.82rem",
    fontFamily: FONTS.body, outline: "none",
  };

  return (
    <div>
      {/* Filtres */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 180px" }}>
          <span style={{ position: "absolute", left: "0.65rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted, fontSize: "0.8rem" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
            style={{ ...inp, paddingLeft: "2rem", width: "100%", boxSizing: "border-box" as const }} />
        </div>
        <select value={statusF} onChange={e => setStatusF(e.target.value)} style={inp}>
          <option value="">Tous les statuts</option>
          <option value="success">✅ Réussi</option>
          <option value="failed">❌ Échoué</option>
          <option value="pending">⏳ En attente</option>
        </select>
        <select value={domainF} onChange={e => setDomainF(e.target.value)} style={inp}>
          <option value="">Tous les domaines</option>
          <option value="NETSYSTEME">🔷 NETSYSTEME</option>
          <option value="SSE">🟢 SSE</option>
        </select>
        <select value={periodF} onChange={e => setPeriodF(e.target.value)} style={inp}>
          <option value="">Toute période</option>
          <option value="today">Aujourd'hui</option>
          <option value="week">Cette semaine</option>
          <option value="month">Ce mois</option>
        </select>
        <button onClick={() => smsService.exportCsv({ status: statusF, sender_domain: domainF, period: periodF })}
          style={{ ...inp, background: "transparent", border: "1px solid rgba(16,185,129,0.4)", color: "#10b981", cursor: "pointer" }}>
          ⬇ CSV
        </button>
        <span style={{ fontSize: "0.78rem", color: theme.textMuted, marginLeft: "auto" }}>{total} SMS</span>
      </div>

      {/* Tableau */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <div style={{ width: 30, height: 30, border: "3px solid rgba(102,126,234,0.2)", borderTopColor: "#667eea", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: theme.textMuted }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📨</div>
            <div>Aucun SMS trouvé</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  {["Date", "Destinataire", "Numéro", "Domaine", "Message", "Statut"].map(h => (
                    <th key={h} style={{ padding: "0.7rem 1rem", textAlign: "left", fontSize: "0.67rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((s, i) => {
                  const sc = STATUS_CFG[s.status]      ?? STATUS_CFG.pending;
                  const dc = DOMAIN_CFG[s.sender_domain] ?? DOMAIN_CFG.NETSYSTEME;
                  return (
                    <tr key={s.id}
                      style={{ borderBottom: i < items.length - 1 ? `1px solid ${theme.border}` : "none", cursor: "pointer" }}
                      onClick={() => setSelected(s)}
                      onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: "0.82rem", color: theme.textPrimary, fontWeight: 500 }}>{s.sent_at_str ?? "—"}</div>
                      </td>
                      <td style={{ padding: "0.85rem 1rem", color: theme.textSecondary }}>{s.recipient_name ?? "—"}</td>
                      <td style={{ padding: "0.85rem 1rem", color: PALETTE.primary, fontWeight: 500 }}>{s.phone}</td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: dc.bg, color: dc.text }}>{s.sender_domain}</span>
                      </td>
                      <td style={{ padding: "0.85rem 1rem", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: theme.textMuted, fontSize: "0.8rem" }}>{s.message}</td>
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <span style={{ fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: sc.bg, color: sc.text }}>{sc.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1.25rem", borderTop: `1px solid ${theme.border}` }}>
            <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>Page {page}/{totalPages}</span>
            <div style={{ display: "flex", gap: "0.3rem" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: "0.35rem 0.65rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, fontSize: "0.8rem", fontFamily: FONTS.body }}>←</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: "0.35rem 0.65rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontSize: "0.8rem", fontFamily: FONTS.body }}>→</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal détail */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 520, boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.65)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: theme.textPrimary }}>📨 Détails du SMS #{selected.id}</h2>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
            </div>
            <div style={{ padding: "1.25rem 1.5rem" }}>
              {([
                ["Date",        selected.sent_at_str ?? selected.sent_at],
                ["Destinataire",selected.recipient_name ?? "—"],
                ["Numéro",      selected.phone],
                ["Domaine",     selected.sender_domain],
                ["Statut",      STATUS_CFG[selected.status]?.label ?? selected.status],
                ["Envoyé par",  selected.sent_by_name ?? "—"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: `1px solid ${theme.border}` }}>
                  <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>{k}</span>
                  <span style={{ fontSize: "0.875rem", color: theme.textPrimary, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: "0.75rem" }}>
                <div style={{ fontSize: "0.72rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.4rem" }}>Message</div>
                <div style={{ padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${theme.border}`, fontSize: "0.875rem", color: theme.textPrimary, lineHeight: 1.6 }}>
                  {selected.message}
                </div>
              </div>
              {selected.error_message && (
                <div style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", borderRadius: RADIUS.md, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "0.82rem" }}>
                  ⚠️ {selected.error_message}
                </div>
              )}
            </div>
            <div style={{ padding: "0.85rem 1.5rem", borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setSelected(null)}
                style={{ padding: "0.52rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}