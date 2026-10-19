import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { writeReleaseInventory } from "./scripts/release-inventory.mjs";

function releaseArtifacts(): Plugin {
  return {
    name: "trade-journal-release-artifacts",
    apply: "build",
    closeBundle() {
      const inventory = writeReleaseInventory("dist");
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
    server: { host: "127.0.0.1", port, strictPort: true },
    preview: { host: "127.0.0.1", port, strictPort: true },
  };
});
