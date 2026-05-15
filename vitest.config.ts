import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    environment: "node",
    coverage: {
      reporter: ["text", "json-summary"],
      include: ["lib/**/*.ts"],
      exclude: [
        "lib/**/*.d.ts",
        // Skip server-only routes — covered by integration tests.
        "lib/db/**",
        "lib/sse/**",
        "lib/auth/index.ts",
        "lib/auth/login-events.ts",
        "lib/audit/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Next.js's "server-only" guard module — replace with a no-op for tests.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
