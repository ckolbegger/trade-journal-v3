import { describe, expect, it } from "vitest";
import { SEED_MANIFEST_V1, seedDefaults } from "../../src/journal";
import { closeJournal, journalRows, openJournal } from "./support";

describe("Journal.seedDefaults creates only the manifest's declared fixed identities, atomically and idempotently", () => {
  it("should retain a trader-revised definition and not reset it, returning the retained revision as the current one", async () => {
    const { database, seam } = await openJournal();
    await seedDefaults(seam, SEED_MANIFEST_V1);

    const rows = await journalRows(seam);
    const entryType = rows.find((row) => row.kind === "entryType") as Record<string, unknown>;
    const revised = {
      ...entryType,
      revision: 2,
      definition: {
        version: "trader-revision-2",
        prompts: (
          entryType.definition as { prompts: Record<string, unknown>[] }
        ).prompts.map((prompt) =>
          prompt.stableKey === "prompt.plan-reflection.conviction"
            ? { ...prompt, label: "How strongly do you believe this?" }
            : prompt,
        ),
      },
    };
    await seam.commit({ participants: [{ store: "journal", put: [revised] }] });

    const result = await seedDefaults(seam, SEED_MANIFEST_V1);

    expect(result).toMatchObject({ outcome: "Seeded", definitionRevision: 2, additions: [] });
    const after = (await journalRows(seam)).find((row) => row.kind === "entryType") as Record<
      string,
      unknown
    >;
    expect(after.revision).toBe(2);
    const prompts = (after.definition as { prompts: Record<string, unknown>[] }).prompts;
    expect(prompts[2]?.label).toBe("How strongly do you believe this?");

    await closeJournal(database);
  });
});
