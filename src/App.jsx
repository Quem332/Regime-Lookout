import React from "react";
import MRIMarketDashboard from "./app/MRIMarketDashboard";
import { ErrorBoundary } from "./ui/components/ErrorBoundary";
import { InstallBanner } from "./ui/components/InstallBanner";
import { logger } from "./core/logger";

function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;
  if (window.__mriHandlersInstalled) return;
  window.__mriHandlersInstalled = true;

  window.addEventListener("error", (ev) => {
    try {
      logger.error("window.error", { sessionId: logger.session?.id,
        message: ev?.message,
        filename: ev?.filename,
        lineno: ev?.lineno,
        colno: ev?.colno,
        stack: ev?.error?.stack,
      });
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
      <InstallBanner />
      <MRIMarketDashboard />
    </ErrorBoundary>
  );
}