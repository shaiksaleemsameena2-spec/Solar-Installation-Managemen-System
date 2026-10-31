import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // For GitHub Pages sub-path hosting set VITE_BASE_PATH=<repo-name>.
  // Root deployments (Netlify/Vercel/local) need no change.
  base: process.env.VITE_BASE_PATH || "/",
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
