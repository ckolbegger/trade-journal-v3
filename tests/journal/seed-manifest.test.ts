import { describe, expect, it } from "vitest";
import { SEED_MANIFEST_V1, seedDefaults } from "../../src/journal";
import { closeJournal, journalRows, openJournal } from "./support";

describe("Journal.seedDefaults creates only the manifest's declared fixed identities, atomically and idempotently", () => {
  it("should create exactly the identities declared by the supplied manifest and no others when seeding a fresh Workspace, with Plan Reflection's four initial prompts matching the contract in order, requiredness and kind", async () => {
    const { database, seam } = await openJournal();

    const result = await seedDefaults(seam, SEED_MANIFEST_V1);

    expect(result).toMatchObject({
      outcome: "Seeded",
      seedVersion: "journal-seed-v1",
      additions: ["entryType.plan-reflection", "source.plan-confirmation"],
      entryTypes: 1,
      sources: 1,
    });

    const rows = await journalRows(seam);
    const entryTypes = rows.filter((row) => row.kind === "entryType");
    const sources = rows.filter((row) => row.kind === "source");
    expect(entryTypes).toHaveLength(1);
    expect(sources).toHaveLength(1);
    expect(entryTypes[0]).toMatchObject({
      stableKey: "entryType.plan-reflection",
      label: "Plan Reflection",
      revision: 1,
    });

    const prompts = (entryTypes[0]?.definition as { prompts: Record<string, unknown>[] }).prompts;
    expect(prompts.map((prompt) => prompt.label)).toEqual([
      "Why this trade, why now?",
      "What would invalidate the thesis?",
      "Conviction",
      "Primary emotion",
    ]);
    expect(prompts.map((prompt) => prompt.required)).toEqual([true, true, false, false]);
    expect(prompts.map((prompt) => prompt.kind)).toEqual([
      "text",
      "text",
      "scale",
      "singleSelect",
    ]);
    expect(prompts.map((prompt) => prompt.semanticRole)).toEqual([
      "thesis",
      "invalidation",
      undefined,
      undefined,
    ]);
    expect(
      (prompts[3]?.options as { label: string }[]).map((option) => option.label),
    ).toEqual(["Calm", "Eager", "Anxious", "FOMO", "Revenge", "Relieved", "Frustrated", "Other"]);

    await closeJournal(database);
  });

  it("should create the Plan Confirmation Source bound to the Plan confirmation writing path", async () => {
    const { database, seam } = await openJournal();
    await seedDefaults(seam, SEED_MANIFEST_V1);

    const sources = (await journalRows(seam)).filter((row) => row.kind === "source");

    expect(sources[0]).toMatchObject({
      stableKey: "source.plan-confirmation",
      label: "Plan Confirmation",
      writingPath: "plan-confirmation",
    });

    await closeJournal(database);
  });
});
