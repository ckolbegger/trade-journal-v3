import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyPreparedEffects,
  prepareEffects,
  type JournalEffectRequest,
  type JournalObligation,
  type PlanReflectionForm,
} from "../../src/journal/effects";
import { SEED_MANIFEST_V2, seedDefaults } from "../../src/journal";
import { reviseDefinition } from "../../src/journal/reviseDefinition";
import type { TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { close, openD2Seam } from "../support/store";

const PLAN_REFLECTION = "entryType.plan-reflection";

const COMPLETE_FORM: PlanReflectionForm = {
  entryTypeStableKey: PLAN_REFLECTION,
  definitionRevision: 1,
  answers: [
    { promptStableKey: "prompt.plan-reflection.thesis", value: "Breakout above the base" },
    {
      promptStableKey: "prompt.plan-reflection.invalidation",
      value: "Closes back inside the base",
    },
  ],
};

function obligation(disposition: JournalObligation["disposition"] = { kind: "Complete", form: COMPLETE_FORM }): JournalObligation {
  return { obligationKey: "plan-confirmation:trade-candidate", disposition };
}

function request(overrides: Partial<JournalEffectRequest> = {}): JournalEffectRequest {
  return {
    obligations: [obligation()],
    anchor: { kind: "TradeAnchor", tradeId: "candidate:trade" },
    origin: { kind: "Plan" },
    momentTime: "2026-10-19T20:30:00.000Z",
    firstAuthoredTime: "2026-10-19T20:31:12.000Z",
    ...overrides,
  };
}

describe("Journal.prepareEffects for one completed Plan Reflection, at the public prepareEffects seam", () => {
  let seam: TransactionSeam;
  let database: IDBDatabase;

  beforeEach(async () => {
    const opened = await openD2Seam();
    seam = opened.seam;
    database = opened.database;
    await seedDefaults(seam, SEED_MANIFEST_V2);
  });

  afterEach(async () => {
    await close(database);
  });

  it("should return one prepared completed Plan Reflection bound to the exact Entry Definition revision supplied in the form when the form answers both required Thesis and Invalidation prompts", async () => {
    const result = await prepareEffects(seam, request());

    expect(result.outcome).toBe("Prepared");
    if (result.outcome !== "Prepared") return;
    expect(result.effects).toHaveLength(1);
    expect(result.effects[0]?.definitionRevision).toBe(1);
    expect(result.effects[0]?.source.stableKey).toBe("source.plan-confirmation");
  });

  it("should bind the Thesis and Invalidation answers by their stable workflow-critical Prompt identities rather than by label when the same form is prepared against a later revision whose wording changed", async () => {
    await reviseDefinition(seam, {
      entryTypeStableKey: PLAN_REFLECTION,
      expectedRevision: 1,
      prompts: [
        {
          stableKey: "prompt.plan-reflection.thesis",
          label: "Why now?",
          kind: "text",
          required: true,
          semanticRole: "thesis",
        },
        {
          stableKey: "prompt.plan-reflection.invalidation",
          label: "What kills it?",
          kind: "text",
          required: true,
          semanticRole: "invalidation",
        },
      ],
    });

    const result = await prepareEffects(seam, request({
      obligations: [
        obligation({ kind: "Complete", form: { ...COMPLETE_FORM, definitionRevision: 2 } }),
      ],
    }));

    expect(result.outcome).toBe("Prepared");
    if (result.outcome !== "Prepared") return;
    const answers = result.effects[0]?.answers ?? [];
    expect(answers.find((answer) => answer.semanticRole === "thesis")?.value).toBe(
      "Breakout above the base",
    );
    expect(answers.find((answer) => answer.semanticRole === "invalidation")?.value).toBe(
      "Closes back inside the base",
    );
  });

  it("should reserve no durable Entry identity, version identity or Debt identity in the prepared result when preparation is repeated for the same form, because prepared candidates are nonpersistent", async () => {
    const before = await seam.snapshot(["journal"]);

    const first = await prepareEffects(seam, request());
    const second = await prepareEffects(seam, request());

    expect(first.outcome).toBe("Prepared");
    expect(second.outcome).toBe("Prepared");
    if (first.outcome !== "Prepared" || second.outcome !== "Prepared") return;
    expect(first.effects[0]?.candidateEntryReference).toBe(
      second.effects[0]?.candidateEntryReference,
    );
    expect(first.effects[0]?.candidateEntryReference.startsWith("candidate-entry:")).toBe(true);
    const after = await seam.snapshot(["journal"]);
    expect(after.rows("journal")).toEqual(before.rows("journal"));
  });

  it("should reject with a typed issue naming the unanswered prompt and return no prepared Entry when the form omits the Thesis answer even though it answers Invalidation", async () => {
    const result = await prepareEffects(seam, request({
      obligations: [
        obligation({
          kind: "Complete",
          form: {
            ...COMPLETE_FORM,
            answers: COMPLETE_FORM.answers.filter(
              (answer) => answer.promptStableKey !== "prompt.plan-reflection.thesis",
            ),
          },
        }),
      ],
    }));

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    const issue = result.issues.find((candidate) => candidate.code === "UnansweredRequiredPrompt");
    expect(issue?.promptStableKey).toBe("prompt.plan-reflection.thesis");
    expect(Object.keys(result)).not.toContain("effects");
  });

  it("should reject with a typed CompleteNow-required issue and prepare no Debt when the disposition is Defer for the Plan Reflection obligation", async () => {
    const result = await prepareEffects(seam, request({ obligations: [obligation({ kind: "Defer" })] }));

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    expect(result.issues.some((issue) => issue.code === "CompleteNowRequired")).toBe(true);
  });

  it("should reject with a typed issue and prepare no decline when the disposition is Decline for the Plan Reflection obligation", async () => {
    const result = await prepareEffects(seam, request({
      obligations: [obligation({ kind: "Decline", reason: "changed my mind" })],
    }));

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    expect(result.issues.some((issue) => issue.code === "DeclineNotPermitted")).toBe(true);
  });

  it("should return the definition snapshot it validated against, including prompt order, labels and option set, when the completed form is prepared, so that the eventual Entry can render the exact form the trader saw", async () => {
    const result = await prepareEffects(seam, request());

    expect(result.outcome).toBe("Prepared");
    if (result.outcome !== "Prepared") return;
    const snapshot = result.effects[0]?.definitionSnapshot;
    expect(snapshot?.prompts.map((prompt) => prompt.label)).toEqual([
      "Why this trade, why now?",
      "What would invalidate the thesis?",
      "Conviction",
      "Primary emotion",
    ]);
    expect(
      snapshot?.prompts.find((prompt) => prompt.stableKey === "prompt.plan-reflection.primary-emotion")
        ?.options,
    ).toHaveLength(8);
  });

  it("should reject with a typed issue naming the selection and write nothing when the form answers a Single Select prompt with an option that does not belong to that prompt's closed option set", async () => {
    const result = await prepareEffects(seam, request({
      obligations: [
        obligation({
          kind: "Complete",
          form: {
            ...COMPLETE_FORM,
            answers: [
              ...COMPLETE_FORM.answers,
              { promptStableKey: "prompt.plan-reflection.primary-emotion", value: "Euphoric" },
            ],
          },
        }),
      ],
    }));

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    const issue = result.issues.find((candidate) => candidate.code === "ForeignOptionSelection");
    expect(issue?.promptStableKey).toBe("prompt.plan-reflection.primary-emotion");
  });
});

describe("Journal.applyPreparedEffects for the prepared Plan Reflection, at the public applyPreparedEffects seam inside a shared transaction", () => {
  let seam: TransactionSeam;
  let database: IDBDatabase;

  beforeEach(async () => {
    const opened = await openD2Seam();
    seam = opened.seam;
    database = opened.database;
    await seedDefaults(seam, SEED_MANIFEST_V2);
  });

  afterEach(async () => {
    await close(database);
  });

  async function prepared() {
    const result = await prepareEffects(seam, request());
    if (result.outcome !== "Prepared") throw new Error("preparation did not succeed");
    return result.effects;
  }

  it("should return the assigned Entry identity and the staged outcome projection bound to the Trade identity mapping supplied by the coordinator when the candidate is mapped through Trade Record's exact durable mapping", async () => {
    const effects = await prepared();
    const applied = await applyPreparedEffects(seam, {
      effects,
      mapping: [{ candidateTradeId: "candidate:trade", tradeId: "trade-1" }],
      expectedCandidateTradeIds: ["candidate:trade"],
    });

    expect(applied.outcome).toBe("Applied");
    if (applied.outcome !== "Applied") return;
    expect(applied.mapping).toHaveLength(1);
    expect(applied.staged[0]?.entryId).toBe(applied.mapping[0]?.entryId);
    expect(applied.staged[0]?.obligationKey).toBe("plan-confirmation:trade-candidate");
  });

  it("should stage exactly one Anchor of TradeAnchor kind pointing at the mapped Trade identity and one automatic Plan Confirmation Source snapshot when the prepared Plan Reflection effect is applied", async () => {
    const effects = await prepared();
    const applied = await applyPreparedEffects(seam, {
      effects,
      mapping: [{ candidateTradeId: "candidate:trade", tradeId: "trade-1" }],
      expectedCandidateTradeIds: ["candidate:trade"],
    });
    expect(applied.outcome).toBe("Applied");
    if (applied.outcome !== "Applied") return;

    await seam.commit({ participants: applied.participants });
    const rows = (await seam.snapshot(["journal"])).rows("journal");
    const entry = rows.find((row) => row.kind === "entry");
    expect(entry?.anchor).toEqual({ kind: "TradeAnchor", tradeId: "trade-1" });
    expect(entry?.sourceStableKey).toBe("source.plan-confirmation");
  });

  it("should stage the Entry with moment time and first-authored time and preserve the definition snapshot that was validated at preparation time when the prepared effect is applied inside the transaction", async () => {
    const effects = await prepared();
    const applied = await applyPreparedEffects(seam, {
      effects,
      mapping: [{ candidateTradeId: "candidate:trade", tradeId: "trade-1" }],
      expectedCandidateTradeIds: ["candidate:trade"],
    });
    expect(applied.outcome).toBe("Applied");
    if (applied.outcome !== "Applied") return;
    await seam.commit({ participants: applied.participants });

    const entry = (await seam.snapshot(["journal"])).rows("journal").find((row) => row.kind === "entry");
    expect(entry?.momentTime).toBe("2026-10-19T20:30:00.000Z");
    expect(entry?.firstAuthoredTime).toBe("2026-10-19T20:31:12.000Z");
    expect(entry?.definitionRevision).toBe(1);
    expect((entry?.definitionSnapshot as { prompts?: unknown[] } | undefined)?.prompts).toHaveLength(4);
  });

  it("should return a typed no-write conflict and stage nothing when the supplied mapping does not contain the candidate the prepared effect was bound to", async () => {
    const effects = await prepared();
    const applied = await applyPreparedEffects(seam, {
      effects,
      mapping: [{ candidateTradeId: "candidate:other", tradeId: "trade-9" }],
      expectedCandidateTradeIds: ["candidate:trade"],
    });

    expect(applied).toMatchObject({ outcome: "Conflict", code: "MappingMismatch" });
    expect(Object.keys(applied)).not.toContain("participants");
  });

  it("should return a typed no-write conflict and stage nothing when a retry applies the same obligation a second time, so that exactly one current outcome exists", async () => {
    const effects = await prepared();
    const first = await applyPreparedEffects(seam, {
      effects,
      mapping: [{ candidateTradeId: "candidate:trade", tradeId: "trade-1" }],
      expectedCandidateTradeIds: ["candidate:trade"],
    });
    if (first.outcome !== "Applied") throw new Error("the first apply did not stage");
    await seam.commit({ participants: first.participants });

    const retry = await applyPreparedEffects(seam, {
      effects,
      mapping: [{ candidateTradeId: "candidate:trade", tradeId: "trade-1" }],
      expectedCandidateTradeIds: ["candidate:trade"],
    });

    expect(retry).toMatchObject({ outcome: "Conflict", code: "DuplicateObligation" });
    const entries = (await seam.snapshot(["journal"])).rows("journal").filter((row) => row.kind === "entry");
    expect(entries).toHaveLength(1);
  });

  it("should roll back every staged Journal effect when the surrounding transaction aborts", async () => {
    const effects = await prepared();
    const applied = await applyPreparedEffects(seam, {
      effects,
      mapping: [{ candidateTradeId: "candidate:trade", tradeId: "trade-1" }],
      expectedCandidateTradeIds: ["candidate:trade"],
    });
    if (applied.outcome !== "Applied") throw new Error("the apply did not stage");
    const before = (await seam.snapshot(["journal"])).rows("journal");

    await expect(
      seam.commit({
        participants: [
          ...applied.participants,
          { store: "storeThatDoesNotExist", put: [{ id: "x" }] },
        ],
      }),
    ).rejects.toBeDefined();

    const after = (await seam.snapshot(["journal"])).rows("journal");
    expect(after).toEqual(before);
  });

  it("should reject and stage nothing when the candidate's definition revision no longer matches a retained revision, rather than substituting the latest definition", async () => {
    const effects = await prepared();
    const stale = effects.map((effect) => ({ ...effect, definitionRevision: 7 }));

    const applied = await applyPreparedEffects(seam, {
      effects: stale,
      mapping: [{ candidateTradeId: "candidate:trade", tradeId: "trade-1" }],
      expectedCandidateTradeIds: ["candidate:trade"],
    });

    expect(applied).toMatchObject({ outcome: "Conflict", code: "DefinitionRevisionMissing" });
  });

  it("should return the staged projection such that no Journal query is needed to render the saved Entry after commit, when the surrounding transaction succeeds", async () => {
    const effects = await prepared();
    const applied = await applyPreparedEffects(seam, {
      effects,
      mapping: [{ candidateTradeId: "candidate:trade", tradeId: "trade-1" }],
      expectedCandidateTradeIds: ["candidate:trade"],
    });
    expect(applied.outcome).toBe("Applied");
    if (applied.outcome !== "Applied") return;
    await seam.commit({ participants: applied.participants });

    const staged = applied.staged[0];
    const entry = (await seam.snapshot(["journal"])).rows("journal").find((row) => row.kind === "entry");
    expect(staged?.thesis).toBe("Breakout above the base");
    expect(staged?.invalidation).toBe("Closes back inside the base");
    expect(entry?.thesis).toBe(staged?.thesis);
    expect(entry?.invalidation).toBe(staged?.invalidation);
    expect(staged?.answers).toHaveLength(2);
  });
});
