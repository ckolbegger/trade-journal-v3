// Test helpers for Workspace.prepareRestore (D8 T8.8): backup files made through exportBackup, the
// target Workspace W-t, and edits of an artifact's decompressed lines.
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { gunzipSync, gzipSync } from 'fflate';
import { IDBFactory } from 'fake-indexeddb';
import { createMutationGuard } from '../mutation-guard.ts';
import { createTradeWorkflows } from '../trade-workflows/index.ts';
import { longStockOf } from '../../../tests/support/long-stock.ts';
import { testStack } from '../../../tests/support/stack.ts';
import { createWorkspace } from './index.ts';

// Friday 2026-11-20 18:00 in New York: the instant W7 is exported at.
export const EXPORT_AT = '2026-11-20T23:00:00Z';

type Stack = Awaited<ReturnType<typeof testStack>>;

// The Workspace of a stack, wired as the composition root wires it.
export function workspaceOf(stack: Stack, overrides: Partial<Parameters<typeof createWorkspace>[0]> = {}) {
  return createWorkspace({ ...stack, host: stack.testHost.host, releaseId: stack.testHost.releaseId, backup: { download: stack.testHost.downloads.port }, ...overrides });
}

// The backup file a Workspace on `factory` exports: the artifact of that data.
export async function exportedArtifact(factory: IDBFactory, now = EXPORT_AT) {
  const stack = await testStack(factory, now);
  const result = await workspaceOf(stack).exportBackup({});
  if (result.kind !== 'Downloaded') throw new Error(`expected Downloaded, got ${result.kind}`);
  return { bytes: stack.testHost.downloads.offered[0]!.bytes, fullDigest: result.fullDigest, releaseId: stack.testHost.releaseId };
}

export const backupFile = (bytes: Uint8Array, name = 'backup.tjbackup'): File => new File([bytes as BlobPart], name);

// W-t: the target of a Restore, holding one Institution, one Account and one Planned Trade, with time zone America/Chicago.
export async function targetWorkspace() {
  const stack = await testStack(new IDBFactory(), '2026-11-21T15:00:00Z');
  const workspace = workspaceOf(stack);
  const tradeWorkflows = createTradeWorkflows({ ...stack, guard: createMutationGuard(stack.session) });
  const initialized = await workspace.initialize({ timeZone: 'America/Chicago' });
  if (initialized.kind !== 'Opened') throw new Error(`expected Opened, got ${initialized.kind}`);
  const institution = await stack.catalog.save({ kind: 'CreateInstitution', label: 'Fidelity' });
  if (institution.kind !== 'Saved') throw new Error('institution not saved');
  const account = await stack.catalog.save({ kind: 'CreateAccount', institutionId: institution.record.id, label: 'Roth IRA' });
  if (account.kind !== 'Saved') throw new Error('account not saved');
  const strategies = await stack.catalog.query({ family: 'Strategy' });
  if (strategies.kind !== 'Page') throw new Error('no strategies');
  const strategy = longStockOf(strategies.items);
  const definition = await stack.journal.getDefinitions({ latestFor: 'entry-type.plan-reflection' });
  if (definition.kind !== 'Found') throw new Error('no definition');
  const confirmed = await tradeWorkflows.confirmPlan({
    accountId: account.record.id,
    accountRevision: account.record.recordRevision,
    strategyId: strategy.id,
    strategyRevision: strategy.recordRevision,
    economicTime: '2026-11-20T15:00:00Z',
    plan: {
      underlying: 'AAPL',
      legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: 'AAPL' }, quantity: '10', intendedEntry: '150' }],
      stops: [{ kind: 'UnderlyingPrice', price: '140' }],
      targets: [{ kind: 'UnderlyingPrice', price: '170' }],
    },
    reflection: {
      definitionId: definition.definition.id,
      answers: {
        'prompt.plan-reflection.thesis': { kind: 'Text', text: 'Breakout above the 50-day on volume.' },
        'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A close back below the stop.' },
      },
    },
  });
  if (confirmed.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${confirmed.kind}`);
  return { ...stack, workspace };
}

// The artifact's decompressed lines, with the manifest as its own object; `edit` changes either, and the
// result is gzipped again. Every section digest, the full digest and the manifest's copies are
// recomputed unless the edit says not to (`keepDigests`), so that only semantic validation can catch
// the edit. Counts and the footprint stay the edit's responsibility.
export interface EditableArtifact {
  readonly lines: string[];
  readonly manifest: { sectionDigests: Record<string, string>; fullDigest: string } & Record<string, unknown>;
  keepDigests: boolean;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

export function editedArtifact(bytes: Uint8Array, edit: (artifact: EditableArtifact) => void): Uint8Array {
  const all = new TextDecoder().decode(gunzipSync(bytes)).split('\n');
  all.pop();
  const manifest = JSON.parse(all.pop()!) as EditableArtifact['manifest'];
  const artifact: EditableArtifact = { lines: all, manifest, keepDigests: false };
  edit(artifact);
  if (!artifact.keepDigests) {
    // A section's digest covers its record lines; each section-end line carries it.
    let section = sha256.create();
    artifact.lines.forEach((line, index) => {
      if (line.startsWith('{"r":')) {
        section.update(new TextEncoder().encode(`${line}\n`));
        return;
      }
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (parsed['kind'] !== 'sectionEnd') return;
      parsed['digest'] = bytesToHex(section.digest());
      manifest.sectionDigests[parsed['section'] as string] = parsed['digest'] as string;
      artifact.lines[index] = canonical(parsed);
      section = sha256.create();
    });
    manifest.fullDigest = bytesToHex(sha256(new TextEncoder().encode(artifact.lines.map((l) => `${l}\n`).join(''))));
  }
  const text = [...artifact.lines, canonical(manifest)].map((l) => `${l}\n`).join('');
  return gzipSync(new TextEncoder().encode(text));
}
