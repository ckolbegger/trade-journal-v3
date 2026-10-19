import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FORBIDDEN =
  /vi\.mock\s*\(|vi\.fn\s*\(|vi\.stub|jest\.mock\s*\(|mockResolvedValue|mockReturnValue|sinon\.|nock\(|\bmsw\b/;

describe("the D1 integration suite proves the installed foundation end to end through the real stack", () => {
  it("should fail, naming the file and line, when a file under tests/integration/ introduces a mock, stub or canned response for an application dependency", () => {
    const directory = new URL("./", import.meta.url).pathname;
    const files = readdirSync(directory, { recursive: true })
      .map((entry) => String(entry))
      .filter((entry) => entry.endsWith(".ts") && entry !== "mock-guard.test.ts");
    const problems: string[] = [];
    for (const file of files) {
      const lines = readFileSync(join(directory, file), "utf8").split("\n");
      lines.forEach((line, index) => {
        if (FORBIDDEN.test(line)) problems.push(`tests/integration/${file}:${index + 1}`);
      });
    }
    expect(problems).toEqual([]);
  });
});
