// A facade test double for UI unit tests: every operation is a vi.fn with a Ready default.
import { vi } from 'vitest';
import type { UiFacade } from '../../src/app/compose.ts';
import { nyseSessionPolicy } from '../../src/domain/session-policy/index.ts';
import { installedCapabilities } from '../../src/coordinators/workspace/index.ts';

const passed = { passed: true } as const;
export const writableReadiness = {
  outcome: 'Writable',
  failures: [],
  protection: 'BestEffort',
  checks: { diagnostic: passed, capacity: passed, control: passed, inventory: passed },
} as const;

export function readyStatus(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'Ready',
    observedAt: '2026-10-12T14:05:00Z',
    binding: { databaseName: 'tj-ws-1', contentRevision: 3 },
    timeZone: 'America/New_York',
    onboarding: 'ReadyForTradePlanning',
    installedCapabilities: installedCapabilities('release-1', nyseSessionPolicy.identity),
    readiness: writableReadiness,
    protection: 'Protected',
    schemaVersion: 1,
    latestReceipt: null,
    ...overrides,
  };
}

export function facadeDouble(overrides: { status?: unknown } = {}): UiFacade {
  return {
    capabilities: installedCapabilities('release-1', nyseSessionPolicy.identity),
    Workspace: {
      initialize: vi.fn(),
      getStatus: vi.fn(() => Promise.resolve(overrides.status ?? readyStatus())),
      requestDurability: vi.fn(),
    },
    ReferenceCatalog: { save: vi.fn(), query: vi.fn(() => Promise.resolve({ kind: 'Page', items: [], snapshot: { catalogRevision: 1 } })), resolve: vi.fn() },
    Journal: { getDefinitions: vi.fn(), query: vi.fn(), save: vi.fn() },
    TradeWorkflows: { confirmPlan: vi.fn(), recordPositionChange: vi.fn() },
    TradeViewsAndReporting: { browseTrades: vi.fn(), getTradeDetail: vi.fn() },
    MarketData: { save: vi.fn(), query: vi.fn(), recover: vi.fn() },
    DailyReview: { open: vi.fn(), getTrade: vi.fn(), save: vi.fn() },
  } as unknown as UiFacade;
}
