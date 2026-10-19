import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

function sourceFiles(directory = "src"): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

test("the browser harness records engine provenance without any identity-based decision input", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Trade Journal" })).toBeVisible();

  const record = {
    kind: "provenance",
    decisionInput: false,
    project: test.info().project.name,
    engine: browserName,
    browserVersion: page.context().browser()?.version() ?? "unknown",
  };
  mkdirSync("artifacts/browser", { recursive: true });
  writeFileSync(
    `artifacts/browser/provenance-${record.project}.json`,
    `${JSON.stringify(record, null, 2)}\n`,
  );

  // Support is decided by functional checks, so no application source may read an identity.
  const identityReads = sourceFiles().filter((file) =>
    /\buserAgent\b|\buserAgentData\b|\bnavigator\.platform\b/.test(readFileSync(file, "utf8")),
  );

  expect(identityReads).toEqual([]);
});
