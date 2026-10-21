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
export interface Services { workspace: Workspace; catalog: ReferenceCatalog; workflows: TradeWorkflows; views: TradeViewsAndReporting }
interface Detail { trade: TradeSnapshot; entries: JournalEntry[]; history: TradeSnapshot[]; labels: { account?: string; institution?: string; strategy?: string } }
const emptyPlan = { symbol: '', quantity: '', entry: '', stop: '', target: '', thesis: '', invalidation: '', conviction: '', emotion: '' };
const issueMessages: Record<string, string> = {
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
function money(value: string) { return `$${new Decimal(value).toFixed(2, Decimal.ROUND_HALF_EVEN)}`; }
export interface Delivery { getUpdate(): Promise<{ available: boolean; release?: string }>; activateUpdate(): Promise<string | void> }
export function App({ services, delivery }: { services: Services; delivery?: Delivery }) {
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
  const dirty = planDirty || institution !== '' || account !== '';
  const [parentId, setParentId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [route, setRoute] = useState('Trades');
  const [plan, setPlan] = useState(emptyPlan);
  const [issues, setIssues] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [protection, setProtection] = useState('BestEffort');
  const [detail, setDetail] = useState<Detail>();
  const [page, setPage] = useState<Awaited<ReturnType<TradeViewsAndReporting['browseTrades']>>>();
  const [saving, setSaving] = useState(false);
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
        setRoot(result.root); setRecords(result.catalog.records); setDefinition(result.definition); setCatalogRevision(result.root.catalogRevision);
        setParentId(result.catalog.records.find(record => record.kind === 'Institution')?.id ?? '');
        setAccountId(result.catalog.records.find(record => record.kind === 'Account')?.id ?? '');
        setPage(await services.views.browseTrades()); setReadOnly(false); setPhase('Ready');
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
  async function browse(cursor?: string) { setRoute('Trades'); setPage(undefined); setPage(await services.views.browseTrades({ cursor })); }
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
    event.preventDefault(); if (!root || !definition) return; setSaving(true); setMessage(''); setIssues([]);
    try {
      const result = await services.workflows.confirmPlan({ generation: root.generation, expectedCatalogRevision: catalogRevision, definitionRevision: definition.revision, accountId, strategyId: 'long-stock', economicTime: new Date().toISOString(), plan: { instrument: { kind: 'Stock', symbol: plan.symbol.trim().toUpperCase(), currency: 'USD' }, quantity: plan.quantity, entry: plan.entry, stop: plan.stop, target: plan.target }, reflection: { thesis: plan.thesis, invalidation: plan.invalidation, conviction: plan.conviction, emotion: plan.emotion } });
      if (result.status === 'Confirmed') { setPlanDirty(false); setDetail({ trade: result.trade, entries: [result.entry], history: [result.trade], labels: result.labels }); setRoute('Detail'); setPlan(emptyPlan); setMessage('Plan confirmed and saved on this device.'); }
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
    if (result.status === 'Ready') { setDetail(result); setRoute('Detail'); }
    else setIssues([result.status]);
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
  if (phase === 'TimeZoneSelectionRequired') return <main className={styles.startup}><h1 ref={heading} tabIndex={-1}>Your device-local Workspace</h1><p>Choose a rules-based time zone. This journal stays in this browser on this device.</p><form onSubmit={event => { event.preventDefault(); if (!timeZone.trim()) { setIssues(['TimeZoneRequired']); return; } void open(timeZone); }}><label>Workspace time zone<input value={timeZone} aria-invalid={issues.length > 0 || undefined} aria-describedby={issues.length ? 'time-zone-error' : undefined} placeholder="e.g. America/New_York" onChange={event => setTimeZone(event.target.value)} /></label><button>Create Workspace</button></form>{issues.length > 0 && <div role="alert" id="time-zone-error"><h2 ref={errorHeading} tabIndex={-1}>Choose your time zone</h2>{issues.map(issue => <p key={issue}>{issueMessages[issue] ?? issue}</p>)}</div>}</main>;
  if (phase !== 'Ready') return <main className={styles.startup}><h1 ref={heading} tabIndex={-1}>{phase}</h1><p>We could not verify safe writing in this environment.</p><ul>{issues.map(issue => <li key={issue} data-issue={issue}>{issueMessages[issue] ?? issue}</li>)}</ul><button onClick={() => void open()}>Retry startup</button>{phase === 'Unsupported' && <p>Try another browser that meets the readiness requirements.</p>}<p>Another browser has separate storage and does not transfer this Workspace. Backup and Restore are not installed in this release.</p></main>;
  return <div className={styles.shell}>
    <nav aria-label="Primary"><strong>TRADE JOURNAL</strong><button onClick={() => void browse()}>Trades</button><button disabled={readOnly || !accounts.length} onClick={() => { setRoute('New Plan'); setIssues([]); }}>New Plan</button><button onClick={() => setRoute('Workspace')}>Workspace</button></nav>
    <main><header><p className={styles.eyebrow}>AFTER-CLOSE JOURNAL · USD</p><h1 ref={heading} tabIndex={-1}>{route === 'Detail' && detail ? `${detail.trade.plan.instrument?.symbol} · Planned` : route}</h1></header>
      {delivery && <button onClick={() => void checkUpdate()}>Check for application updates</button>}
      {updateAvailable && <aside aria-label="Update available" className={styles.warning}><h2>Update available</h2><p>{dirty ? 'Update deferred while this form has unsaved values. Save or Cancel before reloading.' : 'The complete new release is verified. Reload when you are ready.'}</p><button disabled={dirty || saving} onClick={() => { if (!dirty && !saving) void delivery?.activateUpdate().then(result => { if (result) setMessage(result === 'OtherClientsOpen' ? 'Close other Trade Journal tabs before reloading to update.' : 'Update activation could not be verified. Please retry.'); }); }}>Reload to update</button></aside>}
      {readOnly && <aside aria-label="Recovery Only" className={styles.warning}><h2>Recovery Only</h2><p>Reading and history remain available; writing is disabled. Another browser has separate storage. Backup and Restore are not installed in this release.</p><button onClick={() => void open()}>Retry startup</button></aside>}
      {protection !== 'Protected' && <aside aria-label="Storage protection" className={styles.warning}><strong>Storage is {protection === 'BestEffort' ? 'Best Effort' : 'Unavailable'}.</strong> This browser may clear your data. Backup is not installed until a later release. <button onClick={() => { void services.workspace.requestDurability().then(result => { setProtection(result.currentProtection); setMessage(result.status === 'NotImproved' ? 'The host did not grant stronger storage protection.' : 'Storage protection confirmed.'); }); }}>Request storage protection</button></aside>}
      <p className={styles.install}>Where your browser offers installation, use Install or Add to Home Screen. This tab is usable after startup verification. Installation does not transfer or synchronize data.</p>
      {message && <p role="status">{message}</p>}{issues.length > 0 && <div role="alert" id="plan-issues" className={styles.errors}><h2 ref={errorHeading} tabIndex={-1}>Review before continuing</h2><ul>{issues.map(issue => <li key={issue} data-issue={issue}>{issueMessages[issue] ?? issue}</li>)}</ul>{issues.some(issue => issue === 'CatalogChanged' || issue === 'WorkspaceChanged') && <button onClick={() => { void services.workspace.initialize({ openingInstant: new Date().toISOString() }).then(result => { if (result.status === 'Opened') { setRoot(result.root); setRecords(result.catalog.records); setCatalogRevision(result.root.catalogRevision); setIssues([]); setMessage('References refreshed. Review your selections and confirm again.'); } }); }}>Review current references</button>}</div>}
      {readOnly && route === 'Workspace' ? <section className={styles.card}><h2>Workspace</h2><p>Time zone: {root?.timeZone}</p><p>Reference changes are disabled in Recovery Only.</p></section> : !accounts.length || route === 'Workspace' ? <section className={styles.card}><h2>{accounts.length ? 'Workspace' : 'Add your brokerage records'}</h2><p>Use your real Institution and Account. They are trading records; there is no application login.</p>{root && <p>Time zone: {root.timeZone}</p>}
        <form onSubmit={event => void saveReference(event, 'Institution')}><label>Institution name<input value={institution} onChange={event => setInstitution(event.target.value)} required /></label><button disabled={saving || readOnly}>Add Institution</button></form>
        {institutions.length > 0 && <form onSubmit={event => void saveReference(event, 'Account')}><h3>Add Account</h3><p>Create a separate Account under the selected Institution.</p><label>Institution<select value={parentId} onChange={event => setParentId(event.target.value)}>{institutions.map(record => <option key={record.id} value={record.id}>{record.label}</option>)}</select></label><label>New Account name<input value={account} onChange={event => setAccount(event.target.value)} required /></label><button disabled={saving || readOnly}>Add Account</button></form>}
      </section> : route === 'New Plan' ? <form className={styles.card} onChange={() => setPlanDirty(true)} onSubmit={event => void confirm(event)} noValidate><h2>Long Stock Plan</h2><p>Freeze your intended entry, original management and Plan Reflection before entering.</p><label>Account<select value={accountId} onChange={event => setAccountId(event.target.value)}>{accounts.map(record => <option key={record.id} value={record.id}>{record.label} · {institutions.find(institution => institution.id === record.parentId)?.label}</option>)}</select></label>
        {textField('symbol', 'Stock symbol')}{textField('quantity', 'Quantity (shares)')}{textField('entry', 'Intended entry (USD)')}{textField('stop', 'Stop (underlying price, USD)')}{textField('target', 'Target (underlying price, USD)')}
        <h2>Plan Reflection</h2>{definition?.prompts.filter(prompt => prompt.id === 'thesis' || prompt.id === 'invalidation').map(prompt => textField(prompt.id as 'thesis' | 'invalidation', prompt.wording, true))}
        <label>Conviction (optional, 1–5)<select value={plan.conviction} onChange={event => setPlan({ ...plan, conviction: event.target.value })}><option value="">Unanswered</option>{[1,2,3,4,5].map(value => <option key={value}>{value}</option>)}</select></label>
        <fieldset><legend>Primary emotion (optional)</legend><label><input type="radio" name="emotion" checked={!plan.emotion} onChange={() => setPlan({ ...plan, emotion: '' })} />Unanswered</label>{definition?.prompts.find(prompt => prompt.id === 'emotion')?.options?.map(option => <label key={option.id}><input type="radio" name="emotion" value={option.id} checked={plan.emotion === option.id} onChange={() => setPlan({ ...plan, emotion: option.id })} />{option.label}</label>)}</fieldset>
        <div className={styles.actions}><button type="submit" disabled={saving || readOnly}>{saving ? 'Saving…' : 'Confirm Plan'}</button><button type="button" onClick={() => { setPlanDirty(false); setPlan(emptyPlan); setIssues([]); setRoute('Trades'); }}>Cancel</button></div>
      </form> : route === 'Detail' && detail ? <><section className={styles.card}><span className={styles.badge}>Planned · Unfilled</span><h2>Frozen Plan Baseline</h2><p>{detail.labels.institution} · {detail.labels.account} · {detail.labels.strategy}</p><dl><dt>Original Planned Risk · 1R</dt><dd title={detail.trade.baseline.oneR}>{money(detail.trade.baseline.oneR)}</dd><dt>Original Planned Reward</dt><dd title={detail.trade.baseline.reward}>{money(detail.trade.baseline.reward)}</dd><dt>Planned reward/risk ratio</dt><dd>{detail.trade.baseline.ratio.numerator}/{detail.trade.baseline.ratio.denominator}</dd><dt>Intended entry</dt><dd>${detail.trade.plan.entry} × {detail.trade.plan.quantity} shares</dd><dt>Stop · underlying price</dt><dd>${detail.trade.plan.stop}</dd><dt>Target · underlying price</dt><dd>${detail.trade.plan.target}</dd></dl><p>No exposure has been entered.</p></section>
        {detail.entries.map(entry => <section className={styles.card} key={entry.id}><h2>{entry.definition.label}</h2><p>Trade Anchor · <span>{entry.source.label}</span></p>{entry.definition.prompts.map(prompt => {
          const response = entry.responses[prompt.id];
          const value = !response || response.kind === 'Unanswered' ? 'Unanswered' : response.kind === 'SingleSelect' ? prompt.options?.find(option => option.id === response.value)?.label ?? response.value : response.value;
          return <div key={prompt.id}><h3>{prompt.wording}</h3><p>{value}</p></div>;
        })}</section>)}
        <details className={styles.card}><summary>View history</summary>{detail.history.map(trade => <div key={trade.planVersionId}><p>Confirmed: {displayInstant(trade.economicTime)}</p><p>Saved: {displayInstant(trade.saveTime)}</p><p>Recorded Sequence: {trade.sequence}</p><p>Plan fact: {trade.planFactId}</p><p>Version: {trade.planVersionId}</p></div>)}</details></> : <section className={styles.card}><h2>Planned Trades</h2>{!page ? <p role="status">Loading Planned Trades…</p> : page.status === 'Empty' ? <p>No confirmed Plans match this view.</p> : page.status === 'Ready' ? <><ul className={styles.tradeList}>{page.items.map(item => <li key={item.trade.tradeId}><button onClick={() => void showTrade(item.trade.tradeId)}>{item.trade.plan.instrument?.symbol} · Planned {item.status === 'Derived' ? <span>{item.entryReadiness} · {money(item.baseline.oneR)} risk · {money(item.baseline.reward)} reward · {item.baseline.ratio.numerator}/{item.baseline.ratio.denominator} reward/risk</span> : <span>Integrity blocked</span>}</button></li>)}</ul>{page.nextCursor && <button onClick={() => void browse(page.nextCursor)}>Next 50 Trades</button>}</> : <><p role="alert">{page.status}</p><button onClick={() => void browse()}>Retry list</button></>}</section>}
    </main>
  </div>;
}
