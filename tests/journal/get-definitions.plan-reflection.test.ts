import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDefinitions } from "../../src/journal/definitions";
import { SEED_MANIFEST_V1, seedDefaults } from "../../src/journal";
import { reviseDefinition } from "../../src/journal/reviseDefinition";
import type { TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { close, openD2Seam } from "../support/store";

const PLAN_REFLECTION = "entryType.plan-reflection";

describe("Journal.getDefinitions for the Plan Reflection Entry Type, at the public getDefinitions seam", () => {
  let seam: TransactionSeam;
  let database: IDBDatabase;

  beforeEach(async () => {
    const opened = await openD2Seam();
    seam = opened.seam;
    database = opened.database;
    const seeded = await seedDefaults(seam, SEED_MANIFEST_V1);
    expect(seeded.outcome).toBe("Seeded");
  });

  afterEach(async () => {
    await close(database);
  });

  it("should return the complete exact initial Plan Reflection definition when no explicit revision is requested and the Plan Reflection type has been seeded", async () => {
    const result = await getDefinitions(seam, { entryTypeStableKey: PLAN_REFLECTION });

    expect(result.outcome).toBe("Definitions");
    if (result.outcome !== "Definitions") return;
    expect(result.entryTypes).toHaveLength(1);
    expect(result.entryTypes[0]?.entryTypeStableKey).toBe(PLAN_REFLECTION);
    expect(result.entryTypes[0]?.prompts).toHaveLength(4);
  });

  it("should return prompts in the frozen order with their exact labels, requiredness, Prompt kinds and stable Prompt identities when the definition is requested by its latest revision", async () => {
    const result = await getDefinitions(seam, { entryTypeStableKey: PLAN_REFLECTION });

    expect(result.outcome).toBe("Definitions");
    if (result.outcome !== "Definitions") return;
    const prompts = result.entryTypes[0]?.prompts ?? [];
    expect(prompts.map((prompt) => prompt.label)).toEqual([
      "Why this trade, why now?",
      "What would invalidate the thesis?",
      "Conviction",
      "Primary emotion",
    ]);
    expect(prompts.map((prompt) => prompt.kind)).toEqual([
      "text",
      "text",
      "scale",
      "singleSelect",
    ]);
    expect(prompts.map((prompt) => prompt.required)).toEqual([true, true, false, false]);
    expect(prompts.map((prompt) => prompt.stableKey)).toEqual([
      "prompt.plan-reflection.thesis",
      "prompt.plan-reflection.invalidation",
      "prompt.plan-reflection.conviction",
      "prompt.plan-reflection.primary-emotion",
    ]);
  });

  it("should mark exactly the Thesis and Invalidation prompts with their workflow-critical semantic roles and return the other two prompts without a workflow-critical role when the complete initial Plan Reflection definition is read", async () => {
    const result = await getDefinitions(seam, { entryTypeStableKey: PLAN_REFLECTION });

    expect(result.outcome).toBe("Definitions");
    if (result.outcome !== "Definitions") return;
    const roleBearing = (result.entryTypes[0]?.prompts ?? []).filter(
      (prompt) => prompt.semanticRole !== undefined,
    );
    expect(roleBearing.map((prompt) => prompt.semanticRole).sort()).toEqual([
      "invalidation",
      "thesis",
    ]);
    expect(roleBearing.map((prompt) => prompt.stableKey).sort()).toEqual([
      "prompt.plan-reflection.invalidation",
      "prompt.plan-reflection.thesis",
    ]);
  });

  it("should return the closed Primary emotion option set of Calm, Eager, Anxious, FOMO, Revenge, Relieved, Frustrated and Other with stable Option identities when the Single Select prompt is read", async () => {
    const result = await getDefinitions(seam, { entryTypeStableKey: PLAN_REFLECTION });

    expect(result.outcome).toBe("Definitions");
    if (result.outcome !== "Definitions") return;
    const emotion = (result.entryTypes[0]?.prompts ?? []).find(
      (prompt) => prompt.stableKey === "prompt.plan-reflection.primary-emotion",
    );
    expect(emotion?.options?.map((option) => option.label)).toEqual([
      "Calm",
      "Eager",
      "Anxious",
      "FOMO",
      "Revenge",
      "Relieved",
      "Frustrated",
      "Other",
    ]);
    expect(emotion?.options?.map((option) => option.stableKey)).toEqual([
      "option.emotion.calm",
      "option.emotion.eager",
      "option.emotion.anxious",
      "option.emotion.fomo",
      "option.emotion.revenge",
      "option.emotion.relieved",
      "option.emotion.frustrated",
      "option.emotion.other",
    ]);
  });

  it("should return the 1 to 5 bounds for the Conviction Scale prompt and mark it optional when the Conviction prompt is read, so that Unanswered is a valid saved value and never a decline", async () => {
    const result = await getDefinitions(seam, { entryTypeStableKey: PLAN_REFLECTION });

    expect(result.outcome).toBe("Definitions");
    if (result.outcome !== "Definitions") return;
    const conviction = (result.entryTypes[0]?.prompts ?? []).find(
      (prompt) => prompt.stableKey === "prompt.plan-reflection.conviction",
    );
    expect(conviction?.scaleMin).toBe(1);
    expect(conviction?.scaleMax).toBe(5);
    expect(conviction?.required).toBe(false);
  });

  it("should still report 1 to 5 bounds when a retained definition revision omits them, because an older form must read as bounded rather than unbounded", async () => {
    // A retained revision written before the bounds were stated explicitly. The two
    // workflow-critical roles are kept, which is what `reviseDefinition` requires.
    const revised = await reviseDefinition(seam, {
      entryTypeStableKey: PLAN_REFLECTION,
      expectedRevision: 1,
      prompts: [
        {
          stableKey: "prompt.plan-reflection.thesis",
          label: "Why this trade, why now?",
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
        },
      ],
    });
    expect(revised.outcome).toBe("Revised");

    const result = await getDefinitions(seam, { entryTypeStableKey: PLAN_REFLECTION });
    expect(result.outcome).toBe("Definitions");
    if (result.outcome !== "Definitions") return;
    const conviction = (result.entryTypes[0]?.prompts ?? []).find(
      (prompt) => prompt.stableKey === "prompt.plan-reflection.conviction",
    );
    expect(conviction?.scaleMin).toBe(1);
    expect(conviction?.scaleMax).toBe(5);
  });

  it("should return the identical definition again when the same revision is requested twice, because definitions are immutable revisions and not recomputed views", async () => {
    const first = await getDefinitions(seam, { entryTypeStableKey: PLAN_REFLECTION });
    const second = await getDefinitions(seam, { entryTypeStableKey: PLAN_REFLECTION });

    expect(first.outcome).toBe("Definitions");
    expect(second.outcome).toBe("Definitions");
    if (first.outcome !== "Definitions" || second.outcome !== "Definitions") return;
    expect(second.entryTypes).toEqual(first.entryTypes);
    expect(second.entryTypes[0]?.revision).toBe(first.entryTypes[0]?.revision);
  });

  it("should return a typed not-found result naming the requested revision and write nothing when an exact revision that was never retained is requested", async () => {
    const before = await seam.snapshot(["journal"]);

    const result = await getDefinitions(seam, {
      entryTypeStableKey: PLAN_REFLECTION,
      revision: 9,
    });

    expect(result).toMatchObject({
      outcome: "NotFound",
      entryTypeStableKey: PLAN_REFLECTION,
      revision: 9,
    });
    const after = await seam.snapshot(["journal"]);
    expect(after.rows("journal")).toEqual(before.rows("journal"));
  });

  it("should report the Plan Reflection and Plan Confirmation identities as the only installed Journal definitions for this deliverable, with the other six Entry Types and six Sources absent from the returned set, when the latest definitions are requested for every fixed type", async () => {
    const result = await getDefinitions(seam);

    expect(result.outcome).toBe("Definitions");
    if (result.outcome !== "Definitions") return;
    expect(result.entryTypes.map((entryType) => entryType.entryTypeStableKey)).toEqual([
      PLAN_REFLECTION,
    ]);
    expect(result.sources.map((source) => source.sourceStableKey)).toEqual([
      "source.plan-confirmation",
    ]);
    expect(result.absentEntryTypes).toHaveLength(6);
    expect(result.absentSources).toHaveLength(6);
    expect(result.absentEntryTypes).toContain("entryType.close-review");
    expect(result.absentSources).toContain("source.trade-close");
  });
});
