import { ContextPanel } from './ContextPanel';
import { DebtForm, type DebtDraft } from './DebtForm';
import type { JournalObligation } from '../domain/journal/position-change-types';
import { OpeningForm, type OpeningDraft } from './OpeningForm';
import type { Journal, JournalQuery } from '../domain/journal';
import type { positionChangeDefinition } from '../domain/journal/position-change-types';
import type { derive } from '../domain/trade-analysis';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Decimal from 'decimal.js';
import { Temporal } from '@js-temporal/polyfill';
import type { Workspace } from '../application/workspace';
import type { ReferenceCatalog, CatalogRecord } from '../domain/reference-catalog';
import type { TradeWorkflows } from '../application/trade-workflows';
import type { TradeViewsAndReporting } from '../application/trade-views-and-reporting';
import type { Root } from '../infrastructure/storage';
import type { TradeSnapshot } from '../domain/trade-record';
import type { JournalEntry, planDefinition } from '../domain/journal';
import styles from './App.module.css';
export interface Services { workspace: Workspace; catalog: ReferenceCatalog; workflows: TradeWorkflows; views: TradeViewsAndReporting; journal: Journal }
interface Detail { analysis?: ReturnType<typeof derive>; journal?: JournalQuery; binding?: { generation?: string; workspaceRevision?: string; catalogRevision?: string };  trade: TradeSnapshot; entries: JournalEntry[]; history: TradeSnapshot[]; labels: { account?: string; institution?: string; strategy?: string } }
const emptyPlan = { symbol: '', quantity: '', entry: '', stop: '', target: '', thesis: '', invalidation: '', conviction: '', emotion: '' };
const issueMessages: Record<string, string> = {
  CompletePlannedQuantityRequired: 'Executions must total exactly the frozen planned quantity.',
  PositiveExecutionQuantityRequired: 'Enter a quantity greater than zero for every Execution.',
  NonnegativeExecutionPriceRequired: 'Enter a valid nonnegative USD price for every Execution.',
  NonnegativeExecutionFeeRequired: 'Enter the actual nonnegative USD fee for every Execution.',
  InvalidExecutionTime: 'Enter valid ISO 8601 instants with an offset for the decision and every Execution.',
  InvalidPositionChangeTime: 'Enter a valid ISO 8601 decision instant with an offset.',
  EntryBeforePlan: 'Initial entry cannot precede the confirmed Plan.',
  'decision-mode:Required': 'Choose the decision mode, or explicitly Defer or Decline the reflection.',
  'emotion:Required': 'Choose the primary emotion.', 'confidence:Required': 'Choose decision confidence from 1 to 5.',
  TradeChanged: 'This Trade changed in another tab. Review the current Trade before saving again.',
  InitialStockEntryRequiresPlannedTrade: 'This Trade already has an initial entry. No additional Executions were recorded.',
  MigrationRequired: 'This update could not finish migrating the Workspace. Retained history is readable; writing is disabled. Retry startup when the migration problem is resolved.',
  TimeZoneRequired: 'Enter a rules-based time zone, such as America/New_York.',
  ExactStockRequired: 'Enter an exact USD Stock symbol.', PositiveQuantityRequired: 'Enter a quantity greater than zero.',
  ThesisRequired: 'Explain why this trade, why now.', InvalidationRequired: 'Explain what would invalidate the thesis.',
  InvalidEntry: 'Enter a valid nonnegative intended entry.', InvalidStop: 'Enter a valid nonnegative Stop price.', InvalidTarget: 'Enter a valid nonnegative Target price.',
  PositiveRiskRequired: 'Stop must be below intended entry so Planned risk is positive.', ForwardRewardRequired: 'Target must be above intended entry.',
  InvalidConviction: 'Choose a Conviction from 1 to 5, or leave it unanswered.', UnknownEmotion: 'Choose a listed emotion, or leave it unanswered.',
  CatalogChanged: 'Brokerage records changed in another tab. Review your selections before confirming again.', WorkspaceChanged: 'The Workspace changed. Review current references before confirming again.',
  DefinitionChanged: 'Plan Reflection changed. Reopen the form before confirming again.', GenerationChanged: 'The active Workspace changed. Retry startup before saving.',
  LabelRequired: 'Enter a name.', DuplicateLabel: 'That name is already in use.', SelectableInstitutionRequired: 'Choose an available Institution.', SelectableAccountRequired: 'Choose an available Account.', SelectableLongStockRequired: 'The Long Stock Strategy is not available for this Plan.',
  transaction: 'Browser storage could not complete a test transaction.', capacity: 'This browser does not have the required available storage capacity.',
  control: 'The verified application is not controlling this tab.', inventory: 'The offline application files are missing or damaged.',
  UnreadableRoot: 'This browser could not read the existing Workspace. Its data has not been replaced.', InvalidRoot: 'This Workspace could not be validated. Its data has not been replaced.',
  UnsupportedSchema: 'This Workspace needs a newer application version. Its data has not been changed.',
  StorageFailure: 'Saving failed. Nothing was recorded. Your entered values are preserved. Retry startup before saving again.',
};
const fieldIssues: Partial<Record<keyof typeof emptyPlan, string[]>> = { symbol: ['ExactStockRequired'], quantity: ['PositiveQuantityRequired'], entry: ['InvalidEntry'], stop: ['InvalidStop', 'PositiveRiskRequired'], target: ['InvalidTarget', 'ForwardRewardRequired'], thesis: ['ThesisRequired'], invalidation: ['InvalidationRequired'] };
function quotientText(value: { numerator: string; denominator: string }, places?: number) { const display = new Decimal(value.numerator).div(value.denominator); return places === undefined ? display.toSignificantDigits(12).toString() : display.toFixed(places, Decimal.ROUND_HALF_EVEN); }
function money(value: string) { return `$${new Decimal(value).toFixed(2, Decimal.ROUND_HALF_EVEN)}`; }
export interface Delivery { getUpdate(): Promise<{ available: boolean; release?: string }>; activateUpdate(): Promise<string | void> }
export function App({ services, delivery }: { services: Services; delivery?: Delivery }) {
  const [debtReturnRoute, setDebtReturnRoute] = useState('Journal Debt');
  const [debtPage, setDebtPage] = useState<JournalQuery>();
  const [debtError, setDebtError] = useState(false);
  const [debtDrafts, setDebtDrafts] = useState<Record<string, DebtDraft>>({});
  const [selectedDebtId, setSelectedDebtId] = useState('');
  const [debtOutcome, setDebtOutcome] = useState<Extract<Awaited<ReturnType<Journal['save']>>, { status: 'Saved' }>>();
  const [openingDefinition, setOpeningDefinition] = useState<typeof positionChangeDefinition>();
  const [openingDrafts, setOpeningDrafts] = useState<Record<string, OpeningDraft>>({});
  const [lifecycle, setLifecycle] = useState<'Planned' | 'Open'>('Planned');
  const [planStage, setPlanStage] = useState(1);
  const [planDirty, setPlanDirty] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [phase, setPhase] = useState('Loading');
  const [root, setRoot] = useState<Root>();
  const [records, setRecords] = useState<CatalogRecord[]>([]);
  const [definition, setDefinition] = useState<typeof planDefinition>();
  const [catalogRevision, setCatalogRevision] = useState('');
  const [timeZone, setTimeZone] = useState('');
  const [institution, setInstitution] = useState('');
  const [account, setAccount] = useState('');
  const dirty = planDirty || Object.keys(openingDrafts).length > 0 || Object.keys(debtDrafts).length > 0 || institution !== '' || account !== '';
  const [parentId, setParentId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [route, setRoute] = useState('Trades');
  const [plan, setPlan] = useState(emptyPlan);
  const [issues, setIssues] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [protection, setProtection] = useState('BestEffort');
  const [detail, setDetail] = useState<Detail>();
  const [pageCursor, setPageCursor] = useState<string>();
  const [page, setPage] = useState<Awaited<ReturnType<TradeViewsAndReporting['browseTrades']>>>();
  const [saving, setSaving] = useState(false);
  const browseRequest = useRef(0);
  const errorHeading = useRef<HTMLHeadingElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  async function open(zone?: string) {
    setPhase('Loading'); setIssues([]);
    try {
      const readiness = await services.workspace.getStatus();
      if (readiness.status !== 'Writable') {
        if ('recovery' in readiness && readiness.recovery.root) {
          setReadOnly(true); setRoot(readiness.recovery.root); setRecords(readiness.recovery.catalog.records); setDefinition(readiness.recovery.definition); setCatalogRevision(readiness.recovery.root.catalogRevision); setPage(await services.views.browseTrades()); setPhase('Ready'); setIssues(readiness.failedChecks); return;
        }
        setIssues(readiness.failedChecks); setPhase(readiness.workspaceStatus === 'IntegrityBlocked' ? 'IntegrityBlocked' : readiness.runtimeReadiness); return; }
      setProtection(readiness.protection);
      const result = await services.workspace.initialize({ openingInstant: new Date().toISOString(), timeZone: zone });
      if (result.status === 'Opened') {
        setOpeningDefinition(await services.journal.getDefinitions('PositionChange')); setRoot(result.root); setRecords(result.catalog.records); setDefinition(result.definition); setCatalogRevision(result.root.catalogRevision);
        setParentId(result.catalog.records.find(record => record.kind === 'Institution')?.id ?? '');
        setAccountId(result.catalog.records.find(record => record.kind === 'Account')?.id ?? '');
        setPage(await services.views.browseTrades()); setReadOnly(false); setPhase('Ready');
      } else if ('recovery' in result && result.recovery) {
        setReadOnly(true); setRoot(result.recovery.root); setRecords(result.recovery.catalog.records); setDefinition(result.recovery.definition); setCatalogRevision(result.recovery.root.catalogRevision); setPage(await services.views.browseTrades({ lifecycle })); setIssues(['MigrationRequired']); setPhase('Ready');
      } else { setPhase(result.status); if (result.status === 'TimeZoneSelectionRequired' && zone !== undefined) setIssues(['TimeZoneRequired']); else if ('failedChecks' in result) setIssues(result.failedChecks); }
    } catch { setPhase('Error'); setIssues(['Startup could not be verified. Your data has not been replaced.']); }
  }
  useEffect(() => { void open(); }, []);
  async function checkUpdate() { if (delivery) setUpdateAvailable((await delivery.getUpdate()).available); }
  useEffect(() => {
    if (!delivery) return;
    const timer = setInterval(() => { void checkUpdate(); }, 10000);
    return () => clearInterval(timer);
  }, [delivery]);
  useEffect(() => { heading.current?.focus(); }, [route, phase]);
  useEffect(() => { if (issues.length) errorHeading.current?.focus(); }, [issues]);
  async function browse(cursor?: string, selected: 'Planned' | 'Open' = lifecycle) {
    const request = ++browseRequest.current;
    setPageCursor(cursor); setLifecycle(selected); setIssues([]); setRoute('Trades'); setPage(undefined);
    const result = await services.views.browseTrades({ cursor, lifecycle: selected });
    if (request === browseRequest.current) setPage(result);
  }
  async function saveReference(event: FormEvent, kind: 'Institution' | 'Account') {
    event.preventDefault(); if (!root) return; setSaving(true); setIssues([]);
    try {
      const result = await services.catalog.save({ kind, label: kind === 'Institution' ? institution : account, parentId: kind === 'Account' ? parentId : undefined, generation: root.generation, expectedCatalogRevision: catalogRevision });
      if (result.status === 'Saved') { setRecords(previous => [...previous, result.record]); setCatalogRevision(result.catalogRevision); if (kind === 'Institution') { setParentId(result.record.id); setInstitution(''); } else { setAccountId(result.record.id); setAccount(''); setRoute('Trades'); setMessage('Account saved. You can now confirm a Plan.'); } }
      else {
        if (result.status === 'StorageFailure') setReadOnly(true);
        if (result.status === 'RuntimeNotWritable') {
          if (result.runtimeReadiness === 'RecoveryOnly') setReadOnly(true);
          else setPhase(result.workspaceStatus === 'IntegrityBlocked' ? 'IntegrityBlocked' : 'Unsupported');
        }
        setIssues('issues' in result ? result.issues ?? [] : 'failedChecks' in result ? result.failedChecks : 'reason' in result ? [result.reason] : [result.status]);
      }
    } finally { setSaving(false); }
  }
  async function confirm(event: FormEvent) {
    event.preventDefault(); if (!root || !definition || saving) return; if (planStage === 1) { setPlanStage(2); return; } setSaving(true); setMessage(''); setIssues([]);
    try {
      const result = await services.workflows.confirmPlan({ generation: root.generation, expectedCatalogRevision: catalogRevision, definitionRevision: definition.revision, accountId, strategyId: 'long-stock', economicTime: new Date().toISOString(), plan: { instrument: { kind: 'Stock', symbol: plan.symbol.trim().toUpperCase(), currency: 'USD' }, quantity: plan.quantity, entry: plan.entry, stop: plan.stop, target: plan.target }, reflection: { thesis: plan.thesis, invalidation: plan.invalidation, conviction: plan.conviction, emotion: plan.emotion } });
      if (result.status === 'Confirmed') { setRoot({ ...root, revision: result.workspaceRevision }); setPlanDirty(false); setPlanStage(1); setDetail({ trade: result.trade, entries: [result.entry], history: [result.trade], labels: result.labels }); setRoute('Detail'); setPlan(emptyPlan); setMessage('Plan confirmed and saved on this device.'); }
      else {
        if (result.status === 'StorageFailure') setReadOnly(true);
        if (result.status === 'RuntimeNotWritable') {
          if (result.runtimeReadiness === 'RecoveryOnly') setReadOnly(true);
          else setPhase(result.workspaceStatus === 'IntegrityBlocked' ? 'IntegrityBlocked' : 'Unsupported');
        }
        setIssues('issues' in result ? result.issues ?? [] : 'failedChecks' in result ? result.failedChecks : 'reason' in result ? [result.reason] : [result.status]);
      }
    } catch { setIssues(['Save failed. Your entered values are preserved. Retry after checking readiness.']); }
    finally { setSaving(false); }
  }
  async function showTrade(tradeId: string) {
    const result = await services.views.getTradeDetail(tradeId);
    if (result.status === 'Ready') { setDetail({ ...result, analysis: { ...result, status: 'Derived' } }); setRoot(previous => previous ? { ...previous, revision: result.binding.workspaceRevision ?? previous.revision, generation: result.binding.generation ?? previous.generation, catalogRevision: result.binding.catalogRevision ?? previous.catalogRevision } : previous); setRoute('Detail'); }
    else setIssues([result.status]);
  }
  function startOpening() {
    if (!detail || !root || !openingDefinition) return;
    const trade = detail.trade; const now = new Date().toISOString();
    if (!openingDrafts[trade.tradeId]) setOpeningDrafts(previous => ({ ...previous, [trade.tradeId]: { definition: openingDefinition, rowIds: [crypto.randomUUID()], answers: { 'decision-mode': '', emotion: '', confidence: '', note: '' }, command: { kind: 'InitialStockEntry', generation: root.generation, expectedWorkspaceRevision: detail.binding?.workspaceRevision ?? root.revision, expectedCatalogRevision: detail.binding?.catalogRevision ?? catalogRevision, tradeId: trade.tradeId, expectedTradeRevision: trade.revision, plannedLegId: trade.plannedLegId, definitionRevision: openingDefinition.revision, economicTime: now, executions: [{ instrument: { kind: 'Stock', symbol: trade.plan.instrument?.symbol ?? '', currency: 'USD' }, action: 'Buy', quantity: '', price: '', fee: '0', economicTime: now, plannedLegId: trade.plannedLegId }], reflection: { kind: 'Defer' } } } }));
    setIssues(openingDrafts[trade.tradeId]?.issues ?? []); setMessage(''); setRoute('Opening');
  }
  async function saveOpening(event: FormEvent) {
    event.preventDefault(); if (!detail || !root || saving) return;
    const draft = openingDrafts[detail.trade.tradeId]; if (!draft) return;
    setSaving(true); setIssues([]); setMessage('');
    try {
      const result = await services.workflows.recordPositionChange(draft.command);
      if (result.status === 'Recorded') {
        const prior = detail.journal;
        setDetail({ trade: result.trade, labels: result.labels, entries: result.journalOutcome.entry ? [...detail.entries, result.journalOutcome.entry] : detail.entries, history: [...detail.history, result.trade], analysis: result.derivation, journal: { status: 'Ready', generation: root.generation, workspaceRevision: result.workspaceRevision, entries: result.journalOutcome.entry ? [...detail.entries, result.journalOutcome.entry] : detail.entries, obligations: [...(prior?.obligations ?? []), result.journalOutcome.obligation], obligationHistory: [...(prior?.obligationHistory ?? []), result.journalOutcome.obligation], declines: result.journalOutcome.decline ? [...(prior?.declines ?? []), result.journalOutcome.decline] : prior?.declines ?? [] }, binding: { generation: root.generation, workspaceRevision: result.workspaceRevision, catalogRevision: draft.command.expectedCatalogRevision } });
        setRoot({ ...root, revision: result.workspaceRevision }); setOpeningDrafts(previous => { const next = { ...previous }; delete next[result.trade.tradeId]; return next; }); setRoute('Detail'); setMessage(`Opening entry saved · ${result.trade.opening?.executions.length ?? 0} Executions`);
      } else {
        if (result.status === 'StorageFailure' || result.status === 'RuntimeNotWritable') setReadOnly(true);
        if (result.status === 'RuntimeNotWritable' && result.runtimeReadiness === 'Unsupported') setPhase(result.workspaceStatus === 'IntegrityBlocked' ? 'IntegrityBlocked' : 'Unsupported');
        const missingFields = Object.fromEntries(draft.rowIds.map((id, index) => [id, (['quantity', 'price'] as const).filter(key => !draft.command.executions[index]?.[key].trim())]));
        const rejectedIssues = ('issues' in result ? result.issues : 'failedChecks' in result ? result.failedChecks : 'findings' in result ? result.findings : 'reason' in result ? [result.reason] : [result.status]) ?? [result.status];
        setIssues(rejectedIssues); setOpeningDrafts(previous => ({ ...previous, [draft.command.tradeId]: { ...draft, issues: rejectedIssues, missingFields } }));
      }
    } catch { setIssues(['StorageFailure']); setOpeningDrafts(previous => ({ ...previous, [draft.command.tradeId]: { ...draft, issues: ['StorageFailure'] } })); setReadOnly(true); }
    finally { setSaving(false); }
  }
  async function reviewOpening() {
    if (!detail) return;
    const result = await services.views.getTradeDetail(detail.trade.tradeId);
    if (result.status !== 'Ready' || !result.binding.generation || !result.binding.workspaceRevision || !result.binding.catalogRevision) { setIssues([result.status]); return; }
    const binding = result.binding;
    setDetail({ ...result, analysis: { ...result, status: 'Derived' } });
    setOpeningDrafts(previous => { const draft = previous[result.trade.tradeId]; return draft ? { ...previous, [result.trade.tradeId]: { ...draft, command: { ...draft.command, generation: binding.generation ?? draft.command.generation, expectedWorkspaceRevision: binding.workspaceRevision ?? draft.command.expectedWorkspaceRevision, expectedCatalogRevision: binding.catalogRevision ?? draft.command.expectedCatalogRevision, expectedTradeRevision: result.trade.revision } } } : previous; });
    setIssues([]); setMessage(result.trade.lifecycle === 'Planned' ? 'Current Trade reviewed. Your entered Executions are preserved; review and Save again.' : 'This Trade is already Open. Your unsaved Executions have not been recorded. Cancel to inspect the saved Trade.');
  }
  async function reviewDebt() {
    const draft = debtDrafts[selectedDebtId]; if (!draft) return;
    try {
      const current = await services.journal.query({ obligationId: draft.obligation.id, scope: 'History' });
      const obligation = current.obligations[0];
      if (!obligation || !current.generation || !current.workspaceRevision) { setIssues(['The original Debt could not be resolved. Retry startup before saving.']); return; }
      setDebtDrafts(previous => ({ ...previous, [selectedDebtId]: { ...draft, obligation, generation: current.generation ?? draft.generation, workspaceRevision: current.workspaceRevision ?? draft.workspaceRevision } }));
      setIssues([]); setMessage(obligation.status === 'Outstanding' ? 'Current Debt reviewed. Your answers are preserved; review and Save again.' : 'This obligation was already settled in another tab. Your unsaved answers have not been recorded.');
    } catch { setIssues(['Journal Debt could not be read. Retry before saving.']); }
  }
  async function showDebtQueue() {
    setRoute('Journal Debt'); setDebtPage(undefined); setDebtError(false); setIssues([]);
    try { setDebtPage(await services.journal.query({ scope: 'Outstanding' })); } catch { setDebtError(true); }
  }
  function beginDebt(obligation: JournalObligation, binding = { generation: debtPage?.generation ?? root?.generation, workspaceRevision: debtPage?.workspaceRevision ?? root?.revision }) {
    if (!binding.generation || !binding.workspaceRevision) return;
    const generation = binding.generation; const workspaceRevision = binding.workspaceRevision;
    setDebtDrafts(previous => previous[obligation.id] ? previous : { ...previous, [obligation.id]: { obligation, generation, workspaceRevision, answers: { 'decision-mode': '', emotion: '', confidence: '', note: '' }, disposition: 'Complete', reason: '' } });
    setDebtReturnRoute(['Detail', 'Trade Journal'].includes(route) ? 'Detail' : 'Journal Debt'); setSelectedDebtId(obligation.id); setIssues(debtDrafts[obligation.id]?.issues ?? []); setMessage(''); setRoute('Answer Journal Debt');
  }
  async function saveDebt(event: FormEvent) {
    event.preventDefault(); const draft = debtDrafts[selectedDebtId]; if (!draft || saving) return;
    setSaving(true); setIssues([]); setMessage('');
    try {
      const result = await services.journal.save({ kind: 'ResolveDebt', generation: draft.generation, expectedWorkspaceRevision: draft.workspaceRevision, obligationId: draft.obligation.id, expectedRevision: draft.obligation.revision, disposition: draft.disposition === 'Complete' ? { kind: 'Complete', answers: draft.answers } : { kind: 'Decline', reason: draft.reason } });
      if (result.status === 'Saved') {
        setDebtOutcome(result); setRoot(previous => previous ? { ...previous, revision: result.workspaceRevision } : previous);
        setDebtDrafts(previous => { const next = { ...previous }; delete next[selectedDebtId]; return next; }); setRoute('Debt outcome');
        setMessage(result.entry ? 'Reflection completed. Journal Debt settled.' : 'Reflection explicitly declined. Journal Debt settled.');
      } else {
        if (result.status === 'StorageFailure' || result.status === 'RuntimeNotWritable') setReadOnly(true);
        if (result.status === 'RuntimeNotWritable' && result.runtimeReadiness === 'Unsupported') setPhase(result.workspaceStatus === 'IntegrityBlocked' ? 'IntegrityBlocked' : 'Unsupported');
        const rejectedIssues = 'issues' in result ? result.issues : 'failedChecks' in result ? result.failedChecks : 'reason' in result ? [result.reason ?? result.status] : result.status === 'NeedsTradeWorkflow' ? [`Resolve this Debt through ${result.route.operation} for Trade ${result.route.tradeId}.`] : [result.status];
        setIssues(rejectedIssues); setDebtDrafts(previous => ({ ...previous, [selectedDebtId]: { ...draft, issues: rejectedIssues } }));
      }
    } catch { setIssues(['StorageFailure']); setDebtDrafts(previous => ({ ...previous, [selectedDebtId]: { ...draft, issues: ['StorageFailure'] } })); setReadOnly(true); }
    finally { setSaving(false); }
  }
  const accounts = records.filter(record => record.kind === 'Account' && record.active);
  const institutions = records.filter(record => record.kind === 'Institution' && record.active);
  function displayInstant(instant: string) {
    const zone = root?.timeZone ?? 'UTC';
    return `${Temporal.Instant.from(instant).toZonedDateTimeISO(zone).toPlainDateTime().toString().replace('T', ' ')} ${zone}`;
  }
  function textField(key: keyof typeof plan, label: string, multiline = false) {
    const invalid = fieldIssues[key]?.some(issue => issues.includes(issue)) ?? false;
    const validation = { 'aria-required': true, 'aria-invalid': invalid, 'aria-describedby': invalid ? 'plan-issues' : undefined } as const;
    return <label key={key}>{label}{multiline ? <textarea {...validation} value={plan[key]} onChange={event => setPlan({ ...plan, [key]: event.target.value })} /> : <input {...validation} value={plan[key]} onChange={event => setPlan({ ...plan, [key]: event.target.value })} inputMode={['quantity', 'entry', 'stop', 'target'].includes(key) ? 'decimal' : 'text'} />}</label>;
  }
  if (phase === 'Loading') return <main className={styles.startup}><h1>Trade Journal</h1><p role="status">Verifying startup and local storage…</p></main>;
  if (phase === 'TimeZoneSelectionRequired') return <main className={styles.startup}><h1 ref={heading} tabIndex={-1}>Your device-local Workspace</h1><p>Choose a rules-based time zone. This journal stays in this browser on this device.</p><form className={styles.card} onSubmit={event => { event.preventDefault(); if (!timeZone.trim()) { setIssues(['TimeZoneRequired']); return; } void open(timeZone); }}><label>Workspace time zone<input value={timeZone} aria-invalid={issues.length > 0 || undefined} aria-describedby={issues.length ? 'time-zone-error' : undefined} placeholder="e.g. America/New_York" onChange={event => setTimeZone(event.target.value)} /></label><button>Create Workspace</button></form>{issues.length > 0 && <div role="alert" id="time-zone-error"><h2 ref={errorHeading} tabIndex={-1}>Choose your time zone</h2>{issues.map(issue => <p key={issue}>{issueMessages[issue] ?? issue}</p>)}</div>}</main>;
  if (phase !== 'Ready') return <main className={styles.startup}><h1 ref={heading} tabIndex={-1}>{phase}</h1><p>We could not verify safe writing in this environment.</p><ul>{issues.map(issue => <li key={issue} data-issue={issue}>{issueMessages[issue] ?? issue}</li>)}</ul><button onClick={() => void open()}>Retry startup</button>{phase === 'Unsupported' && <p>Try another browser that meets the readiness requirements.</p>}<p>Another browser has separate storage and does not transfer this Workspace. Backup and Restore are not installed in this release.</p></main>;
  const errorSummary = issues.length > 0 && <div role="alert" id="plan-issues" className={styles.errors}><h2 ref={errorHeading} tabIndex={-1}>Review before continuing</h2>{['Opening', 'Answer Journal Debt'].includes(route) && <p>Nothing saved. Your draft is preserved.</p>}<ul>{route === 'Opening' && detail && openingDrafts[detail.trade.tradeId]?.rowIds.map((id, index) => { const missing = openingDrafts[detail.trade.tradeId]?.missingFields?.[id] ?? []; return missing.length ? <li key={id}><p>Nothing saved — Execution {index + 1} needs a {missing.join(' and ')}</p>{missing.map(key => <button key={key} type="button" onClick={() => document.getElementById(`execution-${id}-${key}`)?.focus()}>Go to Execution {index + 1} {key}</button>)}</li> : null; })}{issues.map(issue => <li key={issue} data-issue={issue}>{issueMessages[issue] ?? issue}</li>)}</ul>{route === 'Answer Journal Debt' && issues.some(issue => ['WorkspaceChanged', 'ObligationChanged'].includes(issue)) && <button onClick={() => void reviewDebt()}>Review current Debt</button>}{route === 'Opening' && issues.some(issue => ['CatalogChanged', 'WorkspaceChanged', 'TradeChanged'].includes(issue)) && <button onClick={() => void reviewOpening()}>Review current Trade</button>}{route !== 'Opening' && route !== 'Answer Journal Debt' && issues.some(issue => issue === 'CatalogChanged' || issue === 'WorkspaceChanged') && <button onClick={() => { void services.workspace.initialize({ openingInstant: new Date().toISOString() }).then(result => { if (result.status === 'Opened') { setRoot(result.root); setRecords(result.catalog.records); setCatalogRevision(result.root.catalogRevision); setIssues([]); setMessage('References refreshed. Review your selections and confirm again.'); } }); }}>Review current references</button>}</div>;
  const panelOpen = route === 'Opening' || route === 'Answer Journal Debt' || route === 'Trade Journal';
  const viewRoute = route === 'Opening' || route === 'Trade Journal' ? 'Detail' : route === 'Answer Journal Debt' ? debtReturnRoute : route;
  return <><div className={styles.shell} inert={panelOpen} aria-hidden={panelOpen || undefined}>
    <nav aria-label="Primary"><strong>Trade Journal</strong><button aria-current={['Trades', 'Detail'].includes(viewRoute) ? 'page' : undefined} onClick={() => void browse()}><span aria-hidden="true" className={styles.navIcon}>⌂</span>Trades</button><button aria-current={viewRoute === 'New Plan' ? 'page' : undefined} disabled={readOnly || !accounts.length} onClick={() => { setRoute('New Plan'); setIssues([]); }}><span aria-hidden="true" className={styles.navIcon}>+</span>New Plan</button><button aria-current={['Journal Debt', 'Debt outcome'].includes(viewRoute) ? 'page' : undefined} onClick={() => void showDebtQueue()}><span aria-hidden="true" className={styles.navIcon}>▤</span>Journal Debt</button><button aria-current={viewRoute === 'Workspace' ? 'page' : undefined} onClick={() => { setIssues([]); setRoute('Workspace'); }}><span aria-hidden="true" className={styles.navIcon}>⚙</span>Workspace</button></nav>
    <main><header>{viewRoute === 'Detail' && <button className={styles.backLink} onClick={() => { setMessage(''); void browse(pageCursor); }}>‹ Back to Trades</button>}<div><p className={styles.eyebrow}>AFTER-CLOSE JOURNAL · USD</p><h1 ref={heading} tabIndex={-1}>{viewRoute === 'Detail' && detail ? `${detail.trade.plan.instrument?.symbol} · ${detail.trade.lifecycle}` : viewRoute}</h1></div>{delivery && <button className={styles.updateCheck} onClick={() => void checkUpdate()}>Check for application updates</button>}</header>
      {updateAvailable && <aside aria-label="Update available" className={styles.warning}><h2>Update available</h2><p>{dirty ? 'Update deferred while this form has unsaved values. Save or Cancel before reloading.' : 'The complete new release is verified. Reload when you are ready.'}</p><button disabled={dirty || saving} onClick={() => { if (!dirty && !saving) void delivery?.activateUpdate().then(result => { if (result) setMessage(result === 'OtherClientsOpen' ? 'Close other Trade Journal tabs before reloading to update.' : 'Update activation could not be verified. Please retry.'); }); }}>Reload to update</button></aside>}
      {readOnly && <aside aria-label="Recovery Only" className={styles.warning}><h2>Recovery Only</h2><p>Reading and history remain available; writing is disabled. Another browser has separate storage. Backup and Restore are not installed in this release.</p><button onClick={() => void open()}>Retry startup</button></aside>}
      {protection !== 'Protected' && <aside aria-label="Storage protection" className={styles.warning}><strong>Storage is {protection === 'BestEffort' ? 'Best Effort' : 'Unavailable'}.</strong> This browser may clear your data. Backup is not installed until a later release. <button onClick={() => { void services.workspace.requestDurability().then(result => { setProtection(result.currentProtection); setMessage(result.status === 'NotImproved' ? 'The host did not grant stronger storage protection.' : 'Storage protection confirmed.'); }); }}>Request storage protection</button></aside>}
      {route === 'Workspace' && <p className={styles.install}>Where your browser offers installation, use Install or Add to Home Screen. This tab is usable after startup verification. Installation does not transfer or synchronize data.</p>}
      {message && <p role="status">{message}</p>}{!panelOpen && errorSummary}
      {readOnly && route === 'Workspace' ? <section className={styles.card}><h2>Workspace</h2><p>Time zone: {root?.timeZone}</p><p>Reference changes are disabled in Recovery Only.</p></section> : !accounts.length || route === 'Workspace' ? <section className={styles.card}><h2>{accounts.length ? 'Workspace' : 'Add your brokerage records'}</h2><p>Use your real Institution and Account. They are trading records; there is no application login.</p>{root && <p>Time zone: {root.timeZone}</p>}
        <form onSubmit={event => void saveReference(event, 'Institution')}><label>Institution name<input value={institution} onChange={event => setInstitution(event.target.value)} required /></label><button disabled={saving || readOnly}>Add Institution</button></form>
        {institutions.length > 0 && <form onSubmit={event => void saveReference(event, 'Account')}><h3>Add Account</h3><p>Create a separate Account under the selected Institution.</p><label>Institution<select value={parentId} onChange={event => setParentId(event.target.value)}>{institutions.map(record => <option key={record.id} value={record.id}>{record.label}</option>)}</select></label><label>New Account name<input value={account} onChange={event => setAccount(event.target.value)} required /></label><button disabled={saving || readOnly}>Add Account</button></form>}
      </section> : route === 'New Plan' ? <form className={styles.planForm} onChange={() => setPlanDirty(true)} onSubmit={event => void confirm(event)} noValidate><p className={styles.eyebrow}>STEP {planStage} OF 2</p><section className={styles.card}><h2>{planStage === 1 ? 'Long Stock Plan' : 'Instrument · Long Stock'}</h2>{planStage === 1 && <p>Freeze your intended entry, original management and Plan Reflection before entering.</p>}<div className={planStage === 2 ? styles.fieldGrid : undefined}><label>Account<select value={accountId} onChange={event => setAccountId(event.target.value)}>{accounts.map(record => <option key={record.id} value={record.id}>{record.label} · {institutions.find(institution => institution.id === record.parentId)?.label}</option>)}</select></label>
        {textField('symbol', 'Stock symbol')}</div></section>{planStage === 1 ? <div className={styles.actions}><button className={styles.primary} type="button" onClick={() => setPlanStage(2)}>Next: Plan and reflection</button><button type="button" onClick={() => { setPlanDirty(false); setPlan(emptyPlan); setRoute('Trades'); }}>Cancel</button></div> : <><section className={styles.card}>
        <h2>Plan Reflection</h2>{definition?.prompts.filter(prompt => prompt.id === 'thesis' || prompt.id === 'invalidation').map(prompt => textField(prompt.id as 'thesis' | 'invalidation', prompt.wording, true))}
        <label>Conviction (optional, 1–5)<select value={plan.conviction} onChange={event => setPlan({ ...plan, conviction: event.target.value })}><option value="">Unanswered</option>{[1,2,3,4,5].map(value => <option key={value}>{value}</option>)}</select></label>
        <fieldset><legend>Primary emotion (optional)</legend><label><input type="radio" name="emotion" checked={!plan.emotion} onChange={() => setPlan({ ...plan, emotion: '' })} />Unanswered</label>{definition?.prompts.find(prompt => prompt.id === 'emotion')?.options?.map(option => <label key={option.id}><input type="radio" name="emotion" value={option.id} checked={plan.emotion === option.id} onChange={() => setPlan({ ...plan, emotion: option.id })} />{option.label}</label>)}</fieldset>
        </section><section className={styles.card}><h2>Risk parameters</h2><div className={styles.fieldGrid}>{textField('quantity', 'Quantity (shares)')}{textField('entry', 'Intended entry (USD)')}{textField('stop', 'Stop (underlying price, USD)')}{textField('target', 'Target (underlying price, USD)')}</div></section><div className={styles.actions}><button type="button" onClick={() => setPlanStage(1)}>Back to instrument</button><button type="submit" disabled={saving || readOnly}>{saving ? 'Saving…' : 'Confirm Plan'}</button><button type="button" onClick={() => { setPlanDirty(false); setPlanStage(1); setPlan(emptyPlan); setIssues([]); setRoute('Trades'); }}>Cancel</button></div>
      </>}</form> : viewRoute === 'Journal Debt' ? <section className={styles.card}><h2>Outstanding Journal Debt</h2><p>Deferred reflection is separate from trading facts. Open a moment to answer its original form or explicitly decline.</p>{debtError ? <><p role="alert">Journal Debt could not be read.</p><button onClick={() => void showDebtQueue()}>Retry Journal Debt</button></> : !debtPage ? <p role="status">Loading Journal Debt…</p> : debtPage.obligations.length === 0 ? <p>No outstanding Journal Debt.</p> : debtPage.obligations.map(obligation => <section className={styles.card} key={obligation.id}><h3>{obligation.definition.label} · Outstanding</h3><p>Trade {obligation.anchor.tradeId} · Due {displayInstant(obligation.dueTime)}</p><button disabled={readOnly} onClick={() => beginDebt(obligation)}>Answer reflection</button><button onClick={() => void showTrade(obligation.anchor.tradeId)}>View Trade</button></section>)}</section> : route === 'Debt outcome' && debtOutcome ? <section className={styles.card}><h2>Journal Debt settled</h2><p>{debtOutcome.obligation.status === 'Completed' ? 'Completed Entry' : 'Explicit decline'} · Source {debtOutcome.obligation.source.label}</p><p>Trade Anchor {debtOutcome.obligation.anchor.tradeId} · Position Change {debtOutcome.obligation.origin.factId}</p><p>Original moment: {displayInstant(debtOutcome.obligation.momentTime)}</p><p>Saved: {displayInstant(debtOutcome.obligation.saveTime)}</p>{debtOutcome.entry && debtOutcome.entry.definition.prompts.map(prompt => { const response = debtOutcome.entry?.responses[prompt.id]; return <div key={prompt.id}><h3>{prompt.wording}</h3><p>{!response || response.kind === 'Unanswered' ? 'Unanswered' : prompt.options?.find(option => option.id === response.value)?.label ?? response.value}</p></div>; })}{debtOutcome.decline?.reason && <p>{debtOutcome.decline.reason}</p>}<button onClick={() => void showTrade(debtOutcome.obligation.anchor.tradeId)}>View Trade</button></section> : viewRoute === 'Detail' && detail ? <>{detail.analysis?.status === 'Derived' && 'quantity' in detail.analysis && <section className={styles.card}><h2>Open Position</h2><dl><dt>Quantity</dt><dd>{detail.analysis.quantity} shares</dd><dt>Gross basis</dt><dd>{money(detail.analysis.grossBasis)}</dd><dt>Opening fees</dt><dd>{money(detail.analysis.openingFees)}</dd><dt>Weighted entry</dt><dd title={`${detail.analysis.weightedEntry.numerator}/${detail.analysis.weightedEntry.denominator}`}>{quotientText(detail.analysis.weightedEntry)} USD <small>(exact {detail.analysis.weightedEntry.numerator}/{detail.analysis.weightedEntry.denominator})</small></dd><dt>Actual entry risk</dt><dd>{money(detail.analysis.entryQuality.risk)}</dd><dt>Actual entry reward</dt><dd>{money(detail.analysis.entryQuality.reward)}</dd><dt>Actual entry reward/risk</dt><dd>{'status' in detail.analysis.entryQuality.ratio ? `Unavailable: ${detail.analysis.entryQuality.ratio.reason}` : <>{quotientText(detail.analysis.entryQuality.ratio, 2)} <small>(exact {detail.analysis.entryQuality.ratio.numerator}/{detail.analysis.entryQuality.ratio.denominator})</small></>}</dd><dt>Entry Quality</dt><dd>{detail.analysis.entryQuality.comparison === 'BelowPlan' ? 'Below Plan' : detail.analysis.entryQuality.comparison === 'Unavailable' ? 'Unavailable: nonpositive actual entry risk' : 'Met or Exceeded Plan'}</dd></dl><h3>Open Lots</h3>{detail.analysis.positions.flatMap(position => position.lots.map(lot => <p key={lot.openingId}>{lot.quantity} shares at ${lot.price} · opening fee {money(lot.openingFees)}</p>))}</section>}<section className={styles.card}><span className={styles.badge}>{detail.trade.lifecycle} · {detail.trade.lifecycle === 'Planned' ? 'Unfilled' : 'Filled as Planned'}</span><h2>Frozen Plan Baseline</h2><div className={styles.hero}><p>ORIGINAL PLANNED RISK · 1R<strong title={detail.trade.baseline.oneR}>{money(detail.trade.baseline.oneR)}</strong></p><p>ORIGINAL PLANNED REWARD<strong title={detail.trade.baseline.reward}>{money(detail.trade.baseline.reward)}</strong></p><p>REWARD / RISK<strong>{detail.trade.baseline.ratio.numerator}/{detail.trade.baseline.ratio.denominator}</strong></p></div><p>{detail.labels.institution} · {detail.labels.account} · {detail.labels.strategy}</p><dl><dt>Intended entry</dt><dd>${detail.trade.plan.entry} × {detail.trade.plan.quantity} shares</dd><dt>Stop · underlying price</dt><dd>${detail.trade.plan.stop}</dd><dt>Target · underlying price</dt><dd>${detail.trade.plan.target}</dd></dl>{detail.trade.lifecycle === 'Planned' ? <><p>No exposure has been entered.</p>{openingDrafts[detail.trade.tradeId] && <p className={styles.badge}>Unsaved entry draft</p>}<button className={styles.primary} disabled={readOnly} onClick={startOpening}>{openingDrafts[detail.trade.tradeId] ? 'Continue unsaved entry' : 'Record initial Position Change'}</button></> : null}</section>
        {detail.trade.opening && <section className={styles.card}><h2>Recorded Executions</h2>{detail.trade.opening.executions.map((execution, index) => <div className={styles.recorded} key={execution.id}><strong>Execution {index + 1} · Recorded · Buy {execution.instrument.symbol}</strong><p>{execution.quantity} shares × ${execution.price} · Fee {money(execution.fee)}</p><small>Economic Time: {displayInstant(execution.economicTime)}</small></div>)}</section>}

        {detail.journal?.obligations.map(obligation => <section className={styles.card} key={obligation.id}><h2>Position Change Reflection · {obligation.status === 'Outstanding' ? 'Journal Debt' : obligation.status === 'Declined' ? 'Explicit decline' : 'Completed'}</h2><p>{obligation.status === 'Outstanding' ? 'Outstanding · Due ' + displayInstant(obligation.dueTime) : obligation.status}</p><p>Trade Anchor · Source {obligation.source.label} · Position Change {obligation.origin.factId}</p>{obligation.status === 'Outstanding' && <button disabled={readOnly} onClick={() => beginDebt(obligation, { generation: detail.binding?.generation, workspaceRevision: detail.binding?.workspaceRevision })}>Answer reflection</button>}{detail.journal?.declines.filter(decline => decline.obligationKey === obligation.key).map(decline => <p key={decline.id}>Declined {displayInstant(decline.saveTime)}{decline.reason ? ` · ${decline.reason}` : ''}</p>)}</section>)}
        {detail.entries.map(entry => <section className={styles.card} key={entry.id}><h2>{entry.definition.label}</h2><p>Trade Anchor · <span>{entry.source.label}</span></p><p>Moment: {displayInstant(entry.momentTime)} · First authored: {displayInstant(entry.firstAuthoredTime)}</p>{entry.definition.prompts.map(prompt => {
          const response = entry.responses[prompt.id];
          const value = !response || response.kind === 'Unanswered' ? 'Unanswered' : response.kind === 'SingleSelect' ? prompt.options?.find(option => option.id === response.value)?.label ?? response.value : response.value;
          return <div key={prompt.id}><h3>{prompt.wording}</h3><p>{value}</p></div>;
        })}</section>)}
        <button onClick={() => { setIssues([]); setRoute('Trade Journal'); }}>View Trade Journal</button><details className={styles.card}><summary>View history</summary>{detail.history.map(trade => <div key={trade.stateVersionId ?? trade.planVersionId}><p>Confirmed: {displayInstant(trade.economicTime)}</p><p>Saved: {displayInstant(trade.saveTime)}</p><p>Recorded Sequence: {trade.sequence}</p><p>Plan fact: {trade.planFactId}</p><p>Version: {trade.stateVersionId ?? trade.planVersionId}</p>{trade.opening && <><p>Position Change: {trade.opening.positionChange.id} · {displayInstant(trade.opening.positionChange.economicTime)}</p>{trade.opening.executions.map(execution => <p key={execution.id}>Execution {execution.id}: {execution.quantity} shares at ${execution.price}, fee ${execution.fee} · {displayInstant(execution.economicTime)} · Saved {displayInstant(execution.saveTime)} · Recorded Sequence {execution.sequence}</p>)}</>}</div>)}</details></> : <section className={styles.browse}><h2>{lifecycle} Trades</h2><div className={styles.filters}><button aria-pressed={lifecycle === 'Planned'} onClick={() => void browse(undefined, 'Planned')}>Planned</button><button aria-pressed={lifecycle === 'Open'} onClick={() => void browse(undefined, 'Open')}>Open</button></div>{!page ? <p role="status">Loading {lifecycle} Trades…</p> : page.status === 'Empty' ? <p>No confirmed Plans match this view.</p> : page.status === 'Ready' ? <><ul className={styles.tradeList}>{page.items.map(item => <li key={item.trade.tradeId}><button data-symbol={item.trade.plan.instrument?.symbol?.slice(0, 2)} onClick={() => void showTrade(item.trade.tradeId)}><strong>{item.trade.plan.instrument?.symbol} · {item.trade.lifecycle}</strong> {item.status === 'Derived' ? 'quantity' in item ? <span>{item.quantity} shares · {money(item.openingFees)} opening fees · Entry Quality: {item.entryQuality.comparison === 'BelowPlan' ? 'Below Plan' : item.entryQuality.comparison === 'Unavailable' ? 'Unavailable' : 'Met or Exceeded Plan'}</span> : <span>{records.find(record => record.id === item.trade.accountId)?.label} · {records.find(record => record.id === item.trade.strategyId)?.label} · {item.entryReadiness} · {money(item.baseline.oneR)} risk · {money(item.baseline.reward)} reward · {item.baseline.ratio.numerator}/{item.baseline.ratio.denominator} reward/risk</span> : <span>Integrity blocked</span>}</button></li>)}</ul>{page.nextCursor && <button onClick={() => void browse(page.nextCursor)}>Next 50 Trades</button>}</> : <><p role="alert">{page.status}</p><button onClick={() => void browse()}>Retry list</button></>}</section>}
    </main>
  </div>
  {route === 'Opening' && detail && openingDrafts[detail.trade.tradeId] && <ContextPanel title="Opening entry" busy={saving} onClose={() => { setIssues([]); setRoute('Detail'); }}>{readOnly && <aside aria-label="Recovery Only" className={styles.warning}><h2>Recovery Only</h2><p>Reading and history remain available; writing is disabled. Your draft is preserved.</p><button disabled={saving} onClick={() => void open()}>Retry startup</button></aside>}{updateAvailable && <p role="status">Update deferred while this form has unsaved values. Save or Cancel before reloading.</p>}{errorSummary}<OpeningForm busy={saving} plannedQuantity={detail.trade.plan.quantity} draft={openingDrafts[detail.trade.tradeId]} onChange={draft => setOpeningDrafts(previous => ({ ...previous, [draft.command.tradeId]: draft }))} onSubmit={event => void saveOpening(event)} issues={issues} disabled={saving || readOnly || detail.trade.lifecycle !== 'Planned'} onCancel={() => { setOpeningDrafts(previous => { const next = { ...previous }; delete next[detail.trade.tradeId]; return next; }); setIssues([]); setRoute('Detail'); }} /></ContextPanel>}
  {route === 'Answer Journal Debt' && debtDrafts[selectedDebtId] && <ContextPanel title="Answer Journal Debt" busy={saving} onClose={() => { setIssues([]); setRoute(debtReturnRoute); }}>{readOnly && <aside aria-label="Recovery Only" className={styles.warning}><h2>Recovery Only</h2><p>Reading and history remain available; writing is disabled. Your draft is preserved.</p><button disabled={saving} onClick={() => void open()}>Retry startup</button></aside>}{updateAvailable && <p role="status">Update deferred while this form has unsaved values. Save or Cancel before reloading.</p>}{errorSummary}<DebtForm busy={saving} draft={debtDrafts[selectedDebtId]} onChange={draft => setDebtDrafts(previous => ({ ...previous, [draft.obligation.id]: draft }))} onSubmit={event => void saveDebt(event)} issues={issues} disabled={saving || readOnly || debtDrafts[selectedDebtId].obligation.status !== 'Outstanding'} onCancel={() => { setDebtDrafts(previous => { const next = { ...previous }; delete next[selectedDebtId]; return next; }); void showDebtQueue(); }} /></ContextPanel>}
  {route === 'Trade Journal' && detail && <ContextPanel title="Trade Journal" busy={false} onClose={() => setRoute('Detail')}>{detail.entries.map(entry => <section className={styles.card} key={entry.id}><h2>{entry.definition.label}</h2><p>Trade Anchor · <span>{entry.source.label}</span></p><p>Moment: {displayInstant(entry.momentTime)} · First authored: {displayInstant(entry.firstAuthoredTime)}</p>{entry.definition.prompts.map(prompt => {
          const response = entry.responses[prompt.id];
          const value = !response || response.kind === 'Unanswered' ? 'Unanswered' : response.kind === 'SingleSelect' ? prompt.options?.find(option => option.id === response.value)?.label ?? response.value : response.value;
          return <div key={prompt.id}><h3>{prompt.wording}</h3><p>{value}</p></div>;
        })}</section>)}{detail.journal?.obligations.filter(obligation => obligation.status !== 'Completed').map(obligation => <section className={styles.card} key={obligation.id}><h2>{obligation.definition.label} · {obligation.status === 'Outstanding' ? 'Journal Debt' : 'Explicit decline'}</h2><p>{obligation.status === 'Outstanding' ? 'Outstanding · Due ' + displayInstant(obligation.dueTime) : obligation.status}</p><p>Trade Anchor · Source {obligation.source.label} · Position Change {obligation.origin.factId}</p><p>Moment: {displayInstant(obligation.momentTime)}</p>{obligation.status === 'Outstanding' && <button disabled={readOnly} onClick={() => beginDebt(obligation, { generation: detail.binding?.generation, workspaceRevision: detail.binding?.workspaceRevision })}>Answer reflection</button>}{detail.journal?.declines.filter(decline => decline.obligationKey === obligation.key).map(decline => <p key={decline.id}>Declined {displayInstant(decline.saveTime)}{decline.reason ? ` · ${decline.reason}` : ''}</p>)}</section>)}</ContextPanel>}
  </>;
}
