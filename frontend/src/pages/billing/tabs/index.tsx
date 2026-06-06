// // ─────────────────────────────────────────────────────────────────────────────
// //  src/pages/billing/tabs/index.tsx
// // ─────────────────────────────────────────────────────────────────────────────
// import { useState, useEffect, useCallback } from "react";
// import { type LayoutContext } from "../../../layouts/MainLayout";
// import { billingService, type Invoice, type Proforma, type BillingClient, type Product } from "../../../services/billingService";
// import { pdfService } from "../../../services/pdfService";
// import { useSwal } from "../../../hooks/useSwal";
// import { FONTS, PALETTE, RADIUS } from "../../../theme";
// import InvoiceFormModal   from "../../invoices/components/InvoiceFormModal";
// import InvoiceDetailModal from "../../invoices/components/InvoiceDetailModal";

// // ── Types partagés ────────────────────────────────────────────────────────────
// interface TabProps { dark: boolean; theme: LayoutContext["theme"]; }

// const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

// // ── Status configs ────────────────────────────────────────────────────────────
// const INV_STATUS: Record<string, { label: string; bg: string; text: string }> = {
//   draft:     { label: "Brouillon",  bg: "rgba(148,163,184,0.12)", text: "#94a3b8" },
//   confirmed: { label: "Confirmée",  bg: "rgba(6,182,212,0.12)",   text: "#06b6d4" },
//   sent:      { label: "Envoyée",    bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
//   paid:      { label: "Payée",      bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
//   overdue:   { label: "En retard",  bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
//   cancelled: { label: "Annulée",    bg: "rgba(100,116,139,0.12)", text: "#64748b" },
// };
// const PROF_STATUS: Record<string, { label: string; bg: string; text: string }> = {
//   draft:     { label: "Brouillon", bg: "rgba(148,163,184,0.12)", text: "#94a3b8" },
//   sent:      { label: "Envoyé",    bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
//   converted: { label: "Converti",  bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
//   cancelled: { label: "Annulé",    bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
// };

// function StatusBadge({ status, cfg }: { status: string; cfg: Record<string, { label: string; bg: string; text: string }> }) {
//   const s = cfg[status] ?? cfg.draft;
//   return <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: s.bg, color: s.text, whiteSpace: "nowrap" }}>{s.label}</span>;
// }

// function Spinner({ color = PALETTE.primary }: { color?: string }) {
//   return (
//     <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
//       <div style={{ width: 34, height: 34, border: `3px solid ${color}33`, borderTopColor: color, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//     </div>
//   );
// }

// function SearchInput({ value, onChange, placeholder, theme }: { value: string; onChange: (v: string) => void; placeholder: string; theme: LayoutContext["theme"] }) {
//   return (
//     <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
//       <svg width={15} height={15} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted, pointerEvents: "none" }}>
//         <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
//       </svg>
//       <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
//         style={{ width: "100%", padding: "0.58rem 0.85rem 0.58rem 2.4rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", outline: "none", fontFamily: FONTS.body }} />
//     </div>
//   );
// }

// function ActionBtn({ icon, color, title, onClick }: { icon: string; color: string; title: string; onClick: () => void }) {
//   return (
//     <button onClick={onClick} title={title}
//       style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid ${color}33`, background: "transparent", color, cursor: "pointer", fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
//       onMouseEnter={e => (e.currentTarget.style.background = color + "18")}
//       onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
//     >{icon}</button>
//   );
// }

// function Pagination({ page, total, pageSize, onChange, theme, color = PALETTE.primary }: { page: number; total: number; pageSize: number; onChange: (p: number) => void; theme: LayoutContext["theme"]; color?: string }) {
//   const totalPages = Math.ceil(total / pageSize);
//   if (totalPages <= 1) return null;
//   return (
//     <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1.25rem", borderTop: `1px solid ${theme.border}` }}>
//       <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>Page {page} / {totalPages} — {total} résultat{total > 1 ? "s" : ""}</span>
//       <div style={{ display: "flex", gap: "0.35rem" }}>
//         <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
//           style={{ padding: "0.38rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, fontFamily: FONTS.body, fontSize: "0.8rem" }}>← Préc.</button>
//         {[...Array(Math.min(totalPages, 7))].map((_, i) => {
//           const p = i + 1;
//           return <button key={p} onClick={() => onChange(p)} style={{ width: 32, height: 32, borderRadius: RADIUS.md, border: `1px solid ${p === page ? color : theme.border}`, background: p === page ? `linear-gradient(135deg,${color},${color}cc)` : "transparent", color: p === page ? "#fff" : theme.textMuted, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body }}>{p}</button>;
//         })}
//         <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
//           style={{ padding: "0.38rem 0.75rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontFamily: FONTS.body, fontSize: "0.8rem" }}>Suiv. →</button>
//       </div>
//     </div>
//   );
// }

