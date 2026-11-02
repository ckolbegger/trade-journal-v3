import type { StrategyShape } from '../../domain/strategy.ts';

export type CatalogKind = 'Institution' | 'Account' | 'Strategy' | 'CloseReason';

interface CatalogRecordBase {
  readonly id: string;
  readonly kind: CatalogKind;
  readonly label: string;
  readonly normalizedLabel: string;
  readonly active: boolean;
  readonly origin: 'Seeded' | 'Trader';
  // The record's own revision: 1 at creation, incremented by each later administrative change.
  readonly recordRevision: number;
}

export interface InstitutionRecord extends CatalogRecordBase {
  readonly kind: 'Institution';
}

export interface AccountRecord extends CatalogRecordBase {
  readonly kind: 'Account';
  readonly institutionId: string;
}

export interface StrategyRecord extends CatalogRecordBase {
  readonly kind: 'Strategy';
  readonly productKey: string;
  readonly shape: StrategyShape;
}

// A Close Reason is seeded under a stable product key. Seeded values stay selectable
// (SeededValuesRemainSelectable); only Rolled, from D21, carries the workflow role.
export interface CloseReasonRecord extends CatalogRecordBase {
  readonly kind: 'CloseReason';
  readonly productKey: string;
  readonly policy: 'SeededValuesRemainSelectable';
  readonly role?: 'Rolled';
  // Position in the manifest that seeded it: the family's selection order.
  readonly seedOrder: number;
}

export type CatalogRecord = InstitutionRecord | AccountRecord | StrategyRecord | CloseReasonRecord;

// Labels are compared case-insensitively with surrounding and repeated spaces removed; the
// label text is never identity.
export function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Catalog snapshot: advances with every Catalog change and binds queries, cursors, and saves.
export interface CatalogSnapshot {
  readonly catalogRevision: number;
}
