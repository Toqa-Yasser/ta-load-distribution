import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["app/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["./app/test-setup.ts"],
    css: false,
  },
});
