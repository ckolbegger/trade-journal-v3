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
  summary: { kind: 'Stock', direction: 'Long', quantity: Rational.of(100n), price: Rational.of(50n) },
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
  summary: { kind: 'Stock', direction: 'Long', quantity: Rational.of(100n), price: Rational.of(50n) },
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

// An Open list item: 60 of 100 shares entered at an average 50.10 with $1.00 of fees.
export const openItem = {
  tradeId: 'trade-2',
  underlying: 'ABC',
  strategy: 'Long Stock',
  account: 'Roth IRA',
  institution: 'Fidelity',
  openQuantity: Rational.of(60n),
  plannedQuantity: Rational.of(100n),
  averageOpenCost: { kind: 'Value', value: Rational.of(501n, 10n) },
  summary: { kind: 'Stock', direction: 'Long', quantity: Rational.of(60n), price: Rational.of(501n, 10n) },
  // 60 x 50.10 plus the $1.00 fee.
  netCost: { kind: 'Value', value: Rational.of(3007n) },
  incurredFees: Rational.of(1n),
  entryStatus: 'Entering',
  deviationCount: 0,
  integrity: 'Agrees',
  lastActivity: '2026-10-13T14:00:00Z',
  // The Expected Mark Date's close is still awaited, so no Mark-dependent figure is a number.
  current: {
    expectedMarkDate: '2026-10-13',
    currentMarkedPnl: { kind: 'Unavailable', reason: 'AwaitingClose', detail: { after: '2026-10-13' } },
    currentMarkedPnlInPlanR: { kind: 'Unavailable', reason: 'AwaitingClose', detail: { after: '2026-10-13' } },
    conditions: [],
    atEntry: null,
  },
} as const;
