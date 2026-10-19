import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { missingFromCache, startHarness, waitForControl } from "./worker-support";

interface ReadinessResult {
  outcome: string;
  checks: { check: string; outcome: string; detail: string }[];
  failedChecks: unknown[];
  protection: { kind: string };
  notProtectedWarning: boolean;
  intendedReleaseId?: string;
}

test("the four-check gate reaches Writable on a real engine and records engine versions as provenance only", async ({
  page,
}) => {
  await startHarness(page);
  await waitForControl(page);
  await expect.poll(() => missingFromCache(page), { timeout: 20_000 }).toBe(0);

  const result = (await page.evaluate(async () => {
    const bridge = window.__TRADE_JOURNAL_READINESS__;
    if (bridge === undefined) throw new Error("the harness did not expose readiness");
    return bridge.evaluate();
  })) as ReadinessResult;

  expect(result.outcome).toBe("Writable");
  expect(result.checks.map((check) => check.check)).toEqual([
    "diagnostic-transaction",
    "capacity",
    "service-worker-control",
    "offline-release-inventory",
  ]);
  expect(result.checks.every((check) => check.outcome === "Passed")).toBe(true);
  expect(result.failedChecks).toEqual([]);
  expect(["Protected", "BestEffort", "Unavailable"]).toContain(result.protection.kind);
  expect(Object.keys(result)).not.toContain("browserVersion");
  expect(Object.keys(result)).not.toContain("userAgent");

  mkdirSync("artifacts/browser", { recursive: true });
  writeFileSync(
    `artifacts/browser/readiness-${test.info().project.name}.json`,
    `${JSON.stringify(
      {
        kind: "readiness-provenance",
        decisionInput: false,
        project: test.info().project.name,
        browserVersion: page.context().browser()?.version() ?? "unknown",
        checks: result.checks,
        protection: result.protection,
        notProtectedWarning: result.notProtectedWarning,
      },
      null,
      2,
    )}\n`,
  );
});
