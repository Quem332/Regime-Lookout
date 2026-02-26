import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

// PWA: avoid "mixed chunks" by forcing a one-time hard purge when a SW controller exists.
// This runs BEFORE the app module is imported/rendered.
async function maybeHardPurgePWA() {
  try {
    if (typeof window === "undefined") return false;
    const url = new URL(window.location.href);
    const already = url.searchParams.get("mri_clean") === "1";
    if (already) return false;

    const hasController = !!navigator?.serviceWorker?.controller;
    if (!hasController) return false;

    // One-time purge + reload with a marker param (prevents loops)
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => null)));
    }
    if (window.caches && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => null)));
    }

    url.searchParams.set("mri_clean", "1");
    window.location.replace(url.toString());
    return true;
  } catch {
    return false;
  }
}

(async () => {
  const reloading = await maybeHardPurgePWA();
  if (reloading) return;

  // Import App ONLY after PWA state is clean
  const { default: App } = await import("./App.jsx");

  // Register SW after boot (kept in sync)
  try {
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({
      immediate: true,
      onRegistered(r) {
        try {
          if (r) setInterval(() => r.update(), 30 * 60 * 1000);
        } catch {}
      },
      onRegisterError(e) {
        // eslint-disable-next-line no-console
        console.warn("[PWA] registerSW error", e);
      },
    });

    // If a new SW takes control, reload once to ensure coherent assets
    let reloaded = false;
    navigator?.serviceWorker?.addEventListener?.("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  } catch {}

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
})();
