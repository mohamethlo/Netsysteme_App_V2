// ─────────────────────────────────────────────────────────────────────────────
//  src/pages/clients/ClientsPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import { clientsService, type CRMClient, type ClientStats } from "../../services/clientsService";
import { useAuthStore } from "../../store/authStore";
import { useSwal } from "../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../theme";
import ClientFormModal    from "./components/ClientFormModal";
import ClientDetailModal  from "./components/ClientDetailModal";
import ClientSuiviModal   from "./components/ClientSuiviModal";
import ImportModal        from "./components/ImportModal";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

// ── Type badge ────────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const isClient = type === "client";
  return (
    <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full,
      background: isClient ? "rgba(16,185,129,0.12)" : "rgba(6,182,212,0.1)",
      color:      isClient ? "#10b981"                : PALETTE.primary }}>
      {isClient ? "Client" : "Prospect"}
    </span>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ client}: { client: CRMClient; theme: any }) {
  const initials = (client.nom[0] ?? "?").toUpperCase() + (client.prenom?.[0] ?? "").toUpperCase();
  return (
    <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.72rem", fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// ── Btn ───────────────────────────────────────────────────────────────────────
function Btn({ icon, color, title, onClick }: { icon: string; color: string; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title}
      style={{ width: 28, height: 28, borderRadius: RADIUS.md, border: `1px solid ${color}33`, background: "transparent", color, cursor: "pointer", fontSize: "0.78rem", display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseEnter={e => (e.currentTarget.style.background = color + "18")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >{icon}</button>
  );
}

export default function ClientsPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const swal  = useSwal();
  const user  = useAuthStore(s => s.user);
  const isAdmin      = user?.permissions.includes("all") || user?.role === "Administrateur";
  const isCommercial = (user?.role ?? "").toLowerCase().includes("commercial");

  const [clients,    setClients]    = useState<CRMClient[]>([]);
  const [stats,      setStats]      = useState<ClientStats | null>(null);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState("");
  const [typeF,      setTypeF]      = useState("");
  const [showForm,   setShowForm]   = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showSuivi,  setShowSuivi]  = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing,    setEditing]    = useState<CRMClient | null>(null);
  const [selected,   setSelected]   = useState<CRMClient | null>(null);
  const [showList,   setShowList]   = useState(false);
  const PAGE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: PAGE };
      if (search) params.search      = search;
      if (typeF)  params.type_client = typeF;
      const [res, st] = await Promise.all([
        clientsService.getAll(params),
        clientsService.getStats(),
      ]);
      setClients(res.results); setTotal(res.count); setStats(st);
    } catch { swal.serverError(); } finally { setLoading(false); }
  }, [page, search, typeF]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, typeF]);

  const handleDelete = async (c: CRMClient) => {
    if (!await swal.confirmDelete(`${c.display_name}`)) return;
    try { await clientsService.delete(c.id); swal.deleted("Le client"); load(); }
    catch { swal.serverError(); }
  };

  const handleBlacklist = async (c: CRMClient) => {
    if (!await swal.confirm({ title: `Blacklister ${c.display_name} ?`, icon: "warning", confirmText: "Blacklister" })) return;
    try { const r = await clientsService.blacklist(c.id); swal.success(r.message); load(); }
    catch { swal.serverError(); }
  };

  const handleDeleteImport = async () => {
    if (!await swal.confirm({ title: "Supprimer le dernier import ?", text: "Tous les clients importés lors de la dernière importation seront supprimés.", icon: "warning", confirmText: "Supprimer" })) return;
    try {
      const r = await clientsService.deleteLastImport();
      swal.success(r.message); load();
    } catch { swal.serverError(); }
  };

  const totalPages = Math.ceil(total / PAGE);

  const CSS = `
    @keyframes spin { to { transform: rotate(360deg); } }

    /* KPIs : 2 colonnes sur mobile, 4 sur desktop */
    .cl-kpis {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.65rem;
      margin-bottom: 1.5rem;
    }
    @media (min-width: 640px) {
      .cl-kpis { grid-template-columns: repeat(4, 1fr); gap: 0.85rem; }
    }

    /* Tableau masqué sur mobile, cartes masquées sur desktop */
    .cl-table-wrap { display: none; }
    .cl-cards-wrap { display: flex; flex-direction: column; }
    @media (min-width: 640px) {
      .cl-table-wrap { display: block; }
      .cl-cards-wrap { display: none; }
    }
  `;

  return (
    <div style={{ fontFamily: FONTS.body }}>
      <style>{CSS}</style>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontSize: "1.5rem", fontWeight: 700, color: theme.textPrimary, letterSpacing: "-0.02em" }}>
            Gestion clientèle
          </h1>
          <p style={{ fontSize: "0.85rem", color: theme.textMuted, marginTop: 3 }}>Clients et prospects</p>
        </div>
        {(isAdmin || isCommercial) && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button onClick={() => { setEditing(null); setShowForm(true); }}
              style={{ padding: "0.58rem 1rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
              + Nouveau client
            </button>
            <button onClick={() => setShowImport(true)}
              style={{ padding: "0.58rem 1rem", borderRadius: RADIUS.md, border: `1px solid ${PALETTE.primary}44`, background: "transparent", color: PALETTE.primary, fontSize: "0.82rem", cursor: "pointer", fontFamily: FONTS.body }}>
              ⬆ Importer Excel
            </button>
            <button onClick={handleDeleteImport}
              style={{ padding: "0.58rem 1rem", borderRadius: RADIUS.md, border: "1px solid rgba(239,68,68,0.4)", background: "transparent", color: "#ef4444", fontSize: "0.82rem", cursor: "pointer", fontFamily: FONTS.body }}>
              🗑 Suppr. dernier import
            </button>
            <button onClick={() => clientsService.exportCsv()}
              style={{ padding: "0.58rem 1rem", borderRadius: RADIUS.md, border: "1px solid rgba(16,185,129,0.4)", background: "transparent", color: "#10b981", fontSize: "0.82rem", cursor: "pointer", fontFamily: FONTS.body }}>
              ⬇ Export CSV
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      {stats && (
        <div className="cl-kpis">
          {[
            { label: "Total contacts",    value: stats.total,          color: PALETTE.primary, icon: "👥" },
            { label: "Clients confirmés", value: stats.total_clients,  color: "#10b981",       icon: "✅" },
            { label: "Prospects",         value: stats.total_prospects, color: "#3b82f6",      icon: "🎯" },
            ...(stats.blacklisted !== undefined ? [{ label: "Blacklistés", value: stats.blacklisted, color: "#ef4444", icon: "🚫" }] : []),
          ].map(s => (
            <div key={s.label} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: 40, height: 40, borderRadius: "10px", background: s.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: "0.7rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1 }}>{s.label}</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1 }}>{fmt(s.value)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bouton afficher liste */}
      {!showList ? (
        <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", padding: "3rem 2rem", textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>👥</div>
          <h3 style={{ fontFamily: FONTS.display, color: theme.textPrimary, marginBottom: "0.5rem" }}>Gestion des Clients</h3>
          <p style={{ color: theme.textMuted, marginBottom: "1.25rem", fontSize: "0.875rem" }}>Accédez à la liste complète des clients et prospects</p>
          <button onClick={() => setShowList(true)}
            style={{ padding: "0.65rem 1.75rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
            👁 Afficher la liste des clients
          </button>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 180px" }}>
              <span style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
                style={{ width: "100%", padding: "0.55rem 0.85rem 0.55rem 2.2rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", outline: "none", fontFamily: FONTS.body }} />
            </div>
            <select value={typeF} onChange={e => setTypeF(e.target.value)}
              style={{ padding: "0.55rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, cursor: "pointer" }}>
              <option value="">Tous les types</option>
              <option value="client">Clients</option>
              <option value="prospect">Prospects</option>
            </select>
            <span style={{ fontSize: "0.8rem", color: theme.textMuted, marginLeft: "auto" }}>{total} contact{total > 1 ? "s" : ""}</span>
            <button onClick={() => setShowList(false)}
              style={{ padding: "0.55rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body }}>
              👁‍🗨 Masquer
            </button>
          </div>

          {/* Tableau */}
          <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                <div style={{ width: 32, height: 32, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              </div>
            ) : clients.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: theme.textMuted }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>👥</div>
                <div>Aucun client enregistré</div>
              </div>
            ) : (
              <>
                {/* ── Table (≥640px) ── */}
                <div className="cl-table-wrap" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                      {["Nom complet", "Entreprise", "Contact", "Adresse", "Type", "Observation", "Actions"].map(h => (
                        <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
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
                        {/* Nom */}
                        <td style={{ padding: "0.85rem 1rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <Avatar client={c} theme={theme} />
                            <button onClick={() => { setSelected(c); setShowDetail(true); }}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                              <div style={{ fontWeight: 600, color: PALETTE.primary, fontSize: "0.875rem" }}>{c.nom}</div>
                              {c.prenom && <div style={{ fontSize: "0.75rem", color: theme.textMuted }}>{c.prenom}</div>}
                            </button>
                          </div>
                        </td>
                        {/* Entreprise */}
                        <td style={{ padding: "0.85rem 1rem", color: theme.textSecondary }}>{c.entreprise ?? "—"}</td>
                        {/* Contact */}
                        <td style={{ padding: "0.85rem 1rem" }}>
                          {c.email && <div style={{ fontSize: "0.78rem", color: theme.textMuted }}>✉ {c.email}</div>}
                          {c.telephone && <a href={`tel:${c.telephone}`} style={{ fontSize: "0.82rem", color: PALETTE.primary, textDecoration: "none", fontWeight: 500 }}>📞 {c.telephone}</a>}
                          {!c.email && !c.telephone && <span style={{ color: theme.textMuted }}>—</span>}
                        </td>
                        {/* Adresse */}
                        <td style={{ padding: "0.85rem 1rem", fontSize: "0.78rem", color: theme.textMuted, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.adresse ? `${c.adresse.slice(0, 30)}${c.adresse.length > 30 ? "…" : ""}` : "—"}
                          {c.ville && <div>{c.ville}{c.code_postal ? ` (${c.code_postal})` : ""}</div>}
                        </td>
                        {/* Type */}
                        <td style={{ padding: "0.85rem 1rem" }}><TypeBadge type={c.type_client} /></td>
                        {/* Observation */}
                        {/* Observation */}
                        <td style={{ padding: "0.85rem 1rem", fontSize: "0.75rem", maxWidth: 200 }}>
                          {c.last_call_comment ? (
                            <div>
                              <span style={{
                                fontSize: "0.68rem", fontWeight: 600, padding: "1px 6px",
                                borderRadius: RADIUS.full,
                                background: c.last_call_comment.resultat_appel === "client_joint"
                                  ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.1)",
                                color: c.last_call_comment.resultat_appel === "client_joint"
                                  ? "#10b981" : "#ef4444",
                              }}>
                                {c.last_call_comment.resultat_appel === "client_joint" ? "✅ Joint" : "❌ Non joint"}
                              </span>
                              {c.last_call_comment.date_appel_str && (
                                <div style={{ color: theme.textMuted, marginTop: 2 }}>
                                  📅 {c.last_call_comment.date_appel_str}
                                </div>
                              )}
                              {c.last_call_comment.commentaires && (
                                <div style={{ color: theme.textSecondary, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>
                                  {c.last_call_comment.commentaires.slice(0, 60)}
                                  {c.last_call_comment.commentaires.length > 60 ? "…" : ""}
                                </div>
                              )}
                            </div>
                          ) : c.next_reminder ? (
                            <div style={{ color: theme.textMuted }}>
                              <div style={{ color: "#f59e0b", fontWeight: 500 }}>
                                🕐 {c.next_reminder.remind_at_str ?? "Rappel"}
                              </div>
                              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                                {c.next_reminder.notes.slice(0, 50)}{c.next_reminder.notes.length > 50 ? "…" : ""}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: theme.textMuted }}>—</span>
                          )}
                        </td>
                        {/* Actions */}
                        <td style={{ padding: "0.85rem 1rem" }}>
                          <div style={{ display: "flex", gap: "0.3rem" }}>
                            <Btn icon="✏️" color="#3b82f6"      title="Modifier"  onClick={() => { setEditing(c); setShowForm(true); }} />
                            <Btn icon="📊" color={PALETTE.primary} title="Suivi appels" onClick={() => { setSelected(c); setShowSuivi(true); }} />
                            {isAdmin && (
                              <>
                                <Btn icon="🚫" color="#f59e0b" title="Blacklister" onClick={() => handleBlacklist(c)} />
                                <Btn icon="🗑"  color="#ef4444" title="Supprimer"  onClick={() => handleDelete(c)} />
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {/* ── Cartes mobiles (<640px) ── */}
                <div className="cl-cards-wrap">
                  {clients.map((c, i) => (
                    <div key={c.id} style={{ padding: "0.85rem 1rem", borderBottom: i < clients.length - 1 ? `1px solid ${theme.border}` : "none", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <Avatar client={c} theme={theme} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <button onClick={() => { setSelected(c); setShowDetail(true); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                          <div style={{ fontWeight: 600, color: PALETTE.primary, fontSize: "0.875rem" }}>{c.nom}{c.prenom ? ` ${c.prenom}` : ""}</div>
                        </button>
                        <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.3rem", alignItems: "center", flexWrap: "wrap" }}>
                          <TypeBadge type={c.type_client} />
                          {c.telephone && <a href={`tel:${c.telephone}`} style={{ fontSize: "0.75rem", color: PALETTE.primary, textDecoration: "none" }}>📞 {c.telephone}</a>}
                        </div>
                        {c.entreprise && <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 2 }}>{c.entreprise}</div>}
                      </div>
                      <div style={{ display: "flex", gap: "0.3rem", flexShrink: 0 }}>
                        <Btn icon="✏️" color="#3b82f6" title="Modifier" onClick={() => { setEditing(c); setShowForm(true); }} />
                        <Btn icon="📊" color={PALETTE.primary} title="Suivi appels" onClick={() => { setSelected(c); setShowSuivi(true); }} />
                        {isAdmin && <Btn icon="🗑" color="#ef4444" title="Supprimer" onClick={() => handleDelete(c)} />}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1.25rem", borderTop: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>Page {page}/{totalPages} — {total} résultat{total > 1 ? "s" : ""}</span>
                <div style={{ display: "flex", gap: "0.35rem" }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    style={{ padding: "0.38rem 0.7rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, fontSize: "0.8rem", fontFamily: FONTS.body }}>←</button>
                  {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                    const p = i + 1;
                    return <button key={p} onClick={() => setPage(p)} style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid ${p === page ? PALETTE.primary : theme.border}`, background: p === page ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : "transparent", color: p === page ? "#fff" : theme.textMuted, fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body }}>{p}</button>;
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    style={{ padding: "0.38rem 0.7rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontSize: "0.8rem", fontFamily: FONTS.body }}>→</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {showForm && (
        <ClientFormModal dark={dark} theme={theme} client={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }} />
      )}
      {showDetail && selected && (
        <ClientDetailModal dark={dark} theme={theme} client={selected} isAdmin={isAdmin}
          onClose={() => { setShowDetail(false); setSelected(null); }}
          onEdit={() => { setShowDetail(false); setEditing(selected); setShowForm(true); }}
          onRefresh={load} />
      )}
      {showSuivi && selected && (
        <ClientSuiviModal dark={dark} theme={theme} client={selected}
          onClose={() => { setShowSuivi(false); setSelected(null); }} 
          onSaved={load}  
        />
      )}
      {showImport && (
        <ImportModal dark={dark} theme={theme}
          onClose={() => setShowImport(false)}
          onSaved={() => { setShowImport(false); load(); }} />
      )}

    </div>
  );
}