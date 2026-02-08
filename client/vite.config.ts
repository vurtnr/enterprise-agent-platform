import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite"; // 引入新插件

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 8000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          const parts = id.split("node_modules/")[1]?.split("/") ?? [];
          const pkg = parts[0]?.startsWith("@") ? `${parts[0]}/${parts[1] ?? ""}` : parts[0];
          if (!pkg) return;
          if (pkg.startsWith("@univerjs/")) {
            const name = pkg.split("/")[1] || "core";
            return `univer-${name}`;
          }
          if (pkg === "vue-data-ui") return "vue-data-ui";
          if (pkg === "markdown-it") return "markdown-it";
          return "vendor";
        },
      },
    },
  },
});
