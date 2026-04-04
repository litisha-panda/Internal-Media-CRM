/**
 * Local-development Vite config.
 * Usage: pnpm run dev:local   (from this package)
 *   OR:  ./dev.sh             (from the repo root)
 *
 * Key differences from vite.config.ts (Replit):
 *  - No PORT / BASE_PATH env-var requirement
 *  - Removes Replit-only plugins (cartographer, dev-banner)
 *  - Adds /api proxy → http://localhost:3000 so relative fetch("/api/...")
 *    calls work without CORS issues during frontend dev
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import path from "path";

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: "localhost",
    // Proxy all /api/* requests to the Express API server.
    // This avoids CORS issues and mirrors how the app works in production
    // (where the same host serves both the frontend and /api routes).
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
