import { describe, expect, it } from "vitest";
import { SEED_MANIFEST_FULL, seedDefaults, SEED_MANIFEST_V1, type JournalSeedManifest, normalizedJournalManifest } from "../../src/journal";
import { TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { closeJournal, journalRows, openJournal } from "./support";

describe("Journal.seedDefaults creates only the manifest's declared fixed identities, atomically and idempotently", () => {
  it("should commit every seeded identity, definition revision and Source in one transaction, so an interrupted seed leaves no partial Journal configuration", async () => {
      const { database, seam } = await openJournal();
      // The failure is injected into whichever commit carries a late identity. A single-transaction
      // seed loses everything; a per-identity seed would leave the earlier identities committed.
      const failingSeam: TransactionSeam = {
        snapshot: (stores) => seam.snapshot(stores),
        counters: seam.counters,
        commit: (request) => {
          const rows = request.participants.flatMap((participant) => participant.put ?? []);
          if (rows.some((row) => row.stableKey === "entryType.review-note")) {
            return Promise.reject(new Error("injected storage failure"));
          }
          return seam.commit(request);
        },
      };

      await expect(seedDefaults(failingSeam, SEED_MANIFEST_FULL)).rejects.toBeTruthy();
      expect(await journalRows(seam)).toEqual([]);

      await closeJournal(database);
    });

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
