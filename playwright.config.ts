import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

function readDevPort(): number {
  const file = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
  const found = /^DEV_PORT=(\d+)$/m.exec(file);
  if (found?.[1] === undefined) throw new Error(".env.local declares no numeric port");
  return Number(found[1]);
}

const port = readDevPort();
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: origin,
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "narrow",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
    },
    {
      name: "wide",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `npm run build && node scripts/sw-test-server.mjs`,
    url: origin,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
