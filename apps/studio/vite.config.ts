import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      // Proxy audio fetches so @remotion/media-utils can analyse CORS-restricted files in dev
      "/audio-proxy": {
        target: "https://www.soundhelix.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/audio-proxy/, ""),
      },
      // Forward all /api calls to the Hono backend
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: false,
      },
    },
  },
});
