import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { tradeJournalPwaPlugin } from './src/pwa/vite-pwa-plugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.DEV_PORT || process.env.DEV_PORT || 5180);

  return {
    plugins: [react(), tailwindcss(), tradeJournalPwaPlugin()],
    server: {
      port,
      strictPort: true,
      host: '127.0.0.1',
    },
    preview: {
      port,
      strictPort: true,
      host: '127.0.0.1',
    },
  };
});
