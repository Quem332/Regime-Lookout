import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/Regime-Lookout/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
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
        start_url: "/Regime-Lookout/",
        scope: "/Regime-Lookout/",
        display: "standalone",
        background_color: "#0b0f14",
        theme_color: "#0b0f14",
        icons: [
          { src: "/Regime-Lookout/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/Regime-Lookout/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/Regime-Lookout/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/Regime-Lookout\/data\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/Regime-Lookout/data/") && url.pathname.endsWith(".json"),
            handler: "NetworkFirst",
            options: {
              cacheName: "mri-json",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 6 }, // 6h
            },
          },
        ],
      },
    }),
  ],
});
