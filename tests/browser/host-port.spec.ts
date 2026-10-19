import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

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
