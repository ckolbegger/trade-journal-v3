import { defineConfig } from "vitest/config";

const setupFiles = ["./tests/harness/bootstrap.ts"];

export default defineConfig({
  define: { __BUILD_VARIANT__: JSON.stringify("test") },
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/**/*.test.{ts,tsx}"],
          exclude: ["tests/integration/**", "tests/browser/**"],
          setupFiles,
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles,
          passWithNoTests: true,
        },
      },
    ],
  },
});
