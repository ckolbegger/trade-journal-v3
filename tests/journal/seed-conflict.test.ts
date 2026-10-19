import { describe, expect, it } from "vitest";
import { SEED_MANIFEST_V1, seedDefaults, type JournalSeedManifest } from "../../src/journal";
import { closeJournal, journalRows, openJournal } from "./support";

describe("Journal.seedDefaults creates only the manifest's declared fixed identities, atomically and idempotently", () => {
  it("should return a typed SeedConflict and write nothing when a known stable product key already exists with an incompatible meaning", async () => {
    const { database, seam } = await openJournal();
    await seedDefaults(seam, SEED_MANIFEST_V1);
    const before = JSON.stringify(await journalRows(seam));

    const incompatible: JournalSeedManifest = {
      ...SEED_MANIFEST_V1,
      entryTypes: SEED_MANIFEST_V1.entryTypes.map((entryType) => ({
        ...entryType,
        prompts: entryType.prompts.slice(0, 2),
      })),
    };
    const result = await seedDefaults(seam, incompatible);

    expect(result).toMatchObject({
      outcome: "SeedConflict",
      stableKey: "entryType.plan-reflection",
    });
    expect(JSON.stringify(await journalRows(seam))).toBe(before);

    await closeJournal(database);
  });
});
