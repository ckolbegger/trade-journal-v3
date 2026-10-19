import { defineConfig } from "vitest/config";

const setupFiles = ["./tests/harness/bootstrap.ts"];

export default defineConfig({
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
