import path from 'node:path';
import { build, type Plugin } from 'vite';
import { finalizeRelease, SERVICE_WORKER_FILE } from './release.ts';

// After the app is written, bundles the service worker as one classic script (sw.js) and then
// finalizes the Offline Release Inventory and release identity over the whole output folder.
// A build label (test harness only, T1.26) marks index.html so otherwise identical builds get
// distinct release identities; production builds carry none.
export function releasePlugin(buildLabel = process.env.TJ_BUILD_LABEL): Plugin {
  let outDir = '';
  let root = '';
  return {
    name: 'tj-release',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
    },
    transformIndexHtml() {
      return buildLabel ? [{ tag: 'meta', attrs: { name: 'tj-build-label', content: buildLabel }, injectTo: 'head' }] : [];
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
