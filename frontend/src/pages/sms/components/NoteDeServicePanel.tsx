// ─────────────────────────────────────────────────────────────────────────────
//  NoteDeServicePanel.tsx
//  Modal d'envoi groupé de SMS (notes de service) aux employés par rôle
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo } from "react";
import { type LayoutContext } from "../../../layouts/MainLayout";
import { smsService, type SMSDomain, type SMSDomainInfo } from "../../../services/smsService";
import { usersService, type User, type Role } from "../../../services/usersService";
import { useSwal } from "../../../hooks/useSwal";
import { FONTS, PALETTE, RADIUS } from "../../../theme";

interface Props {
  dark:    boolean;
  theme:   LayoutContext["theme"];
  onClose: () => void;
  onSent:  () => void;
}

const DEFAULT_DOMAINS: SMSDomainInfo[] = [
  { value: "NETSYSTEME", label: "NETSYSTEME", sender_name: "NETSYSTEME" },
  { value: "SSE",        label: "SSE",        sender_name: "SSE" },
];

// ── CSS responsive ─────────────────────────────────────────────────────────────
const CSS = `
  @keyframes nds-spin { to { transform: rotate(360deg); } }
  @keyframes nds-fade { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

  .nds-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.65);
    z-index: 600;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  @media (min-width: 640px) {
    .nds-overlay { align-items: center; padding: 1rem; }
  }

  .nds-modal {
    width: 100%;
    max-height: 97vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border-radius: 20px 20px 0 0;
    animation: nds-fade 0.22s ease-out;
  }
  @media (min-width: 640px) {
    .nds-modal {
      max-width: 960px;
      max-height: 92vh;
      border-radius: 20px;
    }
  }

  .nds-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  @media (min-width: 700px) {
    .nds-body {
      flex-direction: row;
    }
  }

  /* Colonne gauche : rôles + employés */
  .nds-left {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }
  @media (min-width: 700px) {
    .nds-left {
      width: 55%;
      border-right: 1px solid var(--nds-border);
    }
  }

  /* Colonne droite : message + envoi */
  .nds-right {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 1rem;
    gap: 0.85rem;
  }
  @media (min-width: 700px) {
    .nds-right {
      flex: 1;
      padding: 1.25rem;
    }
  }

  /* Chips des rôles */
  .nds-roles {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--nds-border);
  }
  @media (max-width: 400px) {
    .nds-roles { padding: 0.6rem 0.75rem; gap: 0.3rem; }
  }

  .nds-role-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    border: 2px solid transparent;
    transition: all 0.15s;
    white-space: nowrap;
    font-family: inherit;
  }
  @media (max-width: 400px) {
    .nds-role-chip { font-size: 0.72rem; padding: 0.25rem 0.55rem; }
  }

  /* Liste des employés */
  .nds-emp-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 0.75rem;
  }
  @media (min-width: 640px) {
    .nds-emp-list { padding: 0.75rem 1rem; }
  }

  .nds-emp-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.65rem;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.1s;
    border: 1px solid transparent;
  }
  .nds-emp-item:hover:not(.nds-emp-disabled) {
    background: var(--nds-hover);
  }
  .nds-emp-item.nds-emp-selected {
    background: rgba(0,175,212,0.08);
    border-color: rgba(0,175,212,0.25);
  }
  .nds-emp-item.nds-emp-disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* Barre de progression */
  .nds-progress-bar {
    height: 6px;
    border-radius: 999px;
    overflow: hidden;
  }
  .nds-progress-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.3s ease;
  }

  /* Section card interne */
  .nds-card {
    border-radius: 12px;
    padding: 0.9rem 1rem;
  }
  @media (max-width: 400px) {
    .nds-card { padding: 0.75rem 0.85rem; }
  }

  /* Résumé sélection */
  .nds-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }

  /* Textarea message */
  .nds-textarea {
    width: 100%;
    resize: vertical;
    min-height: 110px;
    font-family: inherit;
    font-size: 0.875rem;
    line-height: 1.55;
    padding: 0.65rem 0.85rem;
    border-radius: 10px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }
  @media (max-width: 400px) {
    .nds-textarea { min-height: 90px; font-size: 0.82rem; }
  }

  /* Bouton envoi */
  .nds-send-btn {
    width: 100%;
    padding: 0.9rem;
    border-radius: 12px;
    border: none;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.18s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  @media (max-width: 400px) {
    .nds-send-btn { font-size: 0.875rem; padding: 0.8rem; }
  }
`;

