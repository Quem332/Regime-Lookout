import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

// PWA: avoid "mixed chunks" after deploy by forcing update + reload when a new SW takes control.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Activate new SW and reload to ensure index/assets are from the same build.
      try { updateSW(true); } catch {}
      try { window.location.reload(); } catch {}
    },
  });

  // When a new SW becomes controller, reload once.
  try {
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  } catch {}
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);