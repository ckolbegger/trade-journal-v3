import { build } from 'vite';
import { resolve } from 'node:path';
import { releaseId } from './release.ts';
await build({ configFile: false, publicDir: false, define: { __RELEASE_ID__: JSON.stringify(releaseId) }, build: { outDir: '.cache/browser-generator', target: 'es2023', lib: { entry: resolve('tools/browser-generator.ts'), formats: ['iife'], name: 'D1Evidence', fileName: () => 'generator.js' } } });
