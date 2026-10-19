import { describe, expect, it } from "vitest";
import { SEED_MANIFEST_V1, normalizedJournalManifest, seedDefaults } from "../../src/journal";
import { closeJournal, journalRows, openJournal } from "./support";

describe("Journal.seedDefaults creates only the manifest's declared fixed identities, atomically and idempotently", () => {
  it("should be idempotent: repeating the same manifest leaves the normalized identity-and-definition manifest identical and adds no revision", async () => {
    const { database, seam } = await openJournal();

    await seedDefaults(seam, SEED_MANIFEST_V1);
    const first = normalizedJournalManifest(await journalRows(seam));
    const second = await seedDefaults(seam, SEED_MANIFEST_V1);
    const after = normalizedJournalManifest(await journalRows(seam));

    expect(second).toMatchObject({ outcome: "Seeded", additions: [] });
    expect(after).toEqual(first);
    expect((await journalRows(seam)).every((row) => row.revision === 1)).toBe(true);

    await closeJournal(database);
  });
});
