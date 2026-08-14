import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served by Firebase Hosting at the domain root (see firebase.json's
// rewrites, which send every path to index.html for client-side routing),
// so no sub-path base is needed here.
export default defineConfig({
  base: "/",
  plugins: [react()],
  server: {
    port: 5174,
  },
});
