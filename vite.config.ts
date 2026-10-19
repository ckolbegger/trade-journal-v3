import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

export function releaseIdOf(distDir: string): string {
  const files = listFiles(distDir).sort();
  const release = createHash("sha256");
  for (const file of files) {
    release.update(relative(distDir, file).split("\\").join("/"));
    release.update("\0");
    release.update(createHash("sha256").update(readFileSync(file)).digest("hex"));
    release.update("\0");
  }
  return release.digest("hex");
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function releaseIdentity(): Plugin {
  return {
    name: "trade-journal-release-identity",
    apply: "build",
    closeBundle() {
      process.stdout.write(`release-id: ${releaseIdOf("dist")}\n`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.DEV_PORT ?? 5177);
  return {
    plugins: [react(), releaseIdentity()],
    server: { host: "127.0.0.1", port, strictPort: true },
    preview: { host: "127.0.0.1", port, strictPort: true },
  };
});
