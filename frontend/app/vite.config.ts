import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: [".trycloudflare.com", "127.0.0.1", "localhost"],
    proxy: {
      "/api": process.env.VITE_PROXY_TARGET ?? "http://127.0.0.1:8000",
      "/calendar-api": {
        target: process.env.VITE_CALENDAR_PROXY_TARGET ?? "http://127.0.0.1:5176",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/calendar-api/, "/api")
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts"
  }
});
