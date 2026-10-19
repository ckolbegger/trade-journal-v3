import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { writeReleaseInventory } from "./scripts/release-inventory.mjs";
import { buildServiceWorker } from "./scripts/build-sw.mjs";

function releaseArtifacts(): Plugin {
  let outDir = "dist";
  return {
    name: "trade-journal-release-artifacts",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const inventory = writeReleaseInventory(outDir);
      buildServiceWorker(outDir, inventory);
      process.stdout.write(`release-id: ${inventory.releaseId}\n`);
      process.stdout.write(`inventory-list-digest: ${inventory.listDigest}\n`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.DEV_PORT ?? 5177);
  return {
    plugins: [react(), releaseArtifacts()],
    define: {
      __BUILD_VARIANT__: JSON.stringify(process.env.BUILD_VARIANT ?? "default"),
    },
    server: { host: "127.0.0.1", port, strictPort: true },
    preview: { host: "127.0.0.1", port, strictPort: true },
  };
});