// ── Utilitaires ────────────────────────────────────────────────────────────────
const ROLE_COLORS: string[] = [
  "#00afd4", "#7c3aed", "#10b981", "#f59e0b", "#e53535",
  "#3b82f6", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
];

function roleColor(index: number): string {
  return ROLE_COLORS[index % ROLE_COLORS.length];
}

function avatarInitials(user: User): string {
  return ((user.nom?.[0] ?? "") + (user.prenom?.[0] ?? "")).toUpperCase() || "?";
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function NoteDeServicePanel({ dark, theme, onClose, onSent }: Props) {
  const swal = useSwal();

  // ── État ──────────────────────────────────────────────────────────────────
  const [roles,           setRoles]           = useState<Role[]>([]);
  const [employees,       setEmployees]       = useState<User[]>([]);
  const [selectedRoles,   setSelectedRoles]   = useState<Set<number>>(new Set());
  const [selectedEmps,    setSelectedEmps]    = useState<Set<number>>(new Set());
  const [loadingRoles,    setLoadingRoles]    = useState(true);
  const [loadingEmps,     setLoadingEmps]     = useState(false);
  const [message,         setMessage]         = useState("");
  const [domain,          setDomain]          = useState<SMSDomain>("NETSYSTEME");
  const [sending,         setSending]         = useState(false);
  const [progress,        setProgress]        = useState({ done: 0, total: 0 });
  const [searchEmp,       setSearchEmp]       = useState("");
  const [showMobileMsg,   setShowMobileMsg]   = useState(false);

  // ── Chargement des rôles ──────────────────────────────────────────────────
  useEffect(() => {
    usersService.getRoles()
      .then(r => setRoles(r))
      .catch(() => swal.serverError())
      .finally(() => setLoadingRoles(false));
  }, []);

  // ── Chargement de tous les employés actifs ────────────────────────────────
  const loadEmployees = useCallback(async () => {
    setLoadingEmps(true);
    try {
      const list = await usersService.getAllForSms();
      setEmployees(list);
    } catch {
      swal.serverError();
    } finally {
      setLoadingEmps(false);
    }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  // ── Employés filtrés par rôles sélectionnés + recherche ──────────────────
  const filteredEmployees = useMemo(() => {
    let list = employees;

    // Filtrer par rôles sélectionnés (si aucun sélectionné → tous)
    if (selectedRoles.size > 0) {
      list = list.filter(e => e.role && selectedRoles.has(e.role.id));
    }

    // Filtrer par recherche
    if (searchEmp.trim()) {
      const q = searchEmp.toLowerCase();
      list = list.filter(e =>
        `${e.nom} ${e.prenom}`.toLowerCase().includes(q) ||
        (e.telephone ?? "").includes(q) ||
        (e.role?.name ?? "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [employees, selectedRoles, searchEmp]);

  // Employés avec téléphone
  const empsWithPhone = useMemo(
    () => filteredEmployees.filter(e => e.telephone?.trim()),
    [filteredEmployees]
  );

  // ── Sélection des rôles ───────────────────────────────────────────────────
  const toggleRole = (roleId: number) => {
    setSelectedRoles(prev => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
    // Réinitialiser la sélection des employés quand les rôles changent
    setSelectedEmps(new Set());
  };

  const selectAllRoles = () => {
    setSelectedRoles(new Set(roles.map(r => r.id)));
    setSelectedEmps(new Set());
  };

  const clearRoles = () => {
    setSelectedRoles(new Set());
    setSelectedEmps(new Set());
  };

  // ── Sélection des employés ────────────────────────────────────────────────
  const toggleEmp = (empId: number, hasPhone: boolean) => {
    if (!hasPhone) return;
    setSelectedEmps(prev => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

  const selectAllWithPhone = () => {
    setSelectedEmps(new Set(empsWithPhone.map(e => e.id)));
  };

  const clearEmps = () => setSelectedEmps(new Set());

  // ── Employés finalement sélectionnés pour l'envoi ─────────────────────────
  const recipientsToSend = useMemo(
    () => employees.filter(e => selectedEmps.has(e.id) && e.telephone?.trim()),
    [employees, selectedEmps]
  );

  // ── Envoi ─────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (recipientsToSend.length === 0) {
      swal.error("Aucun destinataire", "Sélectionnez au moins un employé avec un numéro.");
      return;
    }
    if (!message.trim()) {
      swal.error("Message vide", "Rédigez votre note de service avant d'envoyer.");
      return;
    }

    const confirmed = await swal.confirm({
      title: `Envoyer à ${recipientsToSend.length} employé(s) via ${domain} ?`,
      icon: "question",
      confirmText: "Envoyer",
    });
    if (!confirmed) return;

    setSending(true);
    setProgress({ done: 0, total: recipientsToSend.length });
    let ok = 0, fail = 0;

    for (let i = 0; i < recipientsToSend.length; i++) {
      const emp = recipientsToSend[i];
      try {
        const r = await smsService.sendQuick({
          phone:          emp.telephone!,
          message,
          recipient_name: `${emp.nom} ${emp.prenom}`.trim(),
          sender_domain:  domain,
        });
        r.success ? ok++ : fail++;
      } catch {
        fail++;
      }
      setProgress({ done: i + 1, total: recipientsToSend.length });
    }

    setSending(false);
    await swal.success(`✅ ${ok} envoyé(s)${fail > 0 ? ` — ❌ ${fail} échec(s)` : ""}`);
    if (ok > 0) {
      setMessage("");
      setSelectedEmps(new Set());
      onSent();
    }
  };

  // ── Styles partagés ───────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: "100%", padding: "0.55rem 0.75rem", borderRadius: RADIUS.md,
    border: `1px solid ${theme.border}`, background: theme.inputBg,
    color: theme.textPrimary, fontSize: "0.875rem", fontFamily: FONTS.body,
    outline: "none", boxSizing: "border-box" as const,
  };

  const secTitle: React.CSSProperties = {
    fontSize: "0.68rem", fontWeight: 700, color: theme.textMuted,
    textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.6rem",
  };

  const cardStyle: React.CSSProperties = {
    background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "12px",
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      {/* Variable CSS pour la couleur de bordure */}
      <style>{`:root { --nds-border: ${theme.border}; --nds-hover: ${dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"}; }`}</style>

      <div className="nds-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div
          className="nds-modal"
          style={{
            background:  theme.popupBg,
            border:      `1px solid ${theme.border}`,
            boxShadow:   dark ? "0 32px 80px rgba(0,0,0,0.7)" : "0 24px 60px rgba(0,0,0,0.18)",
            fontFamily:  FONTS.body,
          }}
        >
          {/* ── Header ── */}
          <div style={{
            padding: "0.9rem 1.1rem",
            borderBottom: `1px solid ${theme.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: theme.popupBg, borderRadius: "20px 20px 0 0",
            flexShrink: 0,
          }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontFamily: FONTS.display, fontSize: "1rem", fontWeight: 700, color: theme.textPrimary, marginBottom: 2, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                📢 Note de Service — SMS Groupé
              </h2>
              <p style={{ fontSize: "0.72rem", color: theme.textMuted }}>
                Envoyez une note à tous les employés ou par groupe/rôle
              </p>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.3rem", padding: 4, lineHeight: 1, flexShrink: 0 }}>
              ✕
            </button>
          </div>

          {/* ── Corps principal ── */}
          <div className="nds-body">

            {/* ════════════════ Colonne GAUCHE ════════════════ */}
            <div className="nds-left">

              {/* ── Filtre rôles ── */}
              <div style={{ borderBottom: `1px solid ${theme.border}`, padding: "0.7rem 0.85rem 0.6rem", flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <span style={{ ...secTitle, marginBottom: 0 }}>🏷 Filtrer par rôle</span>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button
                      onClick={selectAllRoles}
                      style={{ fontSize: "0.7rem", padding: "0.2rem 0.55rem", borderRadius: RADIUS.full, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: "pointer", fontFamily: FONTS.body }}
                    >
                      Tous
                    </button>
                    <button
                      onClick={clearRoles}
                      style={{ fontSize: "0.7rem", padding: "0.2rem 0.55rem", borderRadius: RADIUS.full, border: `1px solid ${theme.border}`, background: "transparent", color: theme.textMuted, cursor: "pointer", fontFamily: FONTS.body }}
                    >
                      Aucun
                    </button>
                  </div>
                </div>

                {loadingRoles ? (
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {[80, 110, 90, 100].map(w => (
                      <div key={w} style={{ height: 28, width: w, borderRadius: 999, background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }} />
                    ))}
                  </div>
                ) : (
                  <div className="nds-roles" style={{ padding: 0 }}>
                    {roles.map((role, idx) => {
                      const color   = roleColor(idx);
                      const active  = selectedRoles.has(role.id);
                      const empCount = employees.filter(e => e.role?.id === role.id).length;
                      return (
                        <button
                          key={role.id}
                          className="nds-role-chip"
                          onClick={() => toggleRole(role.id)}
                          style={{
                            background:  active ? `${color}18` : "transparent",
                            borderColor: active ? color : theme.border,
                            color:       active ? color : theme.textMuted,
                          }}
                        >
                          <span style={{
                            width: 7, height: 7, borderRadius: "50%",
                            background: active ? color : theme.border,
                            display: "inline-block", flexShrink: 0,
                          }} />
                          {role.name}
                          <span style={{
                            fontSize: "0.65rem", fontWeight: 700,
                            padding: "0.05rem 0.35rem", borderRadius: 999,
                            background: active ? `${color}28` : (dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"),
                            color: active ? color : theme.textMuted,
                          }}>
                            {empCount}
                          </span>
                        </button>
                      );
                    })}
                    {roles.length === 0 && (
                      <span style={{ fontSize: "0.78rem", color: theme.textMuted }}>Aucun rôle trouvé</span>
                    )}
                  </div>
                )}
              </div>

              {/* ── Barre de recherche employés ── */}
              <div style={{ padding: "0.6rem 0.85rem", borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "0.65rem", top: "50%", transform: "translateY(-50%)", color: theme.textMuted, pointerEvents: "none", fontSize: "0.85rem" }}>
                    🔍
                  </span>
                  <input
                    value={searchEmp}
                    onChange={e => setSearchEmp(e.target.value)}
                    placeholder="Chercher un employé…"
                    style={{ ...inp, paddingLeft: "2rem", fontSize: "0.82rem" }}
                  />
                </div>
              </div>

              {/* ── Barre d'actions sélection ── */}
              <div style={{
                padding: "0.45rem 0.85rem",
                borderBottom: `1px solid ${theme.border}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                flexShrink: 0, flexWrap: "wrap", gap: "0.3rem",
              }}>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  <button
                    onClick={selectAllWithPhone}
                    style={{ fontSize: "0.7rem", padding: "0.22rem 0.6rem", borderRadius: RADIUS.full, border: `1px solid ${PALETTE.primary}55`, background: `rgba(0,175,212,0.07)`, color: PALETTE.primary, cursor: "pointer", fontFamily: FONTS.body, fontWeight: 600 }}
                  >
                    ✓ Tous avec tél.
                  </button>
                  {selectedEmps.size > 0 && (
                    <button
                      onClick={clearEmps}
                      style={{ fontSize: "0.7rem", padding: "0.22rem 0.6rem", borderRadius: RADIUS.full, border: `1px solid rgba(239,68,68,0.3)`, background: "transparent", color: "#ef4444", cursor: "pointer", fontFamily: FONTS.body }}
                    >
                      ✕ Désélectionner
                    </button>
                  )}
                </div>
                <span style={{ fontSize: "0.72rem", color: theme.textMuted, whiteSpace: "nowrap" }}>
                  {loadingEmps ? "Chargement…" : `${filteredEmployees.length} employé(s) • ${selectedEmps.size} sélectionné(s)`}
                </span>
              </div>

              {/* ── Liste des employés ── */}
              <div className="nds-emp-list">
                {loadingEmps ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
                    <div style={{ width: 28, height: 28, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "nds-spin 0.8s linear infinite" }} />
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "1.5rem 1rem", color: theme.textMuted, fontSize: "0.82rem" }}>
                    <div style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>👥</div>
                    {selectedRoles.size > 0 ? "Aucun employé dans ce(s) rôle(s)" : "Aucun employé trouvé"}
                  </div>
                ) : (
                  // Grouper par rôle pour l'affichage
                  (() => {
                    // Construire les groupes
                    const groups = new Map<string, { color: string; items: User[] }>();
                    filteredEmployees.forEach(emp => {
                      const roleName = emp.role?.name ?? "Sans rôle";
                      const roleIdx  = roles.findIndex(r => r.id === emp.role?.id);
                      const color    = roleIdx >= 0 ? roleColor(roleIdx) : "#94a3b8";
                      if (!groups.has(roleName)) groups.set(roleName, { color, items: [] });
                      groups.get(roleName)!.items.push(emp);
                    });

                    return Array.from(groups.entries()).map(([groupName, { color, items }]) => (
                      <div key={groupName} style={{ marginBottom: "0.65rem" }}>
                        {/* En-tête groupe */}
                        <div style={{
                          fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase",
                          letterSpacing: "0.07em", color, padding: "0.3rem 0.5rem",
                          display: "flex", alignItems: "center", gap: "0.4rem",
                        }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block" }} />
                          {groupName}
                          <span style={{ color: theme.textMuted, fontWeight: 400 }}>({items.length})</span>
                        </div>

                        {/* Employés du groupe */}
                        {items.map(emp => {
                          const hasPhone = !!emp.telephone?.trim();
                          const selected = selectedEmps.has(emp.id);
                          return (
                            <div
                              key={emp.id}
                              className={`nds-emp-item ${selected ? "nds-emp-selected" : ""} ${!hasPhone ? "nds-emp-disabled" : ""}`}
                              onClick={() => toggleEmp(emp.id, hasPhone)}
                            >
                              {/* Checkbox */}
                              <div style={{
                                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                                border: `2px solid ${selected ? PALETTE.primary : theme.border}`,
                                background: selected ? PALETTE.primary : "transparent",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "all 0.12s",
                              }}>
                                {selected && <span style={{ color: "#fff", fontSize: "0.65rem", lineHeight: 1, fontWeight: 700 }}>✓</span>}
                              </div>

                              {/* Avatar */}
                              <div style={{
                                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                                background: `${color}22`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "0.72rem", fontWeight: 700, color,
                              }}>
                                {avatarInitials(emp)}
                              </div>

                              {/* Infos */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontSize: "0.82rem", fontWeight: 600, color: theme.textPrimary,
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>
                                  {emp.nom} {emp.prenom}
                                </div>
                                <div style={{ fontSize: "0.7rem", color: hasPhone ? PALETTE.primary : "#ef4444" }}>
                                  {hasPhone ? `📞 ${emp.telephone}` : "⚠ Pas de numéro"}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ));
                  })()
                )}
              </div>

              {/* ── Bouton mobile : "Rédiger le message" ── */}
              <div style={{ padding: "0.65rem", borderTop: `1px solid ${theme.border}`, flexShrink: 0, display: "block" }} className="nds-mobile-footer">
                <style>{`@media(min-width:700px){.nds-mobile-footer{display:none!important;}}`}</style>
                <button
                  onClick={() => setShowMobileMsg(true)}
                  style={{
                    width: "100%", padding: "0.75rem", borderRadius: "12px", border: "none",
                    background: selectedEmps.size === 0 ? theme.border : `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`,
                    color: selectedEmps.size === 0 ? theme.textMuted : "#fff",
                    fontSize: "0.875rem", fontWeight: 700, cursor: selectedEmps.size === 0 ? "not-allowed" : "pointer",
                    fontFamily: FONTS.body,
                  }}
                  disabled={selectedEmps.size === 0}
                >
                  {selectedEmps.size === 0
                    ? "Sélectionnez des employés"
                    : `✏️ Rédiger le message (${selectedEmps.size} dest.)`}
                </button>
              </div>
            </div>

            {/* ════════════════ Colonne DROITE (desktop) ════════════════ */}
            <div className="nds-right" style={{ background: dark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)" }}>
              <style>{`@media(max-width:699px){.nds-right{display:none;}}`}</style>
              <RightPanel
                theme={theme}
                dark={dark}
                domain={domain}
                setDomain={setDomain}
                message={message}
                setMessage={setMessage}
                recipientsToSend={recipientsToSend}
                sending={sending}
                progress={progress}
                onSend={handleSend}
                cardStyle={cardStyle}
                secTitle={secTitle}
                inp={inp}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom-sheet mobile pour le message ── */}
      {showMobileMsg && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 700, display: "flex", alignItems: "flex-end" }}
          onClick={e => e.target === e.currentTarget && setShowMobileMsg(false)}
        >
          <div style={{
            width: "100%", maxHeight: "92vh", overflowY: "auto",
            background: theme.popupBg, border: `1px solid ${theme.border}`,
            borderRadius: "20px 20px 0 0", fontFamily: FONTS.body,
            boxShadow: "0 -8px 40px rgba(0,0,0,0.4)",
            padding: "0",
          }}>
            {/* Poignée */}
            <div style={{ display: "flex", justifyContent: "center", padding: "0.6rem 0" }}>
              <div style={{ width: 40, height: 4, borderRadius: 99, background: theme.border }} />
            </div>

            <div style={{ padding: "0 1rem 1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h3 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: "0.95rem", color: theme.textPrimary }}>
                  ✏️ Rédiger la note de service
                </h3>
                <button onClick={() => setShowMobileMsg(false)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
              </div>

              <RightPanel
                theme={theme}
                dark={dark}
                domain={domain}
                setDomain={setDomain}
                message={message}
                setMessage={setMessage}
                recipientsToSend={recipientsToSend}
                sending={sending}
                progress={progress}
                onSend={async () => { await handleSend(); setShowMobileMsg(false); }}
                cardStyle={cardStyle}
                secTitle={secTitle}
                inp={inp}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Panneau droit (message + envoi) ── réutilisé desktop + mobile bottom-sheet
interface RightPanelProps {
  theme:             LayoutContext["theme"];
  dark:              boolean;
  domain:            SMSDomain;
  setDomain:         (d: SMSDomain) => void;
  message:           string;
  setMessage:        (m: string) => void;
  recipientsToSend:  User[];
  sending:           boolean;
  progress:          { done: number; total: number };
  onSend:            () => Promise<void>;
  cardStyle:         React.CSSProperties;
  secTitle:          React.CSSProperties;
  inp:               React.CSSProperties;
}

function RightPanel({
  theme, dark, domain, setDomain, message, setMessage,
  recipientsToSend, sending, progress, onSend, cardStyle, secTitle, inp,
}: RightPanelProps) {
  const charCount  = message.length;
  const smsCount   = Math.ceil(charCount / 160) || 1;
  const isReady    = recipientsToSend.length > 0 && message.trim().length > 0;

  return (
    <>
      {/* Domaine */}
      <div style={{ ...cardStyle, padding: "0.85rem 1rem" }}>
        <div style={secTitle}>🏢 Domaine d'envoi</div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          {(["NETSYSTEME", "SSE"] as SMSDomain[]).map(d => (
            <button
              key={d}
              onClick={() => setDomain(d)}
              style={{
                flex: 1, padding: "0.65rem 0.5rem", borderRadius: "10px",
                cursor: "pointer", fontFamily: FONTS.body, transition: "all 0.15s",
                border: `2px solid ${domain === d ? (d === "SSE" ? "#10b981" : PALETTE.primary) : theme.border}`,
                background: domain === d ? (d === "SSE" ? "rgba(16,185,129,0.08)" : "rgba(0,175,212,0.08)") : "transparent",
                color: domain === d ? (d === "SSE" ? "#10b981" : PALETTE.primary) : theme.textMuted,
              }}
            >
              <div style={{ fontSize: "1.1rem", marginBottom: "0.15rem" }}>{d === "SSE" ? "⚡" : "🌐"}</div>
              <div style={{ fontWeight: 700, fontSize: "0.8rem" }}>{d}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Résumé destinataires */}
      {recipientsToSend.length > 0 && (
        <div style={{ ...cardStyle, padding: "0.75rem 1rem" }}>
          <div style={secTitle}>👥 Destinataires ({recipientsToSend.length})</div>
          <div className="nds-summary">
            {recipientsToSend.slice(0, 6).map(e => (
              <span key={e.id} style={{
                fontSize: "0.72rem", padding: "0.2rem 0.55rem", borderRadius: 999,
                background: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
                color: theme.textSecondary,
              }}>
                {e.nom} {e.prenom}
              </span>
            ))}
            {recipientsToSend.length > 6 && (
              <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>
                +{recipientsToSend.length - 6} autres
              </span>
            )}
          </div>
        </div>
      )}

      {/* Message */}
      <div style={{ ...cardStyle, padding: "0.85rem 1rem", flex: 1 }}>
        <div style={secTitle}>💬 Message — Note de service</div>
        <textarea
          className="nds-textarea"
          rows={6}
          maxLength={800}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Chers collègues,&#10;&#10;Nous vous informons que…"
          style={{
            ...inp,
            resize: "vertical",
            minHeight: 110,
            lineHeight: 1.55,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.35rem", fontSize: "0.7rem" }}>
          <span style={{ color: charCount > 160 ? "#f59e0b" : theme.textMuted }}>
            {charCount}/160{charCount > 160 ? ` (${smsCount} SMS)` : ""}
          </span>
          <span style={{ color: theme.textMuted }}>{recipientsToSend.length} dest.</span>
        </div>

        {/* Templates rapides */}
        <div style={{ marginTop: "0.65rem" }}>
          <div style={{ fontSize: "0.65rem", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
            Templates
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {[
              { l: "📋 Réunion",       t: "Bonjour à tous,\n\nNous vous convions à une réunion de service. Merci de votre présence." },
              { l: "⚠️ Consigne",       t: "Note de service : Veuillez prendre connaissance des nouvelles consignes de travail en vigueur à compter de ce jour." },
              { l: "🎉 Félicitations", t: "Au nom de la direction, nous félicitons l'ensemble du personnel pour les excellents résultats obtenus ce mois." },
              { l: "📅 Congé",          t: "Rappel : Les demandes de congé doivent être déposées au moins 48h à l'avance auprès du responsable RH." },
            ].map(tp => (
              <button
                key={tp.l}
                onClick={() => setMessage(tp.t)}
                style={{
                  padding: "0.38rem 0.65rem", borderRadius: RADIUS.md,
                  border: `1px solid ${theme.border}`, background: "transparent",
                  color: theme.textSecondary, fontSize: "0.76rem", cursor: "pointer",
                  fontFamily: FONTS.body, textAlign: "left", transition: "background 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {tp.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bouton envoi / Progression */}
      <div style={{ ...cardStyle, padding: "0.85rem 1rem" }}>
        {sending ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 30, height: 30, border: `3px solid ${PALETTE.primary}33`, borderTopColor: PALETTE.primary, borderRadius: "50%", animation: "nds-spin 0.8s linear infinite", margin: "0 auto 0.7rem" }} />
            <div style={{ fontSize: "0.875rem", color: theme.textPrimary, fontWeight: 600, marginBottom: "0.5rem" }}>
              Envoi en cours… {progress.done}/{progress.total}
            </div>
            <div className="nds-progress-bar" style={{ background: theme.border }}>
              <div
                className="nds-progress-fill"
                style={{
                  width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                  background: `linear-gradient(90deg,${PALETTE.primary},${PALETTE.primaryEnd})`,
                }}
              />
            </div>
          </div>
        ) : (
          <>
            <button
              className="nds-send-btn"
              onClick={onSend}
              disabled={!isReady}
              style={{
                background: isReady
                  ? `linear-gradient(135deg,${PALETTE.primary},${PALETTE.primaryEnd})`
                  : theme.border,
                color:  isReady ? "#fff" : theme.textMuted,
                cursor: isReady ? "pointer" : "not-allowed",
                opacity: isReady ? 1 : 0.7,
              }}
            >
              📤 Envoyer via {domain}
              {recipientsToSend.length > 0 && (
                <span style={{
                  background: "rgba(255,255,255,0.22)", borderRadius: 999,
                  padding: "0.1rem 0.5rem", fontSize: "0.78rem", fontWeight: 700,
                }}>
                  {recipientsToSend.length}
                </span>
              )}
            </button>
            <div style={{ textAlign: "center", fontSize: "0.68rem", color: theme.textMuted, marginTop: "0.45rem" }}>
              {isReady
                ? `${recipientsToSend.length} SMS seront envoyés · ~${smsCount} SMS/pers.`
                : "Sélectionnez des employés et rédigez un message"}
            </div>
          </>
        )}
      </div>
    </>
  );
}
