import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// PWA: keep Service Worker in sync to avoid "mixed chunk" loads after deploys.
import { registerSW } from "virtual:pwa-register";

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

// If a new SW takes control, reload once so we run a single coherent asset set.
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
