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
      // (선택) 빌드 시 registerSW.js 자동 주입 안 쓰고, 지금처럼 main.jsx에서 registerSW import하는 구조면 생략 가능
      // injectRegister: "auto",

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
        // ★ 이게 중요: 예전 캐시 정리 + 새 SW 즉시 적용
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,

        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith(BASE + "data/") && url.pathname.endsWith(".json"),
            handler: "NetworkFirst",
            options: {
              cacheName: "mri-data",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
});
