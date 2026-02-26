import React from "react";
import MRIMarketDashboard from "./app/MRIMarketDashboard";
import { ErrorBoundary } from "./ui/components/ErrorBoundary";
import { logger } from "./core/logger";

function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;
  if (window.__mriHandlersInstalled) return;
  window.__mriHandlersInstalled = true;

  
  async function __mriCachePurgeAndReload(reason) {
    try {
      if (window.__mriCachePurge) return;
      window.__mriCachePurge = true;
      // avoid infinite reload loops in case it's a real code bug
      const key = "__mri_cache_purge_once__";
      try {
        if (sessionStorage.getItem(key) === "1") return;
        sessionStorage.setItem(key, "1");
      } catch {}

      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => null)));
      }
      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => null)));
      }
    } catch {
      // ignore
    }
    try { window.location.reload(); } catch {}
  }

window.addEventListener("error", (ev) => {
    try {
      logger.error("window.error", { sessionId: logger.session?.id,
        message: ev?.message,
        filename: ev?.filename,
        lineno: ev?.lineno,
        colno: ev?.colno,
        stack: ev?.error?.stack,
      });

    try {
      const msg = String(ev?.message || "");
      // Common symptom of PWA cache/build mixing (or TDZ). Purge SW+caches and reload once.
      if (msg.includes("Cannot access") && msg.includes("before initialization")) {
        __mriCachePurgeAndReload("tdz-mix");
        return;
      }
    } catch {}
    } catch (_) {}
  });

  window.addEventListener("unhandledrejection", (ev) => {
    try {
      const r = ev?.reason;
      logger.error("window.unhandledrejection", { sessionId: logger.session?.id,
        message: r?.message ?? String(r),
        stack: r?.stack,
      });
    } catch (_) {}
  });
}

export default function App() {
  installGlobalErrorHandlers();
  return (
    <ErrorBoundary title="MRI Dashboard crashed">
      <MRIMarketDashboard />
    </ErrorBoundary>
  );
}
