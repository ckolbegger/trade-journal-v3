import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSubstitutions } from "./bootstrap";

const INTEGRATION_DIR = "tests/integration";

const forbidden = [
  { name: "vi.mock", pattern: /\bvi\.mock\s*\(/ },
  { name: "vi.spyOn", pattern: /\bvi\.spyOn\s*\(/ },
  { name: "vi.stubGlobal", pattern: /\bvi\.stubGlobal\s*\(/ },
  { name: "sinon", pattern: /\bsinon\b/ },
  { name: "a canned response fixture", pattern: /fixtures\/canned-responses/ },
];

export function violationsIn(text: string, file: string): string[] {
  return forbidden.flatMap((rule) => {
    const match = rule.pattern.exec(text);
    if (match === null) return [];
    const line = text.slice(0, match.index).split("\n").length;
    return [`${file}:${line} uses ${rule.name}`];
  });
}

function integrationFiles(directory = INTEGRATION_DIR): string[] {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return integrationFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("the integration suite is mock-free", () => {
  it("should name no mock, spy, sinon or canned response in any file under tests/integration", () => {
      const violations = integrationFiles().flatMap((file) =>
        violationsIn(readFileSync(file, "utf8"), file),
      );

      expect(violations).toEqual([]);
    });

  it("should report the file and line when an integration file introduces a forbidden stub", () => {
      expect(violationsIn('vi.mock("../../src/journal");\n', "tests/integration/sample.test.ts")).toEqual([
        "tests/integration/sample.test.ts:1 uses vi.mock",
      ]);
    });
});

describe("the disclosed-substitution registry carries a complete entry for every substitution", () => {
  it("should give every entry a substituted component, a fidelity gap and a real-engine counterpart", () => {
      const substitutions = loadSubstitutions();
      const problems = substitutions.flatMap((entry) => {
        const missing: string[] = [];
        if (entry.substitutedComponent === "") missing.push("substitutedComponent");
        if (entry.fidelityGap === "") missing.push("gap");
        if (entry.realEngineCounterpart === "") missing.push("realEngineCounterpart");
        return missing.length > 0 ? [`${entry.id}: ${missing.join(", ")}`] : [];
      });

      expect(substitutions.length).toBeGreaterThan(0);
      expect(problems).toEqual([]);
    });
});