// // ═════════════════════════════════════════════════════════════════════════════
// //  InvoicesTab
// // ═════════════════════════════════════════════════════════════════════════════
// export function InvoicesTab({ dark, theme }: TabProps) {
//   const swal = useSwal();
//   const [invoices,   setInvoices]   = useState<Invoice[]>([]);
//   const [clients,    setClients]    = useState<BillingClient[]>([]);
//   const [products,   setProducts]   = useState<any[]>([]);
//   const [total,      setTotal]      = useState(0);
//   const [loading,    setLoading]    = useState(true);
//   const [search,     setSearch]     = useState("");
//   const [statusF,    setStatusF]    = useState("");
//   const [domaineF,   setDomaineF]   = useState("");
//   const [page,       setPage]       = useState(1);
//   const [showForm,   setShowForm]   = useState(false);
//   const [showDetail, setShowDetail] = useState(false);
//   const [editing,    setEditing]    = useState<Invoice | null>(null);
//   const [selected,   setSelected]   = useState<Invoice | null>(null);
//   const PAGE = 10;

//   const load = useCallback(async () => {
//     setLoading(true);
//     try {
//       const params: any = { page, page_size: PAGE };
//       if (search)   params.search  = search;
//       if (statusF)  params.status  = statusF;
//       if (domaineF) params.domaine = domaineF;
//       const [r, cli, prod] = await Promise.all([
//         billingService.invoices.getAll(params),
//         billingService.clients.getAll(),
//         billingService.products.getSelect(),
//       ]);
//       setInvoices(r.results); setTotal(r.count);
//       setClients(Array.isArray(cli.results) ? cli.results : cli.results ?? []);
//       setProducts(Array.isArray(prod) ? prod : []);
//     } catch { swal.serverError(); } finally { setLoading(false); }
//   }, [page, search, statusF, domaineF]);

//   useEffect(() => { load(); }, [load]);
//   useEffect(() => { setPage(1); }, [search, statusF, domaineF]);

//   const handleDelete = async (inv: Invoice) => {
//     if (!await swal.confirmDelete(inv.invoice_number ?? `Facture #${inv.id}`)) return;
//     try { await billingService.invoices.delete(inv.id); swal.deleted("La facture"); load(); }
//     catch { swal.serverError(); }
//   };

//   return (
//     <div>
//       <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
//         <SearchInput value={search} onChange={setSearch} placeholder="N° facture, client…" theme={theme} />
//         <select value={statusF} onChange={e => setStatusF(e.target.value)}
//           style={{ padding: "0.58rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, cursor: "pointer" }}>
//           <option value="">Tous les statuts</option>
//           {Object.entries(INV_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
//         </select>
//         <select value={domaineF} onChange={e => setDomaineF(e.target.value)}
//           style={{ padding: "0.58rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, cursor: "pointer" }}>
//           <option value="">Tous les domaines</option>
//           <option value="NETSYSTEME">NETSYSTEME</option>
//           <option value="SSE">SSE</option>
//         </select>
//         <span style={{ fontSize: "0.8rem", color: theme.textMuted, marginLeft: "auto" }}>{total} facture{total > 1 ? "s" : ""}</span>
//         <button onClick={() => { setEditing(null); setShowForm(true); }}
//           style={{ padding: "0.58rem 1.1rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
//           + Nouvelle facture
//         </button>
//       </div>

