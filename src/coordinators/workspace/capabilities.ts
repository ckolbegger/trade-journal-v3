import { SCHEMA_VERSION } from '../../persistence/index.ts';
import type { MarketDataDeps } from '../../modules/market-data/index.ts';

// The identity of the session policy this release was built with (typed from Market Data's deps,
// so no coordinator imports the policy itself: D4 A39).
export type SessionPolicyIdentity = MarketDataDeps['sessionPolicy']['identity'];

// The Installed Capability Manifest: what this release installs, bound to its release identity.
// It describes installed code, is not trader data, cannot be toggled, and is not restored.
// Anything not yet delivered is absent rather than reported as Unavailable.
export interface InstalledCapabilityManifest {
  readonly releaseId: string;
  // The session policy this release applies; Market Data is its only importer.
  readonly sessionPolicy: SessionPolicyIdentity;
  // Each complete public operation with its supported variants.
  readonly operations: Readonly<Record<string, readonly string[]>>;
  readonly strategies: readonly string[];
  readonly entryTypes: readonly string[];
  // The Workspace schema version this release writes; older versions migrate to it.
  readonly schemaVersion: number;
  // No backup format is installed before D8.
  readonly backupSchemaRange: null;
  readonly providerAdapters: readonly string[];
}

// The capability set through D4 (implementation plan, D1, D2, and D4 "Introduces").
const OPERATIONS: Readonly<Record<string, readonly string[]>> = {
  'Workspace.initialize': ['FreshWorkspace', 'ExistingWorkspace'],
  'Workspace.getStatus': [],
  'Workspace.requestDurability': [],
  'ReferenceCatalog.save': ['CreateInstitution', 'CreateAccount'],
  'ReferenceCatalog.query': ['Institution', 'Account', 'Strategy'],
  'ReferenceCatalog.resolve': ['NewSelection', 'DisplayOnly'],
  'Journal.getDefinitions': [],
  'Journal.query': ['TradeNarrative'],
  'TradeWorkflows.confirmPlan': ['LongStock'],
  // D2 A18: opening and increase Buys of a Stock serving its Planned Leg, every member in one
  // Trade, with the Position Change Reflection completed or declined.
  'TradeWorkflows.recordPositionChange': ['Opening', 'Increase', 'Stock', 'SingleTrade', 'Complete', 'Decline'],
  // D4: the Open list and Detail carry the current evaluation.
  'TradeViewsAndReporting.browseTrades': ['Planned', 'Open', 'CurrentEvaluation'],
  'TradeViewsAndReporting.getTradeDetail': ['Planned', 'Open', 'CurrentEvaluation'],
  // D4: Manual Marks, acknowledgments, and withdrawals of Stock Instruments; point-context frames
  // and the session a context names; recovery from stored observations (no provider adapter).
  'MarketData.save': ['RecordInitialManualMark', 'CorrectMark', 'AssertUnavailable', 'WithdrawAcknowledgment', 'Stock'],
  'MarketData.query': ['ResolveFrames', 'ResolveSession', 'Current', 'Review', 'Historical'],
  'MarketData.recover': [],
  'DailyReview.open': ['LatestCompleted'],
  'DailyReview.getTrade': [],
  'DailyReview.save': ['SaveTradeAction'],
};

export function installedCapabilities(releaseId: string, sessionPolicy: SessionPolicyIdentity): InstalledCapabilityManifest {
  return {
    releaseId,
    sessionPolicy,
    operations: OPERATIONS,
    strategies: ['strategy.long-stock'],
    entryTypes: ['entry-type.plan-reflection', 'entry-type.position-change-reflection', 'entry-type.daily-trade-review'],
    schemaVersion: SCHEMA_VERSION,
    backupSchemaRange: null,
    providerAdapters: [],
  };
}
