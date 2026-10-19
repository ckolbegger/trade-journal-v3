import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  IDBFactory as FakeIDBFactory,
  IDBKeyRange as FakeIDBKeyRange,
} from "fake-indexeddb";

export const HARNESS_BOOTSTRAP = "tests/harness/bootstrap.ts";
export const SUBSTITUTIONS = "tests/substitutions.md";

export interface Substitution {
  id: string;
  substitutedComponent: string;
  fidelityGap: string;
  realEngineCounterpart: string;
}

const packageRoot = process.cwd();

function runnerVersion(): string {
  const lock = JSON.parse(readFileSync(join(packageRoot, "package-lock.json"), "utf8")) as {
    packages: Record<string, { version?: string }>;
  };
  return lock.packages["node_modules/vitest"]?.version ?? "unresolved";
}

/**
 * The single disclosed-substitution registry. Every entry must name what is substituted, the
 * fidelity it loses, and the real-engine counterpart that closes the gap.
 */
export function loadSubstitutions(): Substitution[] {
  const text = readFileSync(join(packageRoot, SUBSTITUTIONS), "utf8");
  const rows = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));
  const body = rows.slice(2);
  return body.map((row) => {
    const [id = "", substitutedComponent = "", fidelityGap = "", realEngineCounterpart = ""] = row
      .split("|")
      .map((cell) => cell.trim())
      .slice(1, -1);
    return { id, substitutedComponent, fidelityGap, realEngineCounterpart };
  });
}

// One instance per test file: Vitest isolates files, so this setup module runs once in each.
Object.defineProperty(globalThis, "indexedDB", {
  value: new FakeIDBFactory(),
  configurable: true,
});
Object.defineProperty(globalThis, "IDBKeyRange", {
  value: FakeIDBKeyRange,
  configurable: true,
});

console.log(`harness bootstrap: ${HARNESS_BOOTSTRAP}`);
console.log(`substitution registry: ${SUBSTITUTIONS}`);
console.log(`vitest: ${runnerVersion()} (resolved from package-lock.json)`);
