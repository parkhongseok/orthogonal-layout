// vite.config.ts
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  base: "/orthogonal-layout/",
  root: ".",
  server: { port: 5173 },
  build: { outDir: "dist" },
  resolve: {
    alias: {
      "@app": resolve(__dirname, "src/app"),
      "@domain": resolve(__dirname, "src/domain"),
      "@layout": resolve(__dirname, "src/layout"),
      "@render": resolve(__dirname, "src/render"),
      "@ui": resolve(__dirname, "src/ui"),
      "@utils": resolve(__dirname, "src/utils"),
    },
  },
});
