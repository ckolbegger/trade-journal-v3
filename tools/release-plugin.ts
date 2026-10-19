import path from 'node:path';
import { build, type Plugin } from 'vite';
import { finalizeRelease, SERVICE_WORKER_FILE } from './release.ts';

// After the app is written, bundles the service worker as one classic script (sw.js) and then
// finalizes the Offline Release Inventory and release identity over the whole output folder.
export function releasePlugin(): Plugin {
  let outDir = '';
  let root = '';
  return {
    name: 'tj-release',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await build({
        configFile: false,
        root,
        logLevel: 'warn',
        build: {
          outDir,
          emptyOutDir: false,
          copyPublicDir: false,
          lib: {
            entry: path.join(root, 'src/sw/main.ts'),
            formats: ['iife'],
            name: 'tjServiceWorker',
            fileName: () => SERVICE_WORKER_FILE,
          },
        },
      });
      await finalizeRelease(outDir);
    },
  };
}
