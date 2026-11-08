// The data types of the application facade: the single type module the UI imports, since it may
// reach domain code only through src/app (D1 section 2). Fixed for D2 by T2.11.
import type { WorkspaceStatus } from '../coordinators/workspace/index.ts';

// Journal Debt: when an Outstanding Debt falls due against the Review's closes (D5R2 A166).
export type { DueClassification } from '../domain/journal-debt/index.ts';
export type { IncoherentFact } from '../domain/calculation-result/index.ts';

// Workspace: status, initialization, migration, and the Installed Capability Manifest.
export type {
  InitializationReceipt,
  InitializeWorkspace,
  InstalledCapabilityManifest,
  MigrationBlocked,
  MigrationIssue,
  MigrationReceipt,
  MigrationRepair,
  MigrationStage,
  Onboarding,
  ReadyStatus,
  SeedReceipt,
  WorkspaceDurabilityResult,
  WorkspaceInitializationResult,
  WorkspaceStatus,
} from '../coordinators/workspace/index.ts';
// The status a failed migration leaves: the old database unchanged and nothing Ready (D2 P6).
export type MigrationBlockedStatus = Extract<WorkspaceStatus, { readonly kind: 'MigrationBlocked' }>;
// An existing root this release cannot open now, including AwaitingMigration (readiness must be
// Writable before the release converts it) and UnsupportedNewerSchema.
export type IntegrityBlockedStatus = Extract<WorkspaceStatus, { readonly kind: 'IntegrityBlocked' }>;
export type IntegrityBlockedReason = NonNullable<IntegrityBlockedStatus['reason']>;

// Reference Catalog: the Close Reason family the exit form lists (D6).
export type { CloseReasonRecord } from '../modules/reference-catalog/index.ts';

// Trade Workflows: confirmPlan (D1) and recordPositionChange (D2; D6: Sells, the Close Reason and the
// Close Review through `closeReasonId` and `closeReview` on the command and `closeReview`, `lotMatchChanges`
// and `realizedToDate` on the receipt).
export type { ConfirmPlanCommand, ConfirmPlanResult, TradeMutationSuccess, WorkflowIssue } from '../coordinators/trade-workflows/index.ts';
export type {
  DeviationReconciliationItem,
  EntryChange,
  LotMatchChange,
  PositionChangeCommand,
  PositionChangeMember,
  PositionChangeResult,
  PositionChangeSuccess,
  UninstalledVariant,
} from '../coordinators/trade-workflows/index.ts';

// Trade Views and Reporting: the Planned, Open and Closed lists and Trade Detail.
export type {
  // D6: the Closed list and Detail (A95, A96), the Lot Matches and fee reconciliation Open and Closed Detail carry,
  // and the Trade Summary (decision 48) a Closed item and Detail describe what was traded by.
  CloseReasonLabel,
  ClosedCurrentEvaluation,
  ClosedTradeDetail,
  ClosedTradeItem,
  FeeReconciliation,
  IncoherentClosedTradeItem,
  LotMatchView,
  TradeSummary,
  IncoherentOpenTradeItem,
  IncoherentPlannedTradeItem,
  IncoherentTradeDetail,
  OpenTradeDetail,
  OpenTradeItem,
  PlannedTradeDetail,
  PlannedTradeItem,
  ReadViewResult,
  TradeBrowseItem,
  TradeBrowseRequest,
  TradeBrowseView,
  TradeDetailDebt,
  TradeDetailNarrativeItem,
  TradeDetailRequest,
  TradeDetailView,
  ViewBinding,
} from '../coordinators/trade-views/index.ts';
// The lifecycles this release lists and details.
export type TradeLifecycle = 'Planned' | 'Open' | 'Closed';