//       <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
//         {loading ? <Spinner /> : invoices.length === 0 ? (
//           <div style={{ padding: "3rem", textAlign: "center", color: theme.textMuted }}>
//             <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📄</div>
//             <div>Aucune facture{search || statusF || domaineF ? " pour ces filtres" : ""}</div>
//           </div>
//         ) : (
//           <div style={{ overflowX: "auto" }}>
//             <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
//               <thead>
//                 <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
//                   {["Numéro", "Client", "Domaine", "Date", "Montant TTC", "Statut", "Actions"].map(h => (
//                     <th key={h} style={{ padding: "0.7rem 1rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {invoices.map((inv, i) => (
//                   <tr key={inv.id}
//                     style={{ borderBottom: i < invoices.length - 1 ? `1px solid ${theme.border}` : "none", transition: "background 0.12s" }}
//                     onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
//                     onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
//                   >
//                     <td style={{ padding: "0.85rem 1rem" }}>
//                       <button onClick={() => { setSelected(inv); setShowDetail(true); }}
//                         style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: PALETTE.primary, fontSize: "0.875rem", fontFamily: FONTS.body, padding: 0 }}>
//                         {inv.invoice_number ?? `#${inv.id}`}
//                       </button>
//                     </td>
//                     <td style={{ padding: "0.85rem 1rem", color: theme.textSecondary, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
//                       {inv.billing_client_detail?.display_name ?? "—"}
//                     </td>
//                     <td style={{ padding: "0.85rem 1rem" }}>
//                       {inv.domaine && (
//                         <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 7px", borderRadius: RADIUS.full, background: inv.domaine === "SSE" ? "rgba(139,92,246,0.12)" : "rgba(6,182,212,0.1)", color: inv.domaine === "SSE" ? "#8b5cf6" : PALETTE.primary }}>
//                           {inv.domaine}
//                         </span>
//                       )}
//                     </td>
//                     <td style={{ padding: "0.85rem 1rem", color: theme.textMuted, whiteSpace: "nowrap" }}>{new Date(inv.date).toLocaleDateString("fr-FR")}</td>
//                     <td style={{ padding: "0.85rem 1rem", fontWeight: 700, color: theme.textPrimary }}>{fmt(inv.total_ttc)} F</td>
//                     <td style={{ padding: "0.85rem 1rem" }}><StatusBadge status={inv.status} cfg={INV_STATUS} /></td>
//                     <td style={{ padding: "0.85rem 1rem" }}>
//                       <div style={{ display: "flex", gap: "0.3rem" }}>
//                         <ActionBtn icon="👁"  color={PALETTE.primary} title="Voir détail"
//                           onClick={() => { setSelected(inv); setShowDetail(true); }} />
//                         <ActionBtn icon="✏️" color="#3b82f6" title="Modifier"
//                           onClick={() => { setEditing(inv); setShowForm(true); }} />
//                         {/* ── PDF via pdfService (axios + token automatique) ── */}
//                         <ActionBtn icon="📄" color="#8b5cf6" title="Voir PDF"
//                           onClick={() =>
//                             pdfService.invoice.view(inv.id, inv.invoice_number)
//                               .catch(() => swal.error("Erreur PDF", "Impossible de générer le PDF."))
//                           } />
//                         <ActionBtn icon="⬇️" color="#10b981" title="Télécharger PDF"
//                           onClick={() =>
//                             pdfService.invoice.download(inv.id, inv.invoice_number)
//                               .catch(() => swal.error("Erreur PDF", "Impossible de télécharger le PDF."))
//                           } />
//                         <ActionBtn icon="🗑" color="#ef4444" title="Supprimer"
//                           onClick={() => handleDelete(inv)} />
//                       </div>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}
//         <Pagination page={page} total={total} pageSize={PAGE} onChange={setPage} theme={theme} />
//       </div>

//       {showForm && (
//         <InvoiceFormModal dark={dark} theme={theme} invoice={editing} clients={clients} products={products}
//           onClose={() => { setShowForm(false); setEditing(null); }}
//           onSaved={() => { setShowForm(false); setEditing(null); load(); }} />
//       )}
//       {showDetail && selected && (
//         <InvoiceDetailModal dark={dark} theme={theme} invoice={selected}
//           onClose={() => { setShowDetail(false); setSelected(null); }}
//           onEdit={() => { setShowDetail(false); setEditing(selected); setShowForm(true); }}
//           onRefresh={load} />
//       )}
//       <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
//     </div>
//   );
// }

