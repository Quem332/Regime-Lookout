
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const BASE = "/Regime-Lookout/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "icons/apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
	"icons/icon-512-maskable.png",
      ],
      manifest: {
        name: "Regime-Lookout",
        short_name: "Lookout",
        description: "Mobile-first MRI-based market regime interpretation engine with risk-adjusted confidence.",
        start_url: BASE,
        scope: BASE,
        display: "standalone",
        background_color: "#0b0f14",
        theme_color: "#0b0f14",
        icons: [
          {
            src: BASE + "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: BASE + "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith(BASE + "data/") &&
              url.pathname.endsWith(".json"),
            handler: "NetworkFirst"
          }
        ]
      }
    })
  ]
});
