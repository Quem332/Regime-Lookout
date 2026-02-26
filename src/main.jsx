import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// PWA: ensure Service Worker is registered and kept in sync.
// This prevents "mixed chunks" issues on GitHub Pages when a new deploy lands.
import { registerSW } from "virtual:pwa-register";

const updateSW = registerSW({
  immediate: true,
  onRegistered(r) {
    // Proactively check for updates every 30 minutes while app is open.
    // (AutoUpdate + periodic check reduces stale asset mixes.)
    try {
      if (r) setInterval(() => r.update(), 30 * 60 * 1000);
    } catch {}
  },
  onRegisterError(e) {
    // eslint-disable-next-line no-console
    console.warn("[PWA] registerSW error", e);
  },
});

// If a new SW takes control, reload once to ensure a single coherent asset set.
if (typeof window !== "undefined") {
  let reloaded = false;
  navigator?.serviceWorker?.addEventListener?.("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
