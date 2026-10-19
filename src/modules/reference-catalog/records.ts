import type { StrategyShape } from '../../domain/strategy.ts';

export type CatalogKind = 'Institution' | 'Account' | 'Strategy';

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

export type CatalogRecord = InstitutionRecord | AccountRecord | StrategyRecord;

// Labels are compared case-insensitively with surrounding and repeated spaces removed; the
// label text is never identity.
export function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Catalog snapshot: advances with every Catalog change and binds queries, cursors, and saves.
export interface CatalogSnapshot {
  readonly catalogRevision: number;
}
