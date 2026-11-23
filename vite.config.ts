import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { releaseInventoryPlugin } from './vite-plugins/release-inventory.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.DEV_PORT || process.env.DEV_PORT || 5181);

  return {
    plugins: [react(), releaseInventoryPlugin()],
    server: {
      port,
      strictPort: true,
    },
    preview: {
      port,
      strictPort: true,
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(import.meta.dirname, 'index.html'),
          sw: resolve(import.meta.dirname, 'src/sw/service-worker.ts'),
        },
        output: {
          entryFileNames: (chunkInfo) => (chunkInfo.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
        },
      },
    },
  };
});