// // ═════════════════════════════════════════════════════════════════════════════
// //  ProformasTab
// // ═════════════════════════════════════════════════════════════════════════════
// export function ProformasTab({ theme }: TabProps) {
//   const swal = useSwal();
//   const [proformas, setProformas] = useState<Proforma[]>([]);
//   const [total,     setTotal]     = useState(0);
//   const [loading,   setLoading]   = useState(true);
//   const [search,    setSearch]    = useState("");
//   const [statusF,   setStatusF]   = useState("");
//   const [page,      setPage]      = useState(1);
//   const PAGE = 10;

//   const load = useCallback(async () => {
//     setLoading(true);
//     try {
//       const params: any = { page, page_size: PAGE };
//       if (search)  params.search = search;
//       if (statusF) params.status = statusF;
//       const r = await billingService.proformas.getAll(params);
//       setProformas(r.results); setTotal(r.count);
//     } catch { swal.serverError(); } finally { setLoading(false); }
//   }, [page, search, statusF]);

//   useEffect(() => { load(); }, [load]);
//   useEffect(() => { setPage(1); }, [search, statusF]);

//   const handleConvert = async (p: Proforma) => {
//     if (!await swal.confirm({ title: `Convertir "${p.proforma_number}" en facture ?`, confirmText: "Convertir", icon: "question" })) return;
//     try { await billingService.proformas.convert(p.id); swal.success("Proforma converti en facture !"); load(); }
//     catch (e: any) { swal.error("Erreur", e?.response?.data?.detail); }
//   };

//   const handleDelete = async (p: Proforma) => {
//     if (!await swal.confirmDelete(p.proforma_number ?? `Proforma #${p.id}`)) return;
//     try { await billingService.proformas.delete(p.id); swal.deleted("Le proforma"); load(); }
//     catch { swal.serverError(); }
//   };

//   return (
//     <div>
//       <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
//         <SearchInput value={search} onChange={setSearch} placeholder="N° proforma, client…" theme={theme} />
//         <select value={statusF} onChange={e => setStatusF(e.target.value)}
//           style={{ padding: "0.58rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, cursor: "pointer" }}>
//           <option value="">Tous les statuts</option>
//           {Object.entries(PROF_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
//         </select>
//         <span style={{ fontSize: "0.8rem", color: theme.textMuted, marginLeft: "auto" }}>{total} proforma{total > 1 ? "s" : ""}</span>
//       </div>

//       <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
//         {loading ? <Spinner color="#8b5cf6" /> : proformas.length === 0 ? (
//           <div style={{ padding: "3rem", textAlign: "center", color: theme.textMuted }}>
//             <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📋</div>
//             <div>Aucun proforma</div>
//           </div>
//         ) : (
//           <div style={{ overflowX: "auto" }}>
//             <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
//               <thead>
//                 <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
//                   {["Numéro", "Client", "Domaine", "Date", "Validité", "Montant TTC", "Statut", "Actions"].map(h => (
//                     <th key={h} style={{ padding: "0.7rem 1rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {proformas.map((p, i) => {
//                   const expired = p.valid_until && new Date(p.valid_until) < new Date() && !p.converted_to_invoice;
//                   return (
//                     <tr key={p.id}
//                       style={{ borderBottom: i < proformas.length - 1 ? `1px solid ${theme.border}` : "none", transition: "background 0.12s" }}
//                       onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
//                       onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
//                     >
//                       <td style={{ padding: "0.85rem 1rem", fontWeight: 700, color: "#8b5cf6" }}>{p.proforma_number ?? `#${p.id}`}</td>
//                       <td style={{ padding: "0.85rem 1rem", color: theme.textSecondary, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
//                         {p.billing_client_detail?.display_name ?? "—"}
//                       </td>
//                       <td style={{ padding: "0.85rem 1rem" }}>
//                         {p.domaine && (
//                           <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 7px", borderRadius: RADIUS.full, background: "rgba(6,182,212,0.1)", color: PALETTE.primary }}>
//                             {p.domaine}
//                           </span>
//                         )}
//                       </td>
//                       <td style={{ padding: "0.85rem 1rem", color: theme.textMuted }}>{new Date(p.date).toLocaleDateString("fr-FR")}</td>
//                       <td style={{ padding: "0.85rem 1rem", color: expired ? "#ef4444" : theme.textMuted, fontWeight: expired ? 600 : 400 }}>
//                         {p.valid_until ? `${new Date(p.valid_until).toLocaleDateString("fr-FR")}${expired ? " ⚠" : ""}` : "—"}
//                       </td>
//                       <td style={{ padding: "0.85rem 1rem", fontWeight: 700, color: theme.textPrimary }}>{fmt(p.total_ttc)} F</td>
//                       <td style={{ padding: "0.85rem 1rem" }}><StatusBadge status={p.status} cfg={PROF_STATUS} /></td>
//                       <td style={{ padding: "0.85rem 1rem" }}>
//                         <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
//                           {!p.converted_to_invoice && p.status !== "cancelled" && (
//                             <button onClick={() => handleConvert(p)}
//                               style={{ fontSize: "0.72rem", padding: "3px 8px", borderRadius: "7px", border: `1px solid rgba(16,185,129,0.35)`, background: "transparent", color: "#10b981", cursor: "pointer", fontFamily: FONTS.body }}>
//                               → Facture
//                             </button>
//                           )}
//                           {/* ── PDF via pdfService (axios + token automatique) ── */}
//                           <ActionBtn icon="📄" color="#8b5cf6" title="Voir PDF"
//                             onClick={() =>
//                               pdfService.proforma.view(p.id, p.proforma_number)
//                                 .catch(() => swal.error("Erreur PDF", "Impossible de générer le PDF."))
//                             } />
//                           <ActionBtn icon="⬇️" color="#10b981" title="Télécharger PDF"
//                             onClick={() =>
//                               pdfService.proforma.download(p.id, p.proforma_number)
//                                 .catch(() => swal.error("Erreur PDF", "Impossible de télécharger le PDF."))
//                             } />
//                           <ActionBtn icon="🗑" color="#ef4444" title="Supprimer"
//                             onClick={() => handleDelete(p)} />
//                         </div>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         )}
//         <Pagination page={page} total={total} pageSize={PAGE} onChange={setPage} theme={theme} color="#8b5cf6" />
//       </div>
//       <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
//     </div>
//   );
// }

