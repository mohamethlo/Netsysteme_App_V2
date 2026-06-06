// ─────────────────────────────────────────────────────────────────────────────
//  src/hooks/useSwal.ts
// ─────────────────────────────────────────────────────────────────────────────
import Swal, { type SweetAlertResult } from "sweetalert2";

const isDark = () => document.documentElement.dataset.theme !== "light";

const Base = () =>
  Swal.mixin({
    background: isDark() ? "#111827" : "#ffffff",
    color:      isDark() ? "rgba(255,255,255,0.88)" : "#1e293b",
    customClass: {
      popup:         "ns-swal-popup",
      title:         "ns-swal-title",
      htmlContainer: "ns-swal-html",
      confirmButton: "ns-swal-confirm",
      cancelButton:  "ns-swal-cancel",
      denyButton:    "ns-swal-deny",
    },
    buttonsStyling: false,
    showClass: { popup: "ns-swal-show" },
    hideClass: { popup: "ns-swal-hide" },
  });

const Toast = () =>
  Swal.mixin({
    toast: true,
    position: "bottom-end",
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
    background: isDark() ? "#111827" : "#ffffff",
    color:      isDark() ? "rgba(255,255,255,0.88)" : "#1e293b",
    customClass: { popup: "ns-toast" },
  });

export function useSwal() {
  // Toasts
  const success = (title: string, text?: string) => Toast().fire({ icon: "success", title, text });
  const error   = (title: string, text?: string) => Toast().fire({ icon: "error",   title, text });
  const warning = (title: string, text?: string) => Toast().fire({ icon: "warning", title, text });
  const info    = (title: string, text?: string) => Toast().fire({ icon: "info",    title, text });

  // Confirm générique
  const confirm = async (opts: {
    title: string; text?: string;
    confirmText?: string; cancelText?: string;
    danger?: boolean; icon?: "warning" | "question" | "info";
  }): Promise<boolean> => {
    const r: SweetAlertResult = await Base().fire({
      title: opts.title, text: opts.text,
      icon:  opts.icon ?? (opts.danger ? "warning" : "question"),
      showCancelButton:  true,
      confirmButtonText: opts.confirmText ?? "Confirmer",
      cancelButtonText:  opts.cancelText  ?? "Annuler",
      reverseButtons: true, focusCancel: true,
    });
    return r.isConfirmed;
  };

  // Confirm suppression
  const confirmDelete = (name?: string) =>
    confirm({ title: `Supprimer ${name ? `"${name}"` : "cet élément"} ?`, text: "Cette action est irréversible.", confirmText: "Oui, supprimer", danger: true, icon: "warning" });

  // Confirm déconnexion
  const confirmLogout = () =>
    confirm({ title: "Se déconnecter ?", text: "Vous serez redirigé vers la page de connexion.", confirmText: "Déconnecter", cancelText: "Rester connecté", icon: "question" });

  // Alert simple
  const alert = (title: string, text?: string, icon: "success"|"error"|"info"|"warning" = "info") =>
    Base().fire({ title, text, icon, confirmButtonText: "OK" });

  // Loading spinner (retourne close())
  const loading = (title = "Chargement…") => {
    Base().fire({ title, allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
    return () => Swal.close();
  };

  // Prompt saisie texte
  const prompt = async (opts: { title: string; placeholder?: string; inputLabel?: string; confirmText?: string; validator?: (v: string) => string | null }): Promise<string | null> => {
    const r = await Base().fire({ title: opts.title, input: "text", inputLabel: opts.inputLabel, inputPlaceholder: opts.placeholder ?? "", showCancelButton: true, confirmButtonText: opts.confirmText ?? "Valider", cancelButtonText: "Annuler", inputValidator: (v) => (!v ? "Ce champ est requis." : (opts.validator?.(v) ?? null)) });
    return r.isConfirmed ? (r.value as string) : null;
  };

  // Confirm + motif (textarea)
  const confirmWithReason = async (opts: { title: string; placeholder?: string; confirmText?: string }): Promise<string | null> => {
    const r = await Base().fire({ title: opts.title, input: "textarea", inputPlaceholder: opts.placeholder ?? "Saisissez un motif…", showCancelButton: true, confirmButtonText: opts.confirmText ?? "Valider", cancelButtonText: "Annuler", inputValidator: (v) => (!v ? "Le motif est requis." : null) });
    return r.isConfirmed ? (r.value as string) : null;
  };

  // Raccourcis CRUD
  const saved       = (e = "L'enregistrement") => success(`${e} enregistré avec succès`);
  const deleted     = (e = "L'élément")        => success(`${e} supprimé avec succès`);
  const updated     = (e = "L'enregistrement") => success(`${e} mis à jour avec succès`);
  const serverError = (d?: string)             => error("Erreur serveur", d ?? "Une erreur est survenue.");
  const networkError = ()                      => error("Connexion impossible", "Vérifiez votre connexion.");
  const forbidden    = ()                      => error("Accès refusé", "Permissions insuffisantes.");

  return { success, error, warning, info, confirm, confirmDelete, confirmLogout, alert, loading, prompt, confirmWithReason, saved, deleted, updated, serverError, networkError, forbidden, Swal };
}