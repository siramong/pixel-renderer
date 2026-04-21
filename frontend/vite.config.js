import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3050",
        changeOrigin: true,
      },
    },
  },
  build: {
  rollupOptions: {
    input: {
      main: "index.html",
      fullscreen: "fullscreen.html",
      mobile: "mobile.html",
    },
  },
}
});