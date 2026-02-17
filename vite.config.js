import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/**
 * GitHub Pages project-site base path:
 *   https://<user>.github.io/<repo>/
 */
const BASE = "/Regime-Lookout/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      // Assets copied from /public into dist/
      includeAssets: [
        "icons/apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-512-maskable.png",
        ".nojekyll",
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

      /**
       * IMPORTANT
       * Workbox `urlPattern` functions are serialized into the service worker.
       * Do NOT reference outer variables (like BASE) here, or you'll get
       * "ReferenceError: BASE is not defined" at runtime.
       */
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.includes("/data/") && url.pathname.endsWith(".json"),
            handler: "NetworkFirst",
            options: {
              cacheName: "mri-json",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
});
