import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

function readDevPort(): number {
  if (process.env.DEV_PORT) {
    return Number(process.env.DEV_PORT);
  }
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    const match = content.match(/^DEV_PORT=(\d+)$/m);
    if (match?.[1]) {
      return Number(match[1]);
    }
  } catch {
    // Fallback to default assigned port.
  }
  return 5181;
}

const port = readDevPort();
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  webServer: {
    command: './node_modules/.bin/vite build && ./node_modules/.bin/vite preview',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 45_000,
  },
});
