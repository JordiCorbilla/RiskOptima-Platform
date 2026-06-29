import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5177,
    proxy: {
      "/api": process.env.VITE_PROXY_TARGET ?? "http://localhost:5176"
    }
  },
  preview: {
    port: 4177
  }
});
