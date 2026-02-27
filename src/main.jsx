import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

/**
 * Recovery bootstrap:
 * - If an old Service Worker / Workbox cache is still controlling the page,
 *   it can cause "mixed chunk" loads on GitHub Pages and trigger
 *   `ReferenceError: Cannot access 'x' before initialization`.
 * - We hard-unregister SW + clear CacheStorage BEFORE importing the app bundle.
 * - Then we load App via dynamic import to guarantee a single coherent module graph.
 *
 * This does NOT rely on App.jsx to run (the error can happen before App is evaluated).
 */
async function hardPurgeIfNeeded() {
  try {
    const u = new URL(window.location.href);
    const already = u.searchParams.get("mri_purge") === "1";
    const hasSW = !!(navigator.serviceWorker && navigator.serviceWorker.controller);

    if (!already && hasSW) {
      // Unregister all SWs
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(regs.map((r) => r.unregister()));

      // Clear all caches
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.allSettled(keys.map((k) => caches.delete(k)));
      }

      // One-shot reload marker (prevents loops)
      u.searchParams.set("mri_purge", "1");
      window.location.replace(u.toString());
      return true; // reloading
    }
  } catch (_) {}
  return false;
}

async function boot() {
  const reloading = await hardPurgeIfNeeded();
  if (reloading) return;

  const mod = await import("./App.jsx");
  const App = mod.default;

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

boot();
