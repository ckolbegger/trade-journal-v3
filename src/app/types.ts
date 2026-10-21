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
  OpenTradeDetail,
  OpenTradeItem,
  PlannedTradeDetail,
  PlannedTradeItem,
  ReadViewResult,
  TradeBrowseItem,
  TradeBrowseRequest,
  TradeBrowseView,
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
