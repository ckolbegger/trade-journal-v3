// The data types of the application facade: the single type module the UI imports, since it may
// reach domain code only through src/app (D1 section 2). Fixed for D2 by T2.11.
import type { WorkspaceStatus } from '../coordinators/workspace/index.ts';

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

// Trade Workflows: confirmPlan (D1) and recordPositionChange (D2).
export type { ConfirmPlanCommand, ConfirmPlanResult, TradeMutationSuccess, WorkflowIssue } from '../coordinators/trade-workflows/index.ts';
export type {
  DeviationReconciliationItem,
  EntryChange,
  PositionChangeCommand,
  PositionChangeMember,
  PositionChangeResult,
  PositionChangeSuccess,
  UninstalledVariant,
} from '../coordinators/trade-workflows/index.ts';

// Trade Views and Reporting: the Planned and Open lists and Trade Detail.
export type {
  DebtDueStatus,
  IncoherentFactFinding,
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
export type TradeLifecycle = 'Planned' | 'Open';

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
  CalculationResult,
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
  ReflectionClassification,
  ReflectionCounts,
  ReflectionSaveBinding,
  ResolveReviewDebtRequest,
  WalkedTrade,
  PostSaveReview,
  RefreshedEvidence,
  ReviewBinding,
  ReviewCompletion,
  ReviewFamily,
  ReviewNextStep,
  ReviewProgress,
  ReviewTradeItem,
  SaveDailyReviewRequest,
  SaveDailyReviewResult,
  SaveTradeActionRequest,
  TradeSaveBinding,
} from '../coordinators/daily-review/index.ts';
