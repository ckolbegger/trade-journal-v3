import { describe, expect, it } from "vitest";
import { SEED_MANIFEST_FULL, seedDefaults, type JournalSeedManifest } from "../../src/journal";
import { closeJournal, journalRows, openJournal } from "./support";

describe("Journal.seedDefaults creates only the manifest's declared fixed identities, atomically and idempotently", () => {
  it("should create each of the seven fixed Entry Type keys and seven Source keys with only the missing ones created when a manifest declares all of them, proving later additions join without reshaping the mechanism", async () => {
    const { database, seam } = await openJournal();
    const firstFive: JournalSeedManifest = {
      ...SEED_MANIFEST_FULL,
      entryTypes: SEED_MANIFEST_FULL.entryTypes.slice(0, 5),
      sources: SEED_MANIFEST_FULL.sources.slice(0, 5),
    };
    await seedDefaults(seam, firstFive);

    const result = await seedDefaults(seam, SEED_MANIFEST_FULL);

    expect(result).toMatchObject({
      outcome: "Seeded",
      additions: [
        "entryType.review-note",
        "entryType.trader-reflection",
        "source.trade-detail",
        "source.journal",
      ],
    });
    const rows = await journalRows(seam);
    expect(rows.filter((row) => row.kind === "entryType")).toHaveLength(7);
    expect(rows.filter((row) => row.kind === "source")).toHaveLength(7);

    await closeJournal(database);
  });
});
