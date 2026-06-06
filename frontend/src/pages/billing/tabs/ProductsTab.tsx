import { useState, useEffect, useCallback } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { productsService, type Product, type ProductStats } from "../../../services/productsService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";
import ProductFormModal  from "../../products/components/ProductFormModal";
import StockAdjustModal  from "../../products/components/StockAdjustModal";

interface TabProps { dark: boolean; theme: LayoutContext["theme"]; }

// ── Status stock ──────────────────────────────────────────────────────────────
const STOCK_STATUS = {
  ok:      { label: "En stock",    bg: "rgba(16,185,129,0.12)",  text: "#10b981", icon: "🟢" },
  faible:  { label: "Stock faible", bg: "rgba(245,158,11,0.12)", text: "#f59e0b", icon: "🟡" },
  rupture: { label: "Rupture",      bg: "rgba(239,68,68,0.12)",  text: "#ef4444", icon: "🔴" },
};

function StockBadge({ status }: { status: "ok" | "faible" | "rupture" }) {
  const s = STOCK_STATUS[status];
  return (
    <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: RADIUS.full, background: s.bg, color: s.text, whiteSpace: "nowrap" }}>
      {s.icon} {s.label}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon, sub, theme }: {
  label: string; value: string | number; color: string;
  icon: string; sub?: string; theme: LayoutContext["theme"];
}) {
  return (
    <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.85rem" }}>
      <div style={{ width: 46, height: 46, borderRadius: "12px", background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "0.72rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: "1.45rem", fontWeight: 700, fontFamily: FONTS.display, color: theme.textPrimary, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: "0.72rem", color: theme.textMuted, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── ProductCard ───────────────────────────────────────────────────────────────
function ProductCard({ product: p, theme, dark, onEdit, onDelete, onAdjust }: {
  product: Product; theme: LayoutContext["theme"]; dark: boolean;
  onEdit: () => void; onDelete: () => void; onAdjust: () => void;
}) {
  const [hov, setHov] = useState(false);
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
  const st  = STOCK_STATUS[p.stock_status];

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? theme.cardBgHover : theme.cardBg,
        border: `1px solid ${hov ? PALETTE.primary + "44" : p.stock_status !== "ok" ? (p.stock_status === "rupture" ? "#ef444444" : "#f59e0b44") : theme.border}`,
        borderRadius: "14px", overflow: "hidden", transition: "all 0.2s",
        transform: hov ? "translateY(-2px)" : "none",
        boxShadow: hov ? (dark ? "0 8px 28px rgba(0,0,0,0.35)" : "0 6px 20px rgba(6,182,212,0.1)") : "none",
      }}
    >
      {/* Image */}
      <div style={{ height: 160, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
        {p.image_url
          ? <img src={p.image_url} alt={p.name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ fontSize: "3.5rem", opacity: 0.3 }}>📦</div>}
        <div style={{ position: "absolute", top: 8, right: 8 }}>
          <StockBadge status={p.stock_status} />
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "1rem" }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: theme.textPrimary, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {p.name ?? p.description ?? "—"}
        </div>
        {p.name && p.description && (
          <div style={{ fontSize: "0.78rem", color: theme.textMuted, marginBottom: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.85rem" }}>
          {[
            { l: "Prix unitaire", v: `${fmt(p.unit_price)} F`, c: PALETTE.primary },
            { l: "En stock",      v: `${p.quantity} unités`,   c: st.text        },
            { l: "Alerte à",      v: `${p.alert_quantity} unités`, c: theme.textMuted },
            ...(p.supplier ? [{ l: "Fournisseur", v: p.supplier, c: theme.textMuted }] : []),
          ].map(m => (
            <div key={m.l} style={{ background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)", borderRadius: "8px", padding: "0.45rem 0.6rem" }}>
              <div style={{ fontSize: "0.67rem", color: theme.textMuted, marginBottom: 1 }}>{m.l}</div>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: m.c, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.4rem", paddingTop: "0.75rem", borderTop: `1px solid ${theme.border}` }}>
          <button onClick={onAdjust}
            style={{ flex: 1, padding: "0.48rem", borderRadius: RADIUS.md, border: "1px solid rgba(16,185,129,0.3)", background: "transparent", color: "#10b981", fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body, transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(16,185,129,0.08)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >⚡ Stock</button>
          <button onClick={onEdit}
            style={{ flex: 1, padding: "0.48rem", borderRadius: RADIUS.md, border: "1px solid rgba(59,130,246,0.3)", background: "transparent", color: "#3b82f6", fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body, transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(59,130,246,0.08)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >✏️ Modifier</button>
          <button onClick={onDelete}
            style={{ width: 34, borderRadius: RADIUS.md, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#ef4444", fontSize: "0.85rem", cursor: "pointer", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >🗑</button>
        </div>
      </div>
    </div>
  );
}

// ── ProductsTab ───────────────────────────────────────────────────────────────
export default function ProductsTab({ dark, theme }: TabProps) {
  const swal = useSwal();

  const [products, setProducts] = useState<Product[]>([]);
  const [stats,    setStats]    = useState<ProductStats | null>(null);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);

  const [search,      setSearch]      = useState("");
  const [stockFilter, setStockFilter] = useState<"" | "ok" | "faible" | "rupture">("");
  const [view,        setView]        = useState<"cards" | "table">("cards");
  const [page,        setPage]        = useState(1);
  const PAGE_SIZE = 12;

  const [showForm,   setShowForm]   = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [editing,    setEditing]    = useState<Product | null>(null);
  const [adjusting,  setAdjusting]  = useState<Product | null>(null);

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
      if (search) params.search = search;

      const [res, statsRes] = await Promise.all([
        productsService.getAll(params),
        productsService.getStats(),
      ]);

      let items = res.results;
      if (stockFilter) items = items.filter(p => p.stock_status === stockFilter);

      setProducts(items);
      setTotal(stockFilter ? items.length : res.count);
      setStats(statsRes);
    } catch {
      swal.serverError();
    } finally {
      setLoading(false);
    }
  }, [page, search, stockFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, stockFilter]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleDelete = async (p: Product) => {
    const ok = await swal.confirmDelete(p.name ?? p.description ?? `Produit #${p.id}`);
    if (!ok) return;
    try { await productsService.delete(p.id); swal.deleted("Le produit"); load(); }
    catch { swal.serverError(); }
  };

  const handleSaved = () => {
    setShowForm(false); setEditing(null);
    setShowAdjust(false); setAdjusting(null);
    load();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ fontFamily: FONTS.body }}>

      {/* ── Stats ── */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))", gap: "0.85rem", marginBottom: "1.75rem" }}>
          <StatCard label="Total produits"  value={stats.total}        color={PALETTE.primary} icon="📦" theme={theme} />
          <StatCard label="En stock"        value={stats.stock_ok}     color="#10b981"         icon="🟢" theme={theme} />
          <StatCard label="Stock faible"    value={stats.stock_faible} color="#f59e0b"         icon="🟡" theme={theme} />
          <StatCard label="En rupture"      value={stats.en_rupture}   color="#ef4444"         icon="🔴" theme={theme} />
          <StatCard label="Valeur du stock" value={`${fmt(stats.valeur_stock)} F`} color={PALETTE.warning} icon="💰" sub="FCFA" theme={theme} />
        </div>
      )}

      {/* ── Alerte stock ── */}
      {stats && (stats.stock_faible > 0 || stats.en_rupture > 0) && (
        <div style={{ padding: "0.85rem 1.1rem", borderRadius: RADIUS.md, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.2rem" }}>⚠️</span>
          <div style={{ fontSize: "0.85rem", color: theme.textPrimary }}>
            <strong>{stats.en_rupture}</strong> produit{stats.en_rupture > 1 ? "s" : ""} en rupture
            {stats.stock_faible > 0 && <>, <strong>{stats.stock_faible}</strong> en stock faible</>}.{" "}
            <button onClick={() => setStockFilter(stockFilter === "rupture" ? "" : "rupture")}
              style={{ color: PALETTE.primary, background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline", fontFamily: FONTS.body }}>
              Afficher
            </button>
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted, pointerEvents: "none" }}>
            <svg width={15} height={15} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, description, fournisseur…"
            style={{ width: "100%", padding: "0.58rem 0.85rem 0.58rem 2.4rem", borderRadius: RADIUS.md, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textPrimary, fontSize: "0.875rem", outline: "none", fontFamily: FONTS.body }} />
        </div>

        {/* Filtres stock */}
        <div style={{ display: "flex", gap: "0.35rem" }}>
          {(["", "ok", "faible", "rupture"] as const).map(f => {
            const cfg = f === ""
              ? { label: "Tous", color: theme.textMuted }
              : { label: STOCK_STATUS[f].label, color: STOCK_STATUS[f].text };
            const isActive = stockFilter === f;
            return (
              <button key={f} onClick={() => setStockFilter(f)}
                style={{
                  padding: "0.45rem 0.85rem", borderRadius: RADIUS.md, cursor: "pointer", fontFamily: FONTS.body, fontSize: "0.78rem", transition: "all 0.15s",
                  border: `1px solid ${isActive ? (f === "" ? PALETTE.primary : STOCK_STATUS[f as keyof typeof STOCK_STATUS]?.text ?? PALETTE.primary) : theme.border}`,
                  background: isActive ? (f === "" ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : STOCK_STATUS[f as keyof typeof STOCK_STATUS]?.bg ?? "transparent") : "transparent",
                  color: isActive ? (f === "" ? "#fff" : cfg.color) : theme.textMuted,
                }}>
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Vue toggle */}
        <div style={{ display: "flex", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: RADIUS.md, padding: "2px", gap: "2px", marginLeft: "auto" }}>
          {(["cards", "table"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: "0.38rem 0.7rem", borderRadius: "7px", border: "none", background: view === v ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : "transparent", color: view === v ? "#fff" : theme.textMuted, fontSize: "0.78rem", cursor: "pointer", fontFamily: FONTS.body, transition: "all 0.15s" }}>
              {v === "cards" ? "⊞ Cartes" : "☰ Tableau"}
            </button>
          ))}
        </div>

        <span style={{ fontSize: "0.8rem", color: theme.textMuted }}>{total} produit{total > 1 ? "s" : ""}</span>

        <button onClick={() => { setEditing(null); setShowForm(true); }}
          style={{ padding: "0.58rem 1.1rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
          + Nouveau produit
        </button>
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 240 }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📦</div>
          <div style={{ fontWeight: 600, color: theme.textPrimary, marginBottom: "0.35rem" }}>
            {search || stockFilter ? "Aucun résultat" : "Aucun produit enregistré"}
          </div>
          <div style={{ fontSize: "0.875rem", color: theme.textMuted, marginBottom: "1.25rem" }}>
            {search || stockFilter ? "Modifiez vos filtres" : "Commencez par ajouter votre premier produit"}
          </div>
          {!search && !stockFilter && (
            <button onClick={() => setShowForm(true)}
              style={{ padding: "0.65rem 1.5rem", borderRadius: RADIUS.md, border: "none", background: `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`, color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: FONTS.body }}>
              + Ajouter un produit
            </button>
          )}
        </div>
      ) : view === "cards" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1rem" }}>
          {products.map(p => (
            <ProductCard key={p.id} product={p} theme={theme} dark={dark}
              onEdit={() => { setEditing(p); setShowForm(true); }}
              onDelete={() => handleDelete(p)}
              onAdjust={() => { setAdjusting(p); setShowAdjust(true); }}
            />
          ))}
        </div>
      ) : (
        /* ── Table view ── */
        <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "14px", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", fontFamily: FONTS.body }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  {["Produit", "Prix unitaire", "Quantité", "Alerte", "Fournisseur", "Statut", "Actions"].map(h => (
                    <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.7rem", fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={p.id}
                    style={{ borderBottom: i < products.length - 1 ? `1px solid ${theme.border}` : "none", transition: "background 0.12s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = theme.cardBgHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                        <div style={{ width: 38, height: 38, borderRadius: "9px", overflow: "hidden", flexShrink: 0, background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {p.image_url
                            ? <img src={p.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <span style={{ fontSize: "1.2rem", opacity: 0.4 }}>📦</span>}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: theme.textPrimary }}>{p.name ?? "—"}</div>
                          {p.description && p.name !== p.description && (
                            <div style={{ fontSize: "0.75rem", color: theme.textMuted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "0.85rem 1rem", fontWeight: 700, color: PALETTE.primary }}>{fmt(p.unit_price)} F</td>
                    <td style={{ padding: "0.85rem 1rem", fontWeight: 600, color: p.stock_status !== "ok" ? STOCK_STATUS[p.stock_status].text : theme.textPrimary }}>{p.quantity}</td>
                    <td style={{ padding: "0.85rem 1rem", color: theme.textMuted }}>{p.alert_quantity}</td>
                    <td style={{ padding: "0.85rem 1rem", color: theme.textMuted, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.supplier ?? "—"}</td>
                    <td style={{ padding: "0.85rem 1rem" }}><StockBadge status={p.stock_status} /></td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        {[
                          { icon: "⚡", color: "#10b981", title: "Ajuster stock", action: () => { setAdjusting(p); setShowAdjust(true); } },
                          { icon: "✏️", color: "#3b82f6", title: "Modifier",      action: () => { setEditing(p);  setShowForm(true);   } },
                          { icon: "🗑", color: "#ef4444", title: "Supprimer",     action: () => handleDelete(p) },
                        ].map(btn => (
                          <button key={btn.icon} onClick={btn.action} title={btn.title}
                            style={{ width: 30, height: 30, borderRadius: RADIUS.md, border: `1px solid ${btn.color}33`, background: "transparent", color: btn.color, cursor: "pointer", fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
                            onMouseEnter={e => (e.currentTarget.style.background = btn.color + "18")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
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
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.35rem", marginTop: "1rem" }}>
          {[...Array(Math.min(totalPages, 7))].map((_, i) => {
            const p = i + 1;
            return (
              <button key={p} onClick={() => setPage(p)}
                style={{ width: 32, height: 32, borderRadius: RADIUS.md, border: `1px solid ${p === page ? PALETTE.primary : theme.border}`, background: p === page ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})` : "transparent", color: p === page ? "#fff" : theme.textMuted, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONTS.body }}>
                {p}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {showForm && (
        <ProductFormModal dark={dark} theme={theme} product={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={handleSaved} />
      )}
      {showAdjust && adjusting && (
        <StockAdjustModal dark={dark} theme={theme} product={adjusting}
          onClose={() => { setShowAdjust(false); setAdjusting(null); }}
          onSaved={handleSaved} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}