// // ═════════════════════════════════════════════════════════════════════════════
// //  ClientsTab
// // ═════════════════════════════════════════════════════════════════════════════
// export function ClientsTab({ dark, theme }: TabProps) {
//   const swal = useSwal();
//   const [clients,  setClients]  = useState<BillingClient[]>([]);
//   const [loading,  setLoading]  = useState(true);
//   const [search,   setSearch]   = useState("");
//   const [showForm, setShowForm] = useState(false);
//   const [editing,  setEditing]  = useState<BillingClient | null>(null);
//   const [form, setForm] = useState({ company_name: "", contact_name: "", email: "", phone: "", address: "", tax_id: "" });
//   const [saving, setSaving] = useState(false);

//   const load = useCallback(async () => {
//     setLoading(true);
//     try {
//       const r = await billingService.clients.getAll(search ? { search } : undefined);
//       setClients(r.results);
//     } catch { swal.serverError(); } finally { setLoading(false); }
//   }, [search]);

//   useEffect(() => { load(); }, [load]);

//   const openForm = (c?: BillingClient) => {
//     setEditing(c ?? null);
//     setForm(c
//       ? { company_name: c.company_name ?? "", contact_name: c.contact_name ?? "", email: c.email ?? "", phone: c.phone, address: c.address ?? "", tax_id: c.tax_id ?? "" }
//       : { company_name: "", contact_name: "", email: "", phone: "", address: "", tax_id: "" });
//     setShowForm(true);
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!form.phone.trim()) { swal.error("Requis", "Le téléphone est obligatoire."); return; }
//     setSaving(true);
//     try {
//       if (editing) { await billingService.clients.update(editing.id, form); swal.updated("Le client"); }
//       else         { await billingService.clients.create(form);              swal.saved("Le client");   }
//       setShowForm(false); load();
//     } catch { swal.serverError(); } finally { setSaving(false); }
//   };

//   const handleDelete = async (c: BillingClient) => {
//     if (!c.can_delete) { swal.error("Impossible", "Ce client a des factures ou proformas associés."); return; }
//     if (!await swal.confirmDelete(c.display_name)) return;
//     try { await billingService.clients.delete(c.id); swal.deleted("Le client"); load(); }
//     catch { swal.serverError(); }
//   };

