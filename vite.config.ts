import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    // Pre-bundle every client dependency up front. Otherwise Vite discovers
    // them lazily on first visit to each page and forces a full page reload
    // ("optimized dependencies changed. reloading"), which looks like a broken
    // SPA navigation in dev. Production builds are unaffected.
    include: ["react", "react-dom", "react-router", "motion/react", "@dnd-kit/core", "@dnd-kit/utilities", "date-fns", "nanoid"],
    // Server-only; the dep scanner still sees it through *.server.ts imports.
    exclude: ["@supabase/supabase-js"],
  },
});
