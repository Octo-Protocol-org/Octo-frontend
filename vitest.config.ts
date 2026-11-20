import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mirror tsconfig's `@/*` path alias so tests resolve the same imports as the app.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/proxy.ts"],
      exclude: ["**/*.test.ts", "src/lib/**/use*.ts", "src/lib/**/use*.tsx"],
      all: true,
      reporter: ["text", "text-summary", "html"],
      thresholds: {
        // Baseline for all non-UI src/lib modules and proxy.ts; raise as coverage grows.
        branches: 50,
        functions: 50,
        lines: 50,
        statements: 50,
        // The SDK keeps its stricter thresholds.
        "src/lib/sdk/**": {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
  },
});
