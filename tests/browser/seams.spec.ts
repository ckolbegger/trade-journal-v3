import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

test.describe("clock", () => {
  const injected = "2026-10-19T13:30:00.000Z";

  test("the shell displays the instant injected by the harness, not wall-clock time", async ({ page }) => {
    await page.addInitScript((instant: string) => {
      (globalThis as unknown as { __TRADE_JOURNAL_CLOCK__?: string }).__TRADE_JOURNAL_CLOCK__ =
        instant;
    }, injected);

    await page.goto("/");

    await expect(page.locator("time").filter({ hasText: injected })).toBeVisible();
    await expect(page.getByText(`Opening instant: ${injected}`)).toBeVisible();
  });
});

test.describe("harness", () => {
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
});

test.describe("host-port", () => {
  test("the host port reads real protection, downloads a file and reads a selected file", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (globalThis as unknown as { __TRADE_JOURNAL_HARNESS__?: boolean }).__TRADE_JOURNAL_HARNESS__ =
        true;
    });
    await page.goto("/");

    const protection = await page.evaluate(async () => {
      const host = window.__TRADE_JOURNAL_HOST__;
      if (host === undefined) throw new Error("the harness did not expose the host port");
      return host.protection();
    });

    // The launch protection state is recorded as readiness evidence, with engine provenance only.
    mkdirSync("artifacts/browser", { recursive: true });
    writeFileSync(
      `artifacts/browser/host-protection-${test.info().project.name}.json`,
      `${JSON.stringify(
        {
          kind: "storage-protection-evidence",
          project: test.info().project.name,
          browserVersion: page.context().browser()?.version() ?? "unknown",
          protection,
        },
        null,
        2,
      )}\n`,
    );
    expect(["Protected", "BestEffort", "Unavailable"]).toContain(protection.kind);

    const downloadStarted = page.waitForEvent("download");
    const downloadOutcome = await page.evaluate(async () => {
      const host = window.__TRADE_JOURNAL_HOST__;
      if (host === undefined) throw new Error("the harness did not expose the host port");
      return host.download("evidence.txt", new TextEncoder().encode("hello"), "text/plain");
    });
    expect(downloadOutcome).toEqual({ kind: "Offered" });
    const download = await downloadStarted;
    expect(download.suggestedFilename()).toBe("evidence.txt");

    // A file chooser needs a user activation, so the harness exposes a button and the click is real.
    await page.evaluate(() => {
      const button = document.createElement("button");
      button.textContent = "read selected file";
      button.addEventListener("click", () => {
        const host = window.__TRADE_JOURNAL_HOST__;
        if (host === undefined) throw new Error("the harness did not expose the host port");
        (window as unknown as { __READ_RESULT__?: unknown }).__READ_RESULT__ =
          host.readSelectedFile();
      });
      document.body.appendChild(button);
    });

    const chooserStarted = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "read selected file" }).click();
    const chooser = await chooserStarted;
    await chooser.setFiles({
      name: "selected.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("trade journal"),
    });

    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { __READ_RESULT__?: unknown }).__READ_RESULT__),
      )
      .toEqual({ kind: "Selected", name: "selected.txt", text: "trade journal" });
  });
});

test.describe("shell", () => {
  test("the shell loads from the loopback origin and depends on no other origin", async ({ page }) => {
    const requested: string[] = [];
    page.on("request", (request) => {
      if (/^https?:\/\//.test(request.url())) requested.push(request.url());
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Trade Journal" })).toBeVisible();

    const origin = new URL(page.url()).origin;
    const origins = new Set(requested.map((url) => new URL(url).origin));

    expect(requested.length).toBeGreaterThan(0);
    expect([...origins]).toEqual([origin]);
  });
});
