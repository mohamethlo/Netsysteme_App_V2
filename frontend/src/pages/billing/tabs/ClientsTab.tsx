import { useState, useEffect, useCallback } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { billingClientsService, type BillingClient } from "../../../services/billingClientsService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";
import BillingClientFormModal   from "../../billing-clients/components/BillingClientFormModal";
import BillingClientDetailModal from "../../billing-clients/components/BillingClientDetailModal";

interface TabProps { dark: boolean; theme: LayoutContext["theme"]; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.32, fontWeight: 700, color: "#fff",
      flexShrink: 0, fontFamily: FONTS.display,
    }}>{initials || "?"}</div>
  );
}

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: bg, color: text, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function StatCard({ label, value, color, icon, theme }: {
  label: string; value: number | string; color: string; icon: string;
  theme: LayoutContext["theme"];
}) {
  return (
    <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.85rem" }}>
      <div style={{ width: 44, height: 44, borderRadius: "12px", background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "0.72rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: "1.55rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1 }}>{value}</div>
      </div>
    </div>
  );
}

// ── TableView ─────────────────────────────────────────────────────────────────
function TableView({ clients, theme, dark, onView, onEdit, onDelete }: {
  clients: BillingClient[]; theme: LayoutContext["theme"]; dark: boolean;
  onView: (c: BillingClient) => void;
  onEdit: (c: BillingClient) => void;
  onDelete: (c: BillingClient) => void;
}) {
  const [hovBtns, setHovBtns] = useState<Record<string, boolean>>({});

  return (
    <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
              {["Client", "Téléphone", "Email", "Adresse", "NINEA / Fiscal", "Factures", "Actions"].map(h => (
                <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.7rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((c, i) => (
              <tr key={c.id}
                style={{ borderBottom: i < clients.length - 1 ? `1px solid ${theme.border}` : "none", transition: "background 0.12s" }}
                onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: "0.85rem 1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                    <Avatar name={c.display_name} size={34} />
                    <div>
                      <div style={{ fontWeight: 600, color: theme.textPrimary, whiteSpace: "nowrap" }}>
                        {c.company_name ?? c.contact_name ?? "—"}
                      </div>
                      {c.company_name && c.contact_name && (
                        <div style={{ fontSize: "0.75rem", color: theme.textMuted }}>{c.contact_name}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td style={{ padding: "0.85rem 1rem" }}>
                  <a href={`tel:${c.phone}`} style={{ color: PALETTE.primary, textDecoration: "none", fontSize: "0.875rem", fontWeight: 500 }}>
                    {c.phone}
                  </a>
                </td>
                <td style={{ padding: "0.85rem 1rem", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.email
                    ? <a href={`mailto:${c.email}`} style={{ color: theme.textSecondary, textDecoration: "none" }}>{c.email}</a>
                    : <span style={{ color: theme.textMuted }}>—</span>}
                </td>
                <td style={{ padding: "0.85rem 1rem", color: theme.textMuted, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.address ?? "—"}
                </td>
                <td style={{ padding: "0.85rem 1rem" }}>
                  {c.tax_id
                    ? <Badge label={c.tax_id} bg={dark ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.08)"} text="#f59e0b" />
                    : <span style={{ color: theme.textMuted }}>—</span>}
                </td>
                <td style={{ padding: "0.85rem 1rem" }}>
                  <Badge
                    label={c.can_delete ? "Aucune" : "Liées"}
                    bg={c.can_delete ? "rgba(16,185,129,0.1)" : "rgba(59,130,246,0.1)"}
                    text={c.can_delete ? "#10b981" : "#3b82f6"}
                  />
                </td>
                <td style={{ padding: "0.85rem 1rem" }}>
                  <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                    {[
                      { key: "voir",     color: PALETTE.primary, icon: "👁",  action: () => onView(c),   disabled: false },
                      { key: "modifier", color: "#3b82f6",        icon: "✏️", action: () => onEdit(c),   disabled: false },
                      { key: "suppr",    color: "#ef4444",        icon: "🗑",  action: () => onDelete(c), disabled: !c.can_delete },
                    ].map(btn => (
                      <button key={btn.key}
                        disabled={btn.disabled}
                        onClick={btn.action}
                        onMouseEnter={() => setHovBtns(h => ({ ...h, [`${c.id}-${btn.key}`]: true }))}
                        onMouseLeave={() => setHovBtns(h => ({ ...h, [`${c.id}-${btn.key}`]: false }))}
                        title={btn.disabled ? "Ce client a des factures associées" : undefined}
                        style={{
                          width: 30, height: 30, borderRadius: RADIUS.md,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: hovBtns[`${c.id}-${btn.key}`] ? btn.color + "18" : "transparent",
                          border: `1px solid ${hovBtns[`${c.id}-${btn.key}`] ? btn.color + "44" : theme.border}`,
                          color: btn.color, cursor: btn.disabled ? "not-allowed" : "pointer",
                          transition: "all 0.15s", opacity: btn.disabled ? 0.3 : 1, fontSize: "0.82rem",
                        }}
                      >{btn.icon}</button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── CardsView ─────────────────────────────────────────────────────────────────
function ClientCard({ client: c, theme, dark, onView, onEdit, onDelete }: {
  client: BillingClient; theme: LayoutContext["theme"]; dark: boolean;
  onView: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? theme.cardBgHover : theme.cardBg,
        border: `1px solid ${hov ? PALETTE.primary + "44" : theme.border}`,
        borderRadius: "14px", padding: "1.25rem", transition: "all 0.2s",
        transform: hov ? "translateY(-2px)" : "none",
        boxShadow: hov ? (dark ? "0 8px 28px rgba(0,0,0,0.35)" : "0 6px 20px rgba(6,182,212,0.1)") : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "1rem" }}>
        <Avatar name={c.display_name} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: theme.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {c.company_name ?? c.contact_name ?? "—"}
          </div>
          {c.company_name && c.contact_name && (
            <div style={{ fontSize: "0.78rem", color: theme.textMuted, marginTop: 1 }}>{c.contact_name}</div>
          )}
          {!c.can_delete && (
            <span style={{ display: "inline-block", marginTop: 4, fontSize: "0.65rem", fontWeight: 600, padding: "1px 6px", borderRadius: RADIUS.full, background: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>
              Factures liées
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginBottom: "1rem" }}>
        {[
          { icon: "📞", value: c.phone,   href: `tel:${c.phone}`,    color: PALETTE.primary     },
          { icon: "📧", value: c.email,   href: `mailto:${c.email}`, color: theme.textSecondary },
          { icon: "📍", value: c.address, href: undefined,            color: theme.textMuted     },
          { icon: "🔖", value: c.tax_id,  href: undefined,            color: "#f59e0b"           },
        ].map(row => row.value ? (
          <div key={row.icon} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", flexShrink: 0, marginTop: 1 }}>{row.icon}</span>
            {row.href ? (
              <a href={row.href} style={{ fontSize: "0.82rem", color: row.color, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{row.value}</a>
            ) : (
              <span style={{ fontSize: "0.82rem", color: row.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{row.value}</span>
            )}
          </div>
        ) : null)}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", paddingTop: "0.85rem", borderTop: `1px solid ${theme.border}` }}>
        <button onClick={onView}
          style={{ flex: 1, padding: "0.5rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body, transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.background = theme.navHoverBg; e.currentTarget.style.color = theme.textPrimary; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = theme.textSecondary; }}
        >Détails</button>
        <button onClick={onEdit}
          style={{ flex: 1, padding: "0.5rem", borderRadius: RADIUS.md, border: "1px solid rgba(59,130,246,0.3)", background: "transparent", color: "#3b82f6", fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body, transition: "all 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(59,130,246,0.08)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >Modifier</button>
        <button onClick={onDelete} disabled={!c.can_delete}
          style={{ width: 34, padding: "0.5rem", borderRadius: RADIUS.md, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#ef4444", fontSize: "0.85rem", cursor: c.can_delete ? "pointer" : "not-allowed", opacity: c.can_delete ? 1 : 0.3, fontFamily: FONTS.body, transition: "all 0.15s" }}
          onMouseEnter={e => { if (c.can_delete) e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          title={!c.can_delete ? "Client avec factures associées" : "Supprimer"}
        >🗑</button>
      </div>
    </div>
  );
}

// ── ClientsTab ────────────────────────────────────────────────────────────────
export default function ClientsTab({ dark, theme }: TabProps) {
  const swal = useSwal();

  const [clients,    setClients]    = useState<BillingClient[]>([]);
  const [allClients, setAllClients] = useState<BillingClient[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);

  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);
  const [view,   setView]   = useState<"table" | "cards">("table");
  const PAGE_SIZE = 12;

  const [showForm,   setShowForm]   = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editing,    setEditing]    = useState<BillingClient | null>(null);
  const [selected,   setSelected]   = useState<BillingClient | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page, page_size: PAGE_SIZE,
        ...(search ? { search } : {}),
      };
      const [paginatedRes, allRes] = await Promise.all([
        billingClientsService.getAll(params as any),
        page === 1 && !search ? billingClientsService.getAll() : Promise.resolve(null),
      ]);

      if (Array.isArray(paginatedRes)) {
        setClients(paginatedRes);
        setTotal(paginatedRes.length);
      } else {
        setClients((paginatedRes as any).results ?? []);
        setTotal((paginatedRes as any).count ?? 0);
      }

      if (allRes) {
        setAllClients(Array.isArray(allRes) ? allRes : (allRes as any).results ?? []);
      }
    } catch {
      swal.serverError();
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const statsSource = allClients.length ? allClients : clients;
  const withEmail   = statsSource.filter(c => c.email).length;
  const withTaxId   = statsSource.filter(c => c.tax_id).length;
  const withCompany = statsSource.filter(c => c.company_name).length;

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleDelete = async (client: BillingClient) => {
    if (!client.can_delete) {
      swal.error("Suppression impossible", "Ce client a des factures ou proformas associés.");
      return;
    }
    const ok = await swal.confirmDelete(client.display_name);
    if (!ok) return;
    try { await billingClientsService.delete(client.id); swal.deleted("Le client"); load(); }
    catch { swal.serverError(); }
  };

  const openEdit = (client: BillingClient) => {
    setEditing(client); setShowForm(true); setShowDetail(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ fontFamily: FONTS.body }}>

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))", gap: "0.85rem", marginBottom: "1.75rem" }}>
        <StatCard label="Total clients"   value={total}       color={PALETTE.primary} icon="👥" theme={theme} />
        <StatCard label="Avec entreprise" value={withCompany} color={PALETTE.info}    icon="🏢" theme={theme} />
        <StatCard label="Avec email"      value={withEmail}   color={PALETTE.success} icon="📧" theme={theme} />
        <StatCard label="Avec NINEA"      value={withTaxId}   color={PALETTE.warning} icon="🔖" theme={theme} />
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted, pointerEvents: "none" }}>
            <svg width={15} height={15} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, entreprise, email, téléphone…"
            style={{ width: "100%", padding: "0.58rem 0.85rem 0.58rem 2.4rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", outline: "none", fontFamily: FONTS.body }} />
        </div>

        {/* Vue toggle */}
        <div style={{ display: "flex", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: RADIUS.md, padding: "2px", gap: "2px" }}>
          {(["table", "cards"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: "0.38rem 0.75rem", borderRadius: "7px", border: "none", background: view === v ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : "transparent", color: view === v ? "#fff" : theme.textMuted, fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body, transition: "all 0.15s" }}>
              {v === "table" ? "☰ Tableau" : "⊞ Cartes"}
            </button>
          ))}
        </div>

        <span style={{ fontSize: "0.8rem", color: theme.textMuted, marginLeft: "auto" }}>{total} client{total > 1 ? "s" : ""}</span>

        <button onClick={() => { setEditing(null); setShowForm(true); }}
          style={{ padding: "0.58rem 1.1rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
          + Nouveau client
        </button>
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 220 }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : clients.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>👥</div>
          <div style={{ fontWeight: 600, fontSize: "1rem", color: theme.textPrimary, marginBottom: "0.35rem" }}>
            {search ? "Aucun résultat" : "Aucun client enregistré"}
          </div>
          <div style={{ fontSize: "0.875rem", color: theme.textMuted, marginBottom: "1.25rem" }}>
            {search ? `Aucun client ne correspond à "${search}"` : "Commencez par ajouter votre premier client"}
          </div>
          {!search && (
            <button onClick={() => setShowForm(true)}
              style={{ padding: "0.65rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
              + Ajouter un client
            </button>
          )}
        </div>
      ) : view === "table" ? (
        <TableView
          clients={clients} theme={theme} dark={dark}
          onView={c => { setSelected(c); setShowDetail(true); }}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
          {clients.map(c => (
            <ClientCard key={c.id} client={c} theme={theme} dark={dark}
              onView={() => { setSelected(c); setShowDetail(true); }}
              onEdit={() => openEdit(c)}
              onDelete={() => handleDelete(c)}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", padding: "0.85rem 1.25rem", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px" }}>
          <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>
            Page {page} / {totalPages} — {total} résultat{total > 1 ? "s" : ""}
          </span>
          <div style={{ display: "flex", gap: "0.35rem" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: "0.38rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, fontFamily: FONTS.body, fontSize: "0.8rem" }}>← Préc.</button>
            {[...Array(Math.min(totalPages, 7))].map((_, i) => {
              const p = i + 1;
              return (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 32, height: 32, borderRadius: RADIUS.md, border: `1px solid ${p === page ? PALETTE.primary : theme.border}`, background: p === page ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : "transparent", color: p === page ? "#fff" : theme.textMuted, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body }}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ padding: "0.38rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontFamily: FONTS.body, fontSize: "0.8rem" }}>Suiv. →</button>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showForm && (
        <BillingClientFormModal
          dark={dark} theme={theme} client={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
      {showDetail && selected && (
        <BillingClientDetailModal
          dark={dark} theme={theme} client={selected}
          onClose={() => { setShowDetail(false); setSelected(null); }}
          onEdit={() => openEdit(selected)}
          onDelete={() => { setShowDetail(false); handleDelete(selected); }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}