//   const inp: React.CSSProperties = { width: "100%", padding: "0.62rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" as const };
//   const lbl: React.CSSProperties = { display: "block", fontSize: "0.72rem", fontWeight: 600, color: theme.textSecondary, marginBottom: "0.28rem", textTransform: "uppercase", letterSpacing: "0.05em" };

//   return (
//     <div>
//       <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", alignItems: "center" }}>
//         <SearchInput value={search} onChange={setSearch} placeholder="Nom, email, téléphone…" theme={theme} />
//         <button onClick={() => openForm()}
//           style={{ padding: "0.58rem 1.1rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
//           + Nouveau client
//         </button>
//       </div>

//       <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
//         {loading ? <Spinner /> : clients.length === 0 ? (
//           <div style={{ padding: "3rem", textAlign: "center", color: theme.textMuted }}>
//             <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>👥</div><div>Aucun client</div>
//           </div>
//         ) : (
//           <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
//             <thead>
//               <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
//                 {["Entreprise / Contact", "Téléphone", "Email", "NINEA", "Factures", ""].map(h => (
//                   <th key={h} style={{ padding: "0.7rem 1rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
//                 ))}
//               </tr>
//             </thead>
//             <tbody>
//               {clients.map((c, i) => (
//                 <tr key={c.id}
//                   style={{ borderBottom: i < clients.length - 1 ? `1px solid ${theme.border}` : "none", transition: "background 0.12s" }}
//                   onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
//                   onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
//                 >
//                   <td style={{ padding: "0.85rem 1rem" }}>
//                     <div style={{ fontWeight: 600, color: theme.textPrimary }}>{c.company_name ?? c.contact_name ?? "—"}</div>
//                     {c.company_name && c.contact_name && <div style={{ fontSize: "0.75rem", color: theme.textMuted }}>{c.contact_name}</div>}
//                   </td>
//                   <td style={{ padding: "0.85rem 1rem" }}><a href={`tel:${c.phone}`} style={{ color: PALETTE.primary, textDecoration: "none", fontWeight: 500 }}>{c.phone}</a></td>
//                   <td style={{ padding: "0.85rem 1rem", color: theme.textSecondary, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email ?? "—"}</td>
//                   <td style={{ padding: "0.85rem 1rem", color: theme.textMuted }}>{c.tax_id ?? "—"}</td>
//                   <td style={{ padding: "0.85rem 1rem" }}>
//                     <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 7px", borderRadius: RADIUS.full, background: c.can_delete ? "rgba(16,185,129,0.1)" : "rgba(59,130,246,0.1)", color: c.can_delete ? "#10b981" : "#3b82f6" }}>
//                       {c.invoices_count} facture{c.invoices_count !== 1 ? "s" : ""}
//                     </span>
//                   </td>
//                   <td style={{ padding: "0.85rem 1rem" }}>
//                     <div style={{ display: "flex", gap: "0.3rem" }}>
//                       <ActionBtn icon="✏️" color="#3b82f6" title="Modifier"  onClick={() => openForm(c)} />
//                       <ActionBtn icon="🗑"  color="#ef4444" title="Supprimer" onClick={() => handleDelete(c)} />
//                     </div>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         )}
//       </div>

//       {showForm && (
//         <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
//           onClick={e => e.target === e.currentTarget && setShowForm(false)}>
//           <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.6)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>
//             <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//               <h2 style={{ fontFamily: "inherit", fontSize: "1.05rem", fontWeight: 700, color: theme.textPrimary }}>{editing ? "Modifier le client" : "Nouveau client"}</h2>
//               <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
//             </div>
//             <form onSubmit={handleSubmit} style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
//               {([["company_name","Entreprise",false],["contact_name","Contact",false],["phone","Téléphone",true],["email","Email",false],["tax_id","NINEA / Fiscal",false]] as [string,string,boolean][]).map(([k,l,req]) => (
//                 <div key={k}>
//                   <label style={lbl}>{l}{req && " *"}</label>
//                   <input required={req} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inp} />
//                 </div>
//               ))}
//               <div style={{ gridColumn: "1/-1" }}>
//                 <label style={lbl}>Adresse</label>
//                 <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2} style={{ ...inp, resize: "vertical" }} />
//               </div>
//               <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem", borderTop: `1px solid ${theme.border}` }}>
//                 <button type="button" onClick={() => setShowForm(false)} style={{ padding: "0.62rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>Annuler</button>
//                 <button type="submit" disabled={saving} style={{ padding: "0.62rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
//                   {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Créer"}
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//       <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
//     </div>
//   );
// }

// // ═════════════════════════════════════════════════════════════════════════════
// //  ProductsTab
// // ═════════════════════════════════════════════════════════════════════════════
// export function ProductsTab({ dark, theme }: TabProps) {
//   const swal = useSwal();
//   const [products, setProducts] = useState<Product[]>([]);
//   const [loading,  setLoading]  = useState(true);
//   const [search,   setSearch]   = useState("");
//   const [showForm, setShowForm] = useState(false);
//   const [editing,  setEditing]  = useState<Product | null>(null);
//   const [form, setForm] = useState({ name: "", description: "", qty: "0", prix: "0", fournisseur: "", alert_quantity: "5" });
//   const [imgFile, setImgFile]   = useState<File | null>(null);
//   const [saving,  setSaving]    = useState(false);

//   const load = useCallback(async () => {
//     setLoading(true);
//     try {
//       const r = await billingService.products.getAll(search ? { search } : undefined);
//       setProducts(r.results);
//     } catch { swal.serverError(); } finally { setLoading(false); }
//   }, [search]);

//   useEffect(() => { load(); }, [load]);

//   const openForm = (p?: Product) => {
//     setEditing(p ?? null);
//     setForm(p
//       ? { name: p.name ?? "", description: p.description ?? "", qty: String(p.quantity), prix: String(p.unit_price), fournisseur: p.supplier ?? "", alert_quantity: String(p.alert_quantity) }
//       : { name: "", description: "", qty: "0", prix: "0", fournisseur: "", alert_quantity: "5" });
//     setImgFile(null); setShowForm(true);
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setSaving(true);
//     try {
//       const fd = new FormData();
//       Object.entries(form).forEach(([k, v]) => fd.append(k, v));
//       if (imgFile) fd.append("img", imgFile);
//       if (editing) { await billingService.products.update(editing.id, fd); swal.updated("Le produit"); }
//       else         { await billingService.products.create(fd);              swal.saved("Le produit");   }
//       setShowForm(false); load();
//     } catch { swal.serverError(); } finally { setSaving(false); }
//   };

//   const handleDelete = async (p: Product) => {
//     if (!await swal.confirmDelete(p.name ?? p.description ?? `Produit #${p.id}`)) return;
//     try { await billingService.products.delete(p.id); swal.deleted("Le produit"); load(); }
//     catch { swal.serverError(); }
//   };

//   const STOCK: Record<string, { label: string; bg: string; text: string }> = {
//     ok:      { label: "🟢 En stock",    bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
//     faible:  { label: "🟡 Stock faible", bg: "rgba(245,158,11,0.12)", text: "#f59e0b" },
//     rupture: { label: "🔴 Rupture",      bg: "rgba(239,68,68,0.12)",  text: "#ef4444" },
//   };

//   const inp: React.CSSProperties = { width: "100%", padding: "0.62rem 0.85rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body, outline: "none", boxSizing: "border-box" as const };
//   const lbl: React.CSSProperties = { display: "block", fontSize: "0.72rem", fontWeight: 600, color: theme.textSecondary, marginBottom: "0.28rem", textTransform: "uppercase", letterSpacing: "0.05em" };

//   return (
//     <div>
//       <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", alignItems: "center" }}>
//         <SearchInput value={search} onChange={setSearch} placeholder="Nom, description, fournisseur…" theme={theme} />
//         <button onClick={() => openForm()}
//           style={{ padding: "0.58rem 1.1rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
//           + Nouveau produit
//         </button>
//       </div>

