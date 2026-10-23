import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  server: { port: Number(process.env.PORT ?? 4410), strictPort: true },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  optimizeDeps: { include: ["@hexclave/tanstack-start"] },
  plugins: [tailwindcss(), tanstackStart({ spa: { enabled: true } }), viteReact()],
});