// Journal: definitions, answers, dispositions, and the Trade narrative with declines.
export type {
  AnswerInput,
  DeclineProjection,
  EntryDefinitionRecord,
  EntryProjection,
  NarrativeAnswer,
  NarrativeDecline,
  NarrativeEntry,
  NarrativeItem,
  PromptDefinition,
  PromptOption,
  ReflectionDisposition,
  // Debt (D5): the Outstanding Debt page, and resolving one by Answer or Decline (P17, A64).
  DebtProjection,
  DebtResolution,
  JournalQuery,
  JournalSaveResult,
  NarrativeDebt,
  NarrativeSettledDebt,
  ObligationOutcome,
  OutstandingDebtPage,
  ResolveDebtCommand,
} from '../modules/journal/index.ts';

// Trade Analysis results carried by the Open views and the Position Change receipt.
export type {
  Attainment,
  CalculationResult,
  ExpirationPayoffs,
  ExpirationPayoffView,
  PayoffExtremum,
  PayoffSegment,
  PayoffZero,
  // D6: how a Closed Trade's exposure ended (never the Close Reason, A84) and each Lot Match's shape.
  DispositionMechanism,
  LotMatch,
  TerminalDisposition,
  EntryFlag,
  EntryQuality,
  EntryQualityFigures,
  EntryResolution,
  ExecutionFact,
  InstrumentPosition,
  IntegrityFinding,
  LegFulfillment,
  LifecycleAgreement,
  LifecycleState,
  OpenLot,
  PlanBaseline,
  PositionChangeFact,
  RecordedDeviation,
  RecordedDeviationVersion,
} from '../domain/trade-analysis/index.ts';

// Market Data (D4): Manual Mark save, point-context frames and sessions, and recovery.
export type {
  ExpectedResolutionRevision,
  FrameContext,
  HistoricalGaps,
  MarkFrame,
  MarketDataIssue,
  MarketDataIssueCode,
  // The Marks panel's entries and what a rejected or conflicted Marks save reports about them (P37, A154).
  MarketDataConflictedKey,
  MarketDataPrepareEntry,
  MarketDataPrepareIssue,
  MarketDataQuery,
  MarketDataQueryResult,
  MarketDataSaveCommand,
  MarketDataSaveResult,
  RecoverDiagnostic,
  RecoverRequest,
  RecoverResult,
  ResolveSessionQuery,
  ResolvedKey,
} from '../modules/market-data/index.ts';
export type { MarkResolution, MarkRevision, ObservationKey, StaleMarkContext } from '../modules/market-data/index.ts';

// Daily Review (D4): open at the latest completed session, one Trade, and the Action save.
export type {
  ActionChoice,
  ActionForm,
  DailyTradeReview,
  GetDailyTradeReviewRequest,
  GetDailyTradeReviewResult,
  IncompleteReason,
  MarkRow,
  OpenDailyReviewRequest,
  OpenDailyReviewResult,
  // Owed reflections inside the walk (D5 P17, A68) and their resolution.
  OwedReflection,
  // The Trades outside the walk with a reflection owed, after it (D6 P20, A89).
  OwedReflectionItem,
  OwedReflectionsTrade,
  // The card of one such Trade (D6 A90).
  OwedReflectionsCard,
  OwedTradeSummary,
  RangePlacement,
  RangePositionResult,
  // The walked Trade's slider figures, unformatted; the slider's own props type is also called SliderFigures.
  SliderFigures as SliderEvaluation,
  CardProgress,
  PanelProgress,
  ReflectionSaveBinding,
  ResolveReviewDebtRequest,
  WalkedTrade,
  PostSaveReview,
  PostMarksReview,
  RefreshedEvidence,
  ReviewBinding,
  ReviewCompletion,
  ReviewFamily,
  ReviewNextStep,
  ReviewProgress,
  ReviewTradeItem,
  SaveDailyReviewRequest,
  SaveDailyReviewResult,
  SavedMark,
  SaveReviewMarksRequest,
  SaveReviewMarksResult,
  SaveTradeActionRequest,
  TradeSaveBinding,
} from '../coordinators/daily-review/index.ts';