//       {loading ? <Spinner /> : (
//         <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "1rem" }}>
//           {products.length === 0 ? (
//             <div style={{ gridColumn: "1/-1", padding: "3rem", textAlign: "center", color: theme.textMuted, background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px" }}>
//               <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📦</div><div>Aucun produit</div>
//             </div>
//           ) : products.map(p => {
//             const st = STOCK[p.stock_status] ?? STOCK.ok;
//             return (
//               <div key={p.id}
//                 style={{ background: theme.cardBg, border: `1px solid ${p.stock_status !== "ok" ? (p.stock_status === "rupture" ? "#ef444433" : "#f59e0b33") : theme.border}`, borderRadius: "14px", overflow: "hidden", transition: "all 0.15s" }}
//                 onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 4px 20px ${PALETTE.primary}18`)}
//                 onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
//               >
//                 <div style={{ height: 130, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
//                   {p.image_url ? <img src={p.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "3rem", opacity: 0.25 }}>📦</span>}
//                   <div style={{ position: "absolute", top: 8, right: 8 }}>
//                     <span style={{ fontSize: "0.68rem", fontWeight: 600, padding: "2px 7px", borderRadius: RADIUS.full, background: st.bg, color: st.text }}>{st.label}</span>
//                   </div>
//                 </div>
//                 <div style={{ padding: "0.9rem" }}>
//                   <div style={{ fontWeight: 700, fontSize: "0.9rem", color: theme.textPrimary, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name ?? p.description}</div>
//                   {p.name && p.description && <div style={{ fontSize: "0.75rem", color: theme.textMuted, marginBottom: "0.65rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>}
//                   <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
//                     <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>Prix unitaire</span>
//                     <span style={{ fontWeight: 700, color: PALETTE.primary }}>{fmt(p.unit_price)} F</span>
//                   </div>
//                   <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
//                     <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>Quantité</span>
//                     <span style={{ fontWeight: 600, color: p.stock_status !== "ok" ? STOCK[p.stock_status]?.text : theme.textPrimary }}>{p.quantity}</span>
//                   </div>
//                   <div style={{ display: "flex", gap: "0.4rem", paddingTop: "0.65rem", borderTop: `1px solid ${theme.border}` }}>
//                     <button onClick={() => openForm(p)} style={{ flex: 1, padding: "0.42rem", borderRadius: RADIUS.md, border: `1px solid rgba(59,130,246,0.3)`, background: "transparent", color: "#3b82f6", fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body }}>Modifier</button>
//                     <button onClick={() => handleDelete(p)} style={{ width: 30, borderRadius: RADIUS.md, border: `1px solid rgba(239,68,68,0.3)`, background: "transparent", color: "#ef4444", fontSize: "0.85rem", cursor: "pointer" }}>🗑</button>
//                   </div>
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//       )}

//       {showForm && (
//         <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
//           onClick={e => e.target === e.currentTarget && setShowForm(false)}>
//           <div style={{ background: theme.popupBg, border: `1px solid ${theme.border}`, borderRadius: "18px", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.6)" : "0 24px 60px rgba(0,0,0,0.15)", fontFamily: FONTS.body }}>
//             <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//               <h2 style={{ fontFamily: "inherit", fontSize: "1.05rem", fontWeight: 700, color: theme.textPrimary }}>{editing ? "Modifier le produit" : "Nouveau produit"}</h2>
//               <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
//             </div>
//             <form onSubmit={handleSubmit} style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
//               <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Nom *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} /></div>
//               <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inp, resize: "vertical" }} /></div>
//               <div><label style={lbl}>Quantité</label><input type="number" min="0" step="0.01" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} style={inp} /></div>
//               <div><label style={lbl}>Prix unitaire (F) *</label><input type="number" min="0" step="0.01" required value={form.prix} onChange={e => setForm(f => ({ ...f, prix: e.target.value }))} style={inp} /></div>
//               <div><label style={lbl}>Fournisseur</label><input value={form.fournisseur} onChange={e => setForm(f => ({ ...f, fournisseur: e.target.value }))} style={inp} /></div>
//               <div><label style={lbl}>Alerte stock</label><input type="number" min="0" value={form.alert_quantity} onChange={e => setForm(f => ({ ...f, alert_quantity: e.target.value }))} style={inp} /></div>
//               <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Image</label><input type="file" accept="image/*" onChange={e => setImgFile(e.target.files?.[0] ?? null)} style={{ ...inp, padding: "0.45rem" }} /></div>
//               <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem", borderTop: `1px solid ${theme.border}` }}>
//                 <button type="button" onClick={() => setShowForm(false)} style={{ padding: "0.62rem 1.25rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textSecondary, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body }}>Annuler</button>
//                 <button type="submit" disabled={saving} style={{ padding: "0.62rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
//                   {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Créer"}
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//       <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
//     </div>
//   );
// }

// export default InvoicesTab;