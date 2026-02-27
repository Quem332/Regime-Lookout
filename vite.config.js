import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/Regime-Lookout/",
  plugins: [
    react(),
    // PWA temporarily disabled for recovery from SW/cache mixed-chunk issues.
    // Re-enable after confirming stable (then add explicit registerSW handling).
  ],
});
