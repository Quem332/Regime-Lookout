import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Regime-Lookout: GitHub Pages project site (repo) deployment.
// IMPORTANT: set base to your repo name path.
export default defineConfig({
  base: "/regime-lookout/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Regime Lookout",
        short_name: "Lookout",
        description: "Risk-adjusted market regime interpretation (MRI).",
        start_url: "/regime-lookout/",
        scope: "/regime-lookout/",
        display: "standalone",
        background_color: "#0b0f19",
        theme_color: "#0b0f19",
        icons: [
          { src: "/regime-lookout/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/regime-lookout/icons/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      },
      workbox: {
        // App shell can be cached, but data must stay fresh.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/regime-lookout/data/") && url.pathname.endsWith(".json"),
            handler: "NetworkFirst",
            options: {
              cacheName: "mri-data",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [200] }
            }
          }
        ]
      }
    })
  ],
});
