import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const BASE = "/Regime-Lookout/";

export default defineConfig({
  base: "/Regime-Lookout/",

  // ✅ GitHub Pages (Deploy from branch)에서 /docs 선택 가능하게
  build: {
    outDir: "docs",
    emptyOutDir: true,
  },

  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      // ✅ public/ 안에 있는 정적 파일들
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

        // ✅ repo 하위 Pages에서 안정적으로 동작
        start_url: BASE,
        scope: BASE,

        display: "standalone",
        background_color: "#0b0f14",
        theme_color: "#0b0f14",

        icons: [
          {
            src: BASE + "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: BASE + "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          // ✅ Android 홈화면에서 “마스커블” 지원(잘림 방지)
          {
            src: BASE + "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        runtimeCaching: [
          // ✅ data/*.json 은 캐시 고착 방지: NetworkFirst
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith(BASE + "data/") &&
              url.pathname.endsWith(".json"),
            handler: "NetworkFirst",
            options: {
              cacheName: "data-json",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
});
