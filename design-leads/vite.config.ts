import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// This app is published alongside Terence's Journal under one GitHub Pages
// site, at https://<user>.github.io/terences-journal/design-leads/ -- see
// ../.github/workflows/deploy.yml, which builds this app separately and
// copies its output into dist/design-leads/ before publishing.
export default defineConfig({
  base: "/terences-journal/design-leads/",
  plugins: [react()],
  server: {
    port: 5174,
  },
});
