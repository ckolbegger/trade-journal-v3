import react from '@vitejs/plugin-react';
import { releasePlugin } from './tools/release-plugin.ts';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const port = Number(loadEnv(mode, process.cwd(), '').DEV_PORT);
  if (!Number.isInteger(port)) {
    throw new Error('DEV_PORT must be set in .env.local');
  }
  return {
    plugins: [react(), releasePlugin()],
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.ts'],
      setupFiles: ['tests/setup/idb-globals.ts'],
    },
  };
});
