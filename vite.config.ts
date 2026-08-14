import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves a project page at https://<user>.github.io/<repo>/,
// not the domain root, so asset URLs need this base path.
export default defineConfig({
  base: "/terences-journal/",
  plugins: [react()],
  server: {
    port: 5173,
  },
});
