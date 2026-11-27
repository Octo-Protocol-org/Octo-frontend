import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Hook tests (`use*.test.ts`) and component tests (`*.test.tsx`) need a DOM; everything else runs in Node.
const DOM_TESTS = ["src/**/*.test.tsx", "src/**/use*.test.ts"];

// Mirror tsconfig's `@/*` path alias so tests resolve the same imports as the app.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  esbuild: { jsx: "automatic" },
  test: {
    setupFiles: ["./src/test/setup.ts"],
    projects: [
      {
        extends: true,
        test: { name: "node", environment: "node", include: ["src/**/*.test.ts"], exclude: DOM_TESTS },
      },
      {
        extends: true,
        test: { name: "dom", environment: "happy-dom", include: DOM_TESTS },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/proxy.ts"],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "src/test/**", "src/lib/**/use*.ts", "src/lib/**/use*.tsx"],
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
