import { parseDecimal, Rational } from '../../domain/values/index.ts';
import type { EntryDefinitionRecord, NarrativeAnswer, PlannedTradeDetail, TradeMutationSuccess } from '../../app/types.ts';

const decimal = (text: string): Rational => {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(`not a decimal: ${text}`);
  return parsed.value;
};

// Builds the Trade Detail view of a just-confirmed Plan from the command's post-commit result,
// so presenting the success needs no read back (AC-RESP-001).
export function confirmedDetail(
  success: TradeMutationSuccess,
  definition: EntryDefinitionRecord,
  labels: PlannedTradeDetail['labels'],
): PlannedTradeDetail {
  const { trade, derivation, entry } = success.postCommit;
  const prompts = new Map(definition.prompts.map((p) => [p.id, p]));
  return {
    tradeId: trade.tradeId,
    factRevision: trade.factRevision,
    plan: {
      underlying: trade.plan.underlying,
      planTime: trade.plan.economicTime,
      thesis: trade.plan.thesis,
      invalidation: trade.plan.invalidation,
      legs: trade.plan.legs,
      stops: trade.plan.stops,
      targets: trade.plan.targets,
    },
    lifecycle: { stored: trade.storedLifecycle, agreement: derivation.agreement },
    baseline: derivation.baseline,
    // As Trade Views gives a Planned Detail: the Plan's total quantity at its first leg's intended entry.
    summary: {
      kind: 'Stock',
      direction: 'Long',
      quantity: trade.plan.legs.map((l) => decimal(l.quantity)).reduce((a, b) => a.add(b), Rational.of(0n)),
      price: decimal(trade.plan.legs[0]!.intendedEntry),
    },
    labels,
    journal: [
      {
        id: entry.id,
        entryType: 'Plan Reflection',
        source: 'Plan Confirmation',
        anchor: entry.anchor,
        momentTime: entry.momentTime,
        authoredTime: entry.authoredTime,
        responses: entry.responses.map(({ promptId, value }) => {
          const prompt = prompts.get(promptId);
          const answer: NarrativeAnswer =
            value.kind === 'Option'
              ? {
                  kind: 'Option',
                  label: (prompt?.kind === 'SingleSelect' ? prompt.options.find((o) => o.id === value.optionId)?.label : undefined) ?? value.optionId,
                }
              : value;
          return { prompt: prompt?.text ?? promptId, answer };
        }),
      },
    ],
  };
}
