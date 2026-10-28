import { derive, evaluate, type ObservationFrame, type TradeAnalysisRecord, type TradeEvaluation } from '../domain/trade-analysis/index.ts';
import type { MarkFrame } from '../modules/market-data/index.ts';

// Market Data's frame as Trade Analysis reads it: composition maps one into the other.
export function observationFrame(frame: MarkFrame): ObservationFrame {
  return {
    instrument: { kind: 'Stock', symbol: frame.instrumentKey },
    tradingDate: frame.tradingDate,
    closeInstant: frame.closeInstant,
    resolution: frame.resolution,
  };
}

// The Position held at an earlier close, valued with that session's own exact Mark (P13, A54).
export interface DatedLine {
  readonly tradingDate: string;
  readonly evaluation: TradeEvaluation;
}

// The latest close at or before the frame with an exact Mark that values a Position the current
// figures cannot: the Stale context's, or the frame's own when Lots opened after its close (P12).
function datedSourceOf(frame: MarkFrame, evaluation: TradeEvaluation) {
  const stale = evaluation.staleContext;
  if (stale) return { tradingDate: stale.tradingDate, closeInstant: stale.closeInstant, mark: { revisionId: stale.revisionId, revisionNumber: stale.revisionNumber, price: stale.price } };
  if (frame.resolution.kind === 'Available' && evaluation.atEntry) return { tradingDate: frame.tradingDate, closeInstant: frame.closeInstant, mark: frame.resolution.mark };
  return undefined;
}

// The Position held at that close, valued with that session's own exact Mark; absent when the
// current figures need no such line, or the Trade had no exposure then (P12, P13, A54).
export function datedLineOf(analysis: TradeAnalysisRecord, frame: MarkFrame, evaluation: TradeEvaluation): DatedLine | undefined {
  const source = datedSourceOf(frame, evaluation);
  if (!source) return undefined;
  const atClose = derive({ record: analysis, cutoff: source.closeInstant, valuationDate: source.tradingDate });
  if (atClose.kind !== 'Derived') throw new Error('facts cannot be replayed at the dated close');
  if (!atClose.positions.some((p) => p.openLots.length > 0)) return undefined;
  const datedFrame: ObservationFrame = {
    instrument: { kind: 'Stock', symbol: frame.instrumentKey },
    tradingDate: source.tradingDate,
    closeInstant: source.closeInstant,
    resolution: { kind: 'Available', mark: source.mark },
  };
  return { tradingDate: source.tradingDate, evaluation: evaluate({ state: atClose, frame: datedFrame }) };
}
