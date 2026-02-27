import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const BASE = "/Regime-Lookout/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      // IMPORTANT: self-destroying SW rollout to recover from "mixed chunks" / stale cache state.
      // This build will register a SW that immediately unregisters itself and clears caches,
      // then forces a reload, leaving the site in a clean (non-stale) state.
      // After confirming the site is clean, you can remove `selfDestroying: true` and keep autoUpdate normally.
      registerType: "autoUpdate",
      injectRegister: "auto",
      selfDestroying: true,

      devOptions: { enabled: false }, // disable SW in dev for stability
      includeAssets: [
        "icons/apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-512-maskable.png",
      ],
      manifest: {
        name: "Regime-Lookout",
        short_name: "Lookout",
        description:
          "Mobile-first MRI-based market regime interpretation engine with risk-adjusted confidence.",
        start_url: BASE,
        scope: BASE,
        display: "standalone",
        background_color: "#0b0f14",
        theme_color: "#0b0f14",
        icons: [
          { src: BASE + "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: BASE + "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: BASE + "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Keep this as RegExp (NOT a function closure) for SW safety.
            urlPattern: new RegExp("^/Regime\-Lookout/data/.*\\.json$"),
            handler: "NetworkFirst",
            options: {
              cacheName: "mri-json",
              networkTimeoutSeconds: 8,
            },
          },
        ],
      },
    }),
  ],
});
