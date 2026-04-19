import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://swissbakery.com.au",
  output: "static",
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        "/api": "http://localhost:3000",
        "/uploads": "http://localhost:3000",
      },
    },
  },
  build: {
    inlineStylesheets: "auto",
  },
});
