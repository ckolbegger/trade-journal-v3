// Builds a second release into artifacts/sw-test/release-<variant> so the service-worker update
// proofs can deploy a different content-derived release to the same origin.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const variant = process.argv[2] ?? "b";
mkdirSync("artifacts/sw-test", { recursive: true });
const outDir = `artifacts/sw-test/release-${variant}`;
execFileSync("npx", ["vite", "build", "--outDir", outDir, "--emptyOutDir"], {
  stdio: "inherit",
  env: { ...process.env, BUILD_VARIANT: variant },
});
process.stdout.write(`built ${outDir}\n`);
