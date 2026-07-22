import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**"],
    environment: "node",
  },
});
