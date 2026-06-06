// src/pages/assignments/AssignmentsPage.tsx
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { type LayoutContext } from "../../layouts/MainLayout";
import { FONTS} from "../../theme";
import AssignPanel  from "./components/AssignPanel";
import ReportPanel  from "./components/ReportPanel";

const TABS = [
  { key: "assign", label: "📍 Affecter les techniciens" },
  { key: "report", label: "📊 Rapport quotidien" },
];

export default function AssignmentsPage() {
  const { theme, dark } = useOutletContext<LayoutContext>();
  const [tab, setTab]   = useState<"assign" | "report">("assign");

  return (
    <div style={{ fontFamily: FONTS.body }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", borderRadius: "16px", padding: "1.75rem 2rem", marginBottom: "1.5rem", color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: "-1.5rem", top: "-1.5rem", fontSize: "9rem", opacity: 0.07, pointerEvents: "none" }}>🗺️</div>
        <h1 style={{ fontFamily: FONTS.display, fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>
          Affectation des Techniciens
        </h1>
        <p style={{ fontSize: "0.875rem", opacity: 0.8, margin: 0 }}>
          Gérez les affectations de zones de travail et visualisez la présence quotidienne
        </p>
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.25rem", borderBottom: `1px solid ${theme.border}`, overflowX: "auto", flexWrap: "nowrap", scrollbarWidth: "none" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{ padding: "0.65rem 1rem", border: "none", background: "transparent", color: tab === t.key ? "#3b82f6" : theme.textMuted, fontWeight: tab === t.key ? 700 : 400, fontSize: "0.875rem", cursor: "pointer", fontFamily: FONTS.body, borderBottom: `2px solid ${tab === t.key ? "#3b82f6" : "transparent"}`, transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "assign" && <AssignPanel dark={dark} theme={theme} />}
      {tab === "report" && <ReportPanel dark={dark} theme={theme} />}
    </div>
  );
}