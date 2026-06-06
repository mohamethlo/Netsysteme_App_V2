// ─────────────────────────────────────────────────────────────────────────────
//  src/services/pdfService.ts
//
//  Inspiré du pattern Flask : le backend retourne Content-Disposition: inline
//  → le navigateur affiche le PDF directement (viewer natif ou plugin Acrobat).
//
//  Problème JWT : window.open(url) n'envoie pas le Bearer token.
//  Solution     : endpoint /pdf-token/ qui génère un token signé 1 h,
//                 puis on ouvre /pdf/?token=xxx → aucun header requis.
// ─────────────────────────────────────────────────────────────────────────────
import api from "./api";

type DocType = "invoices" | "proformas";

/** Récupère une URL PDF valide 1 h (token signé côté Django). */
async function _getPdfUrl(type: DocType, id: number): Promise<string> {
  const r     = await api.get<{ token: string }>(`/billing/${type}/${id}/pdf-token/`);
  const base  = (api.defaults.baseURL ?? "").replace(/\/$/, "");
  return `${base}/billing/${type}/${id}/pdf/?token=${r.data.token}`;
}

/** Télécharge le PDF (blob) avec le bon nom de fichier. */
async function _downloadPdf(type: DocType, id: number, filename: string): Promise<void> {
  const r      = await api.get(`/billing/${type}/${id}/pdf/`, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(r.data as Blob);
  const a       = document.createElement("a");
  a.href          = blobUrl;
  a.download      = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 15_000);
}

// ── Fonctions internes ────────────────────────────────────────────────────────

/**
 * Ouvre le PDF dans un nouvel onglet via URL directe (desktop et mobile).
 * L'onglet vide est ouvert SYNCHRONE (avant tout await) → pas de popup blocker.
 * Fallback téléchargement si le popup est bloqué.
 */
async function viewPdf(type: DocType, id: number, filename: string): Promise<void> {
  const tab = window.open("", "_blank");
  try {
    const url = await _getPdfUrl(type, id);
    if (tab) {
      tab.location.href = url;
    } else {
      await _downloadPdf(type, id, filename);
    }
  } catch {
    tab?.close();
  }
}

/**
 * Ouvre le PDF dans un onglet pré-ouvert depuis le formulaire de création
 * (ouvert synchrone avant les appels API → pas de popup blocker).
 * Fonctionne sur desktop et mobile.
 */
async function viewPdfInTab(
  tab: Window,
  type: DocType,
  id: number,
  filename: string,
): Promise<void> {
  try {
    const url = await _getPdfUrl(type, id);
    tab.location.href = url;
  } catch {
    tab.close();
    await _downloadPdf(type, id, filename);
  }
}

// ── Contrat (installations) ───────────────────────────────────────────────────

async function _getContractUrl(id: number): Promise<string> {
  const r    = await api.get<{ token: string }>(`/installations/${id}/contract-pdf-token/`);
  const base = (api.defaults.baseURL ?? "").replace(/\/$/, "");
  return `${base}/installations/${id}/contract-pdf/?token=${r.data.token}`;
}

async function _downloadContract(id: number, filename: string): Promise<void> {
  const r      = await api.get(`/installations/${id}/contract-pdf/`, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(r.data as Blob);
  const a       = document.createElement("a");
  a.href          = blobUrl;
  a.download      = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 15_000);
}

async function viewContract(id: number, filename: string): Promise<void> {
  const tab = window.open("", "_blank");
  try {
    const url = await _getContractUrl(id);
    if (tab) {
      tab.location.href = url;
    } else {
      await _downloadContract(id, filename);
    }
  } catch {
    tab?.close();
  }
}

async function viewContractInTab(tab: Window, id: number, filename: string): Promise<void> {
  try {
    const url = await _getContractUrl(id);
    tab.location.href = url;
  } catch {
    tab.close();
    await _downloadContract(id, filename);
  }
}

// ── Helpers nommage ───────────────────────────────────────────────────────────

/** Sanitise une chaîne pour qu'elle soit un nom de fichier valide. */
function _sanitize(s: string): string {
  return s.replace(/[/\\:*?"<>|]/g, "-").trim();
}

function _invoiceFilename(id: number, docNumber?: string | null, clientName?: string | null): string {
  const num    = docNumber  ? _sanitize(docNumber)  : null;
  const client = clientName ? _sanitize(clientName) : null;
  if (num && client) return `Facture_${num}_${client}.pdf`;
  if (num)           return `Facture_${num}.pdf`;
  if (client)        return `Facture de ${client}.pdf`;
  return `Facture_${id}.pdf`;
}

function _proformaFilename(id: number, docNumber?: string | null, clientName?: string | null): string {
  const num    = docNumber  ? _sanitize(docNumber)  : null;
  const client = clientName ? _sanitize(clientName) : null;
  if (num && client) return `Proforma_${num}_${client}.pdf`;
  if (num)           return `Proforma_${num}.pdf`;
  if (client)        return `Proforma de ${client}.pdf`;
  return `Proforma_${id}.pdf`;
}

function _contractFilename(id: number, clientName?: string | null): string {
  const client = clientName ? _sanitize(clientName) : null;
  return client ? `Contrat_${client}.pdf` : `Contrat_${id}.pdf`;
}

// ── Export ────────────────────────────────────────────────────────────────────

export const pdfService = {
  invoice: {
    view:      (id: number, clientName?: string | null, docNumber?: string | null) =>
      viewPdf("invoices", id, _invoiceFilename(id, docNumber, clientName)),
    download:  (id: number, clientName?: string | null, docNumber?: string | null) =>
      _downloadPdf("invoices", id, _invoiceFilename(id, docNumber, clientName)),
    viewInTab: (tab: Window, id: number, clientName?: string | null, docNumber?: string | null) =>
      viewPdfInTab(tab, "invoices", id, _invoiceFilename(id, docNumber, clientName)),
  },
  proforma: {
    view:      (id: number, clientName?: string | null, docNumber?: string | null) =>
      viewPdf("proformas", id, _proformaFilename(id, docNumber, clientName)),
    download:  (id: number, clientName?: string | null, docNumber?: string | null) =>
      _downloadPdf("proformas", id, _proformaFilename(id, docNumber, clientName)),
    viewInTab: (tab: Window, id: number, clientName?: string | null, docNumber?: string | null) =>
      viewPdfInTab(tab, "proformas", id, _proformaFilename(id, docNumber, clientName)),
  },
  contract: {
    view:      (id: number, clientName?: string | null) =>
      viewContract(id, _contractFilename(id, clientName)),
    download:  (id: number, clientName?: string | null) =>
      _downloadContract(id, _contractFilename(id, clientName)),
    viewInTab: (tab: Window, id: number, clientName?: string | null) =>
      viewContractInTab(tab, id, _contractFilename(id, clientName)),
  },
};
