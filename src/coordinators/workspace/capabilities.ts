import { SCHEMA_VERSION } from '../../persistence/index.ts';
import type { MarketDataDeps } from '../../modules/market-data/index.ts';
import { BACKUP_FORMAT_VERSION } from './backup-export.ts';

// The identity of the session policy this release was built with (typed from Market Data's deps,
// so no coordinator imports the policy itself: D4 A39).
export type SessionPolicyIdentity = MarketDataDeps['sessionPolicy']['identity'];

// The Workspace schema versions an artifact of one format version may hold, inclusive.
export interface SchemaVersionRange {
  readonly from: number;
  readonly to: number;
}

export interface BackupSchemaRange {
  readonly formatVersion: number;
  // Export writes the schema this release writes; Restore reads every schema it can migrate from.
  readonly export: SchemaVersionRange;
  readonly restore: SchemaVersionRange;
}

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
  // The backup artifact this release writes and reads (D8 A145).
  readonly backupSchemaRange: BackupSchemaRange;
  readonly providerAdapters: readonly string[];
}

// The capability set through D4 (implementation plan, D1, D2, and D4 "Introduces").
const OPERATIONS: Readonly<Record<string, readonly string[]>> = {
  'Workspace.initialize': ['FreshWorkspace', 'ExistingWorkspace'],
  'Workspace.getStatus': [],
  'Workspace.requestDurability': [],
  'ReferenceCatalog.save': ['CreateInstitution', 'CreateAccount'],
  // D6: the four Close Reasons are a Catalog family, listed and resolved like Strategies.
  'ReferenceCatalog.query': ['Institution', 'Account', 'Strategy', 'CloseReason'],
  'ReferenceCatalog.resolve': ['NewSelection', 'DisplayOnly', 'CloseReason'],
  'Journal.getDefinitions': [],
  // D5: every Outstanding Debt, besides the Trade narrative (which now carries Debt).
  'Journal.query': ['TradeNarrative', 'OutstandingDebt'],
  // D5 P17, A64: resolve one Debt by Answer or Decline, from Trade Detail (Source Trade Detail).
  'Journal.save': ['ResolveDebt', 'Answer', 'Decline', 'TradeDetailSource'],
  // D7: a Plan of a single option Leg, with its payoff in the result.
  // D7S A202: a Plan may carry option-price (StructureValue) conditions.
  'TradeWorkflows.confirmPlan': ['LongStock', 'LongCall', 'LongPut', 'CashSecuredPut', 'StructureValueCondition'],
  // D2 A18: opening and increase Buys of a Stock serving its Planned Leg, every member in one
  // Trade, with the Position Change Reflection completed or declined. D5: or deferred.
  // D6: a Sell reduces or closes the Position; the exit that leaves nothing open carries a Close Reason
  // and a Close Review (Source Trade Close), completed, declined or deferred. The Trade Close Source is
  // reached only through these three Close Review variants.
  'TradeWorkflows.recordPositionChange': [
    'Opening',
    'Increase',
    'Stock',
    'SingleTrade',
    'Complete',
    'Decline',
    'Defer',
    'Reduce',
    'Close',
    'Sell',
    'CloseReason',
    'CloseReviewComplete',
    'CloseReviewDecline',
    'CloseReviewDefer',
    // D7: option Executions in both roles, and the Expiration member.
    'Option',
    'SellToOpen',
    'BuyToClose',
    'Expiration',
  ],
  // D4: the Open list and Detail carry the current evaluation. D5: Detail carries Debt status and actions.
  // D6: the Closed list and Detail, which need no Mark.
  'TradeViewsAndReporting.browseTrades': ['Planned', 'Open', 'Closed', 'CurrentEvaluation', 'Option'],
  // D7: the payoff at the single expiration, and the Settlement Due item.
  'TradeViewsAndReporting.getTradeDetail': ['Planned', 'Open', 'Closed', 'CurrentEvaluation', 'Debt', 'ExpirationPayoff', 'SettlementDue'],
  // D08P A212: a Trade's replay by session, its own read (P95).
  'TradeViewsAndReporting.replayTrade': [],
  // D4: Manual Marks, acknowledgments, and withdrawals of Stock Instruments; point-context frames
  // and the session a context names; recovery from stored observations (no provider adapter).
  'MarketData.save': ['RecordInitialManualMark', 'CorrectMark', 'AssertUnavailable', 'WithdrawAcknowledgment', 'Stock', 'Option'],
  // D5: frames carry the previous session's close.
  'MarketData.query': ['ResolveFrames', 'ResolveSession', 'Current', 'Review', 'Historical', 'PreviousClose', 'Option', 'ReadSeries'],
  'MarketData.recover': [],
  // D5 P17: owed reflections inside the walk; there is no DailyReview.getDebt.
  // D5R: the walk carries each Trade's range position and the gap groups' Trades; a card carries the Plan
  // baseline and Reward : risk now (only the Review presents it, P40, A158); SaveReviewMarks saves one
  // card's Marks in one commit. Market Data's prepare and apply pair is an internal seam of that save and
  // is not an operation (P37).
  // D6 P20: the Trades outside the walk with a reflection owed form a group after it, whose cards are the
  // ReflectionsOwed kind; there is still no DailyReview.getDebt.
  'DailyReview.open': ['LatestCompleted', 'OwedReflections', 'RangePosition', 'GapTrades', 'OwedReflectionGroup', 'SettlementFamily'],
  'DailyReview.getTrade': ['OwedReflections', 'PlanBaseline', 'RewardRiskNow', 'ReflectionsOwed', 'ExpirationPayoff', 'SettlementDue'],
  'DailyReview.save': ['SaveTradeAction', 'ResolveReviewDebt', 'SaveReviewMarks'],
  // D8 A145: a backup of a Workspace in normal use (Normal) or of a database a blocked view offers a
  // copy of (BlockedDatabase); its verification; and the two steps of Restore. The fact modules' Restore operations are internal.
  'Workspace.exportBackup': ['Normal', 'BlockedDatabase'],
  'Workspace.confirmBackup': [],
  'Workspace.prepareRestore': [],
  'Workspace.applyPreparedRestore': [],
};

export function installedCapabilities(releaseId: string, sessionPolicy: SessionPolicyIdentity): InstalledCapabilityManifest {
  return {
    releaseId,
    sessionPolicy,
    operations: OPERATIONS,
    strategies: ['strategy.long-stock', 'strategy.long-call', 'strategy.long-put', 'strategy.cash-secured-put'],
    entryTypes: [
      'entry-type.plan-reflection',
      'entry-type.position-change-reflection',
      'entry-type.daily-trade-review',
      'entry-type.close-review',
    ],
    schemaVersion: SCHEMA_VERSION,
    // Export schema 7 in format 1; Restore from schemas 3 through 7 in format 1 (A145 as amended by Q14:
    // schemas 1 and 2 were never used, and their artifacts lack workspace.sessionPolicy).
    backupSchemaRange: { formatVersion: BACKUP_FORMAT_VERSION, export: { from: SCHEMA_VERSION, to: SCHEMA_VERSION }, restore: { from: 3, to: SCHEMA_VERSION } },
    providerAdapters: [],
  };
}
