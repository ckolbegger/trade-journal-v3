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
  // D5: every Outstanding Debt, besides the Trade narrative (which now carries Debt).
  'Journal.query': ['TradeNarrative', 'OutstandingDebt'],
  // D5 P17, A64: resolve one Debt by Answer or Decline, from Trade Detail (Source Trade Detail).
  'Journal.save': ['ResolveDebt', 'Answer', 'Decline', 'TradeDetailSource'],
  'TradeWorkflows.confirmPlan': ['LongStock'],
  // D2 A18: opening and increase Buys of a Stock serving its Planned Leg, every member in one
  // Trade, with the Position Change Reflection completed or declined. D5: or deferred.
  'TradeWorkflows.recordPositionChange': ['Opening', 'Increase', 'Stock', 'SingleTrade', 'Complete', 'Decline', 'Defer'],
  // D4: the Open list and Detail carry the current evaluation. D5: Detail carries Debt status and actions.
  'TradeViewsAndReporting.browseTrades': ['Planned', 'Open', 'CurrentEvaluation'],
  'TradeViewsAndReporting.getTradeDetail': ['Planned', 'Open', 'CurrentEvaluation', 'Debt'],
  // D4: Manual Marks, acknowledgments, and withdrawals of Stock Instruments; point-context frames
  // and the session a context names; recovery from stored observations (no provider adapter).
  'MarketData.save': ['RecordInitialManualMark', 'CorrectMark', 'AssertUnavailable', 'WithdrawAcknowledgment', 'Stock'],
  // D5: frames carry the previous session's close.
  'MarketData.query': ['ResolveFrames', 'ResolveSession', 'Current', 'Review', 'Historical', 'PreviousClose'],
  'MarketData.recover': [],
  // D5 P17: owed reflections inside the walk; there is no DailyReview.getDebt.
  'DailyReview.open': ['LatestCompleted', 'OwedReflections'],
  'DailyReview.getTrade': ['OwedReflections'],
  'DailyReview.save': ['SaveTradeAction', 'ResolveReviewDebt'],
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
