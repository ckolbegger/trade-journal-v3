import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { releaseId } from './tools/release.ts';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig(({ mode }) => {
  const port = Number(loadEnv(mode, process.cwd(), 'DEV_').DEV_PORT);
  if (port !== 5174) throw new Error('This worktree requires DEV_PORT=5174');
  const output = process.env.D1_BUILD_DIR ?? 'dist';
  return { build: { outDir: output }, define: { __RELEASE_ID__: JSON.stringify(releaseId) }, plugins: [react(), VitePWA({ strategies: 'injectManifest', srcDir: 'worker', filename: 'sw.ts', injectRegister: false, registerType: 'prompt', manifest: { id: '/', name: 'Trade Journal', short_name: 'Trade Journal', start_url: '/', scope: '/', display: 'standalone', theme_color: '#f6f4ed', background_color: '#f6f4ed', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] }, injectManifest: { globPatterns: ['**/*.{js,css,html,svg,webmanifest,json,png,woff2}'], maximumFileSizeToCacheInBytes: 5242880, manifestTransforms: [(entries) => Promise.resolve({ manifest: entries.map(entry => ({ ...entry, revision: createHash('sha256').update(readFileSync(join(output, entry.url))).digest('hex') })), warnings: [] })] } })], server: { port, strictPort: true, host: 'localhost' }, preview: { port, strictPort: true, host: 'localhost' } };
});
