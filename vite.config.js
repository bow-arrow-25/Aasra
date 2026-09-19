import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("./public/manifest.json", import.meta.url), "utf8")
);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      includeAssets: [
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
      ],
      manifest,
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/icons\//],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
});
