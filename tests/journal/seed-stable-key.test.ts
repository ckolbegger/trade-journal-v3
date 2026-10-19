import { describe, expect, it } from "vitest";
import { SEED_MANIFEST_V1, seedDefaults, type JournalSeedManifest } from "../../src/journal";
import { closeJournal, journalRows, openJournal } from "./support";

describe("Journal.seedDefaults creates only the manifest's declared fixed identities, atomically and idempotently", () => {
  it("should match by stable product key and never by label, so a reworded prompt label does not create a second Entry Type or a duplicate prompt", async () => {
    const { database, seam } = await openJournal();
    await seedDefaults(seam, SEED_MANIFEST_V1);

    const reworded: JournalSeedManifest = {
      ...SEED_MANIFEST_V1,
      entryTypes: SEED_MANIFEST_V1.entryTypes.map((entryType) => ({
        ...entryType,
        prompts: entryType.prompts.map((prompt) =>
          prompt.stableKey === "prompt.plan-reflection.thesis"
            ? { ...prompt, label: "Why now, and why this trade?" }
            : prompt,
        ),
      })),
    };
    const result = await seedDefaults(seam, reworded);

    const rows = await journalRows(seam);
    const entryTypes = rows.filter((row) => row.kind === "entryType");
    expect(result).toMatchObject({ outcome: "Seeded", additions: [] });
    expect(entryTypes).toHaveLength(1);
    const prompts = (entryTypes[0]?.definition as { prompts: Record<string, unknown>[] }).prompts;
    expect(prompts).toHaveLength(4);
    expect(prompts[0]?.label).toBe("Why this trade, why now?");

    await closeJournal(database);
  });
});
