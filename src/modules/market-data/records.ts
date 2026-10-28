// Market Data records (D4 A36, A38). One observation record per key holds its whole history.

export interface ObservationKey {
  readonly instrumentKey: string;
  readonly tradingDate: string;
}

// The calculation domains a Correction can change; Market Data names them without knowing Trades.
export type CorrectionDomain = 'Valuation' | 'ConditionStatus' | 'Replay';

// What D16, D19, and D24 need to find the work a Correction makes stale (D4 A36).
export interface CorrectionFootprint {
  readonly key: ObservationKey;
  readonly effectDate: string;
  readonly savedAt: string;
  readonly domains: readonly CorrectionDomain[];
  readonly replayInterval: { readonly from: string; readonly to: string };
}

// One immutable Mark revision. For a Manual Mark `observedAt` equals `savedAt` (A36).
export interface MarkRevision {
  readonly revisionId: string;
  readonly revisionNumber: number;
  readonly price: string;
  readonly source: 'Manual';
  readonly intention: 'InitialManual' | 'Correction';
  readonly reason?: string;
  readonly supersedes?: string;
  readonly correctionFootprint?: CorrectionFootprint;
  readonly observedAt: string;
  readonly savedAt: string;
}

// One immutable acknowledgment version: it carries no price. T4.5 writes them.
export interface AcknowledgmentVersion {
  readonly versionId: string;
  readonly kind: 'Asserted' | 'Withdrawn';
  readonly reason?: string;
  readonly savedAt: string;
}

// The stored record of the `observations` store, keyed [tradingDate, instrumentKey].
export interface ObservationRecord extends ObservationKey {
  // The per-key optimistic binding: incremented by every write to this key. A key with no
  // record binds as `None`.
  readonly resolutionRevision: number;
  readonly marks: readonly MarkRevision[];
  // The effective heads: the revision or version that currently decides the key's status.
  readonly effectiveMarkId: string | null;
  readonly acknowledgments: readonly AcknowledgmentVersion[];
  readonly effectiveAcknowledgmentId: string | null;
}

// The latest earlier effective Mark of the same Instrument: disclosed context, never a price (A47).
export interface StaleMarkContext {
  readonly tradingDate: string;
  readonly price: string;
  readonly revisionId: string;
  readonly revisionNumber: number;
  readonly closeInstant: string;
}

// The effective Mark revision as a frame describes it: its provenance comes from Market Data.
export type FrameMark = Pick<MarkRevision, 'revisionId' | 'revisionNumber' | 'price' | 'source' | 'savedAt'> & { readonly correctionReason?: string };

export type MarkResolution =
  | { readonly kind: 'Available'; readonly mark: FrameMark }
  | { readonly kind: 'Missing'; readonly stale?: StaleMarkContext }
  | { readonly kind: 'AcknowledgedUnavailable'; readonly acknowledgment: AcknowledgmentVersion; readonly stale?: StaleMarkContext };

// Resolution precedence (market-data contract): an exact Mark is Available whatever the
// acknowledgment history holds; T4.5 adds the acknowledgment branch before Missing.
export function resolve(record: ObservationRecord | undefined, stale?: StaleMarkContext): MarkResolution {
  const effective = record?.marks.find((m) => m.revisionId === record.effectiveMarkId);
  if (!effective) {
    const acknowledgment = record?.acknowledgments.find((a) => a.versionId === record.effectiveAcknowledgmentId);
    if (acknowledgment?.kind === 'Asserted') return { kind: 'AcknowledgedUnavailable', acknowledgment, ...(stale && { stale }) };
    return { kind: 'Missing', ...(stale && { stale }) };
  }
  const { revisionId, revisionNumber, price, source, savedAt, intention, reason } = effective;
  return {
    kind: 'Available',
    mark: { revisionId, revisionNumber, price, source, savedAt, ...(intention === 'Correction' && reason !== undefined && { correctionReason: reason }) },
  };
}
