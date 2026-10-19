import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDefinitions } from "../../src/journal/definitions";
import { reviseDefinition } from "../../src/journal/reviseDefinition";
import {
  SEED_MANIFEST_V1,
  SEED_MANIFEST_V2,
  seedDefaults,
} from "../../src/journal";
import type { TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { close, openD2Seam } from "../support/store";

const PLAN_REFLECTION = "entryType.plan-reflection";
const PLAN_CONFIRMATION = "source.plan-confirmation";

describe("Journal.seedDefaults with manifest v2, at the public seedDefaults seam", () => {
  let seam: TransactionSeam;
  let database: IDBDatabase;

  beforeEach(async () => {
    const opened = await openD2Seam();
    seam = opened.seam;
    database = opened.database;
  });

  afterEach(async () => {
    await close(database);
  });

  it("should create the Plan Reflection definition revision and the Plan Confirmation Source when the Workspace has the D1 seed and both are missing", async () => {
    const result = await seedDefaults(seam, SEED_MANIFEST_V2);

    expect(result.outcome).toBe("Seeded");
    if (result.outcome !== "Seeded") return;
    expect(result.seedVersion).toBe("journal-seed-v2");
    expect(result.additions).toContain(PLAN_REFLECTION);
    expect(result.additions).toContain(PLAN_CONFIRMATION);

    const definitions = await getDefinitions(seam, { entryTypeStableKey: PLAN_REFLECTION });
    expect(definitions.outcome).toBe("Definitions");
    if (definitions.outcome !== "Definitions") return;
    expect(definitions.entryTypes[0]?.prompts).toHaveLength(4);
    expect(definitions.sources.map((source) => source.sourceStableKey)).toContain(
      PLAN_CONFIRMATION,
    );
  });

  it("should return an idempotent unchanged result with no new revision when manifest v2 is applied to a Workspace that already holds the exact definition", async () => {
    await seedDefaults(seam, SEED_MANIFEST_V2);
    const before = (await seam.snapshot(["journal"])).rows("journal");
    const beforeRevision = (await revisionOf(seam, PLAN_REFLECTION))?.revision;

    const second = await seedDefaults(seam, SEED_MANIFEST_V2);

    expect(second.outcome).toBe("Seeded");
    if (second.outcome !== "Seeded") return;
    expect(second.additions).toEqual([]);
    expect((await revisionOf(seam, PLAN_REFLECTION))?.revision).toBe(beforeRevision);
    expect((await seam.snapshot(["journal"])).rows("journal")).toEqual(before);
  });

  it("should return a typed SeedConflict and write nothing when the existing Plan Reflection stable key carries an incompatible definition", async () => {
    await seedDefaults(seam, SEED_MANIFEST_V2);
    const rows = (await seam.snapshot(["journal"])).rows("journal");
    const existing = rows.find((row) => row.id === `entryType:${PLAN_REFLECTION}`);
    await seam.commit({
      participants: [
        {
          store: "journal",
          put: [
            {
              ...existing,
              definition: {
                version: "trader",
                prompts: [{ stableKey: "prompt.something-else", label: "Other" }],
              },
            },
          ],
        },
      ],
    });
    const before = (await seam.snapshot(["journal"])).rows("journal");

    const result = await seedDefaults(seam, SEED_MANIFEST_V2);

    expect(result.outcome).toBe("SeedConflict");
    if (result.outcome !== "SeedConflict") return;
    expect(result.stableKey).toBe(PLAN_REFLECTION);
    expect((await seam.snapshot(["journal"])).rows("journal")).toEqual(before);
  });

  it("should not rewrite a trader-revised Plan Reflection definition when seeding runs after reviseDefinition changed the future form", async () => {
    await seedDefaults(seam, SEED_MANIFEST_V2);
    const current = await revisionOf(seam, PLAN_REFLECTION);
    expect(current).toBeDefined();

    // A legal trader revision rewords the form but keeps every workflow-critical role.
    const revised = await reviseDefinition(seam, {
      entryTypeStableKey: PLAN_REFLECTION,
      expectedRevision: current?.revision ?? 0,
      prompts: [
        {
          stableKey: "prompt.plan-reflection.thesis",
          label: "Why this trade, and why now?",
          kind: "text",
          required: true,
          semanticRole: "thesis",
        },
        {
          stableKey: "prompt.plan-reflection.invalidation",
          label: "What would invalidate the thesis?",
          kind: "text",
          required: true,
          semanticRole: "invalidation",
        },
        {
          stableKey: "prompt.plan-reflection.conviction",
          label: "Conviction",
          kind: "scale",
          required: false,
          scaleMin: 1,
          scaleMax: 5,
        },
        {
          stableKey: "prompt.plan-reflection.primary-emotion",
          label: "Primary emotion",
          kind: "singleSelect",
          required: false,
          options: [
            { stableKey: "option.emotion.calm", label: "Calm" },
            { stableKey: "option.emotion.eager", label: "Eager" },
            { stableKey: "option.emotion.anxious", label: "Anxious" },
            { stableKey: "option.emotion.fomo", label: "FOMO" },
            { stableKey: "option.emotion.revenge", label: "Revenge" },
            { stableKey: "option.emotion.relieved", label: "Relieved" },
            { stableKey: "option.emotion.frustrated", label: "Frustrated" },
            { stableKey: "option.emotion.other", label: "Other" },
          ],
        },
      ],
    });
    expect(revised.outcome).toBe("Revised");
    const revisedRows = (await seam.snapshot(["journal"])).rows("journal");

    const reseeded = await seedDefaults(seam, SEED_MANIFEST_V2);

    expect(reseeded.outcome).toBe("Seeded");
    expect((await seam.snapshot(["journal"])).rows("journal")).toEqual(revisedRows);

    const definitions = await getDefinitions(seam, { entryTypeStableKey: PLAN_REFLECTION });
    expect(definitions.outcome).toBe("Definitions");
    if (definitions.outcome !== "Definitions") return;
    expect(definitions.entryTypes[0]?.prompts[0]?.label).toBe("Why this trade, and why now?");
  });

  it("should return the resulting definition revision, the exact additions and the installed-Source summary when the seed applies its additions, without requiring a follow-up read", async () => {
    const result = await seedDefaults(seam, SEED_MANIFEST_V2);

    expect(result.outcome).toBe("Seeded");
    if (result.outcome !== "Seeded") return;
    expect(result.definitionRevision).toBeGreaterThanOrEqual(1);
    expect(result.additions).toEqual([PLAN_REFLECTION, PLAN_CONFIRMATION]);
    expect(result.installedSources).toEqual([PLAN_CONFIRMATION]);
  });

  it("should report the six uninstalled Entry Types and six uninstalled Sources as absent from the manifest rather than creating empty definitions when the Plan Reflection type and Plan Confirmation Source have been installed", async () => {
    const result = await seedDefaults(seam, SEED_MANIFEST_V2);

    expect(result.outcome).toBe("Seeded");
    if (result.outcome !== "Seeded") return;
    expect(result.absentEntryTypes).toHaveLength(6);
    expect(result.absentSources).toHaveLength(6);
    const rows = (await seam.snapshot(["journal"])).rows("journal");
    expect(rows.filter((row) => row.kind === "entryType")).toHaveLength(1);
    expect(rows.filter((row) => row.kind === "source")).toHaveLength(1);
  });

  it("should match the Plan Reflection Entry Type by stable product identity when its label has been renamed by the trader", async () => {
    await seedDefaults(seam, SEED_MANIFEST_V2);
    const rows = (await seam.snapshot(["journal"])).rows("journal");
    const existing = rows.find((row) => row.id === `entryType:${PLAN_REFLECTION}`);
    await seam.commit({
      participants: [
        { store: "journal", put: [{ ...existing, label: "My plan thinking" }] },
      ],
    });

    const result = await seedDefaults(seam, SEED_MANIFEST_V2);

    expect(result.outcome).toBe("Seeded");
    if (result.outcome !== "Seeded") return;
    expect(result.additions).toEqual([]);
    const after = (await seam.snapshot(["journal"])).rows("journal");
    expect(after.find((row) => row.id === `entryType:${PLAN_REFLECTION}`)?.label).toBe(
      "My plan thinking",
    );
  });

  it("should never create a new Entry Type when the manifest is applied to a Workspace that already holds compatible identities, so that the seeded fixed set is a subset of the seven canonical identities", async () => {
    await seedDefaults(seam, SEED_MANIFEST_V1);
    const result = await seedDefaults(seam, SEED_MANIFEST_V2);

    expect(result.outcome).toBe("Seeded");
    const rows = (await seam.snapshot(["journal"])).rows("journal");
    const entryTypes = rows.filter((row) => row.kind === "entryType");
    expect(entryTypes).toHaveLength(1);
    const known = new Set([
      "entryType.plan-reflection",
      "entryType.position-change-reflection",
      "entryType.management-revision",
      "entryType.close-review",
      "entryType.daily-trade-review",
      "entryType.review-note",
      "entryType.trader-reflection",
    ]);
    for (const row of entryTypes) expect(known.has(String(row.stableKey))).toBe(true);
  });
});

async function revisionOf(
  seam: TransactionSeam,
  stableKey: string,
): Promise<{ readonly revision: number } | undefined> {
  const rows = (await seam.snapshot(["journal"])).rows("journal");
  const row = rows.find((candidate) => candidate.id === `entryType:${stableKey}`);
  return row === undefined ? undefined : { revision: Number(row.revision) };
}
