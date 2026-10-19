// Read-model fixtures for the Planned list and Trade Detail UI tests.
import { Rational } from '../../src/domain/values/index.ts';

export const plannedItem = {
  tradeId: 'trade-1',
  underlying: 'XYZ',
  strategy: 'Long Stock',
  account: 'Roth IRA',
  institution: 'Fidelity',
  planTime: '2026-10-12T13:30:00Z',
  oneR: Rational.of(250n),
  originalPlannedReward: Rational.of(600n),
  rewardRiskRatio: Rational.of(12n, 5n),
  entryReadiness: 'Awaiting entry',
} as const;

export const plannedDetail = {
  tradeId: 'trade-1',
  factRevision: 1,
  plan: {
    underlying: 'XYZ',
    planTime: '2026-10-12T13:30:00Z',
    thesis: 'Breakout above the 50-day.',
    invalidation: 'A close below 48.',
    legs: [{ factId: 'f-2', side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50' }],
    stops: [{ factId: 'f-3', kind: 'UnderlyingPrice', price: '47.5' }],
    targets: [{ factId: 'f-4', kind: 'UnderlyingPrice', price: '56' }],
  },
  lifecycle: { stored: 'Planned', agreement: { kind: 'Agrees' } },
  baseline: {
    originalPlannedRisk: Rational.of(250n),
    originalPlannedReward: Rational.of(600n),
    rewardRiskRatio: Rational.of(12n, 5n),
    oneR: Rational.of(250n),
    stopBasis: [{ condition: { kind: 'UnderlyingPrice', price: '47.5' }, distance: Rational.of(250n) }],
    targetBasis: [{ condition: { kind: 'UnderlyingPrice', price: '56' }, distance: Rational.of(600n) }],
  },
  labels: { strategy: 'Long Stock', account: 'Roth IRA', institution: 'Fidelity' },
  journal: [
    {
      id: 'e-1',
      entryType: 'Plan Reflection',
      source: 'Plan Confirmation',
      anchor: { kind: 'Trade', tradeId: 'trade-1' },
      momentTime: '2026-10-12T13:30:00Z',
      authoredTime: '2026-10-12T14:05:00Z',
      responses: [
        { prompt: 'Why this trade, why now?', answer: { kind: 'Text', text: 'Breakout above the 50-day.' } },
        { prompt: 'What would invalidate the thesis?', answer: { kind: 'Text', text: 'A close below 48.' } },
        { prompt: 'Conviction', answer: { kind: 'Scale', value: 4 } },
        { prompt: 'Primary emotion', answer: { kind: 'Option', label: 'Calm' } },
      ],
    },
  ],
} as const;
