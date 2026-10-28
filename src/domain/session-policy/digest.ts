import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { BUFFER_MINUTES, RULES_VERSION } from './rules.ts';
import type { TableRow } from './types.ts';

// The digest is determined by the explicit table, the rules version, and the completion buffer.
// Dates are unique (createSessionPolicy rejects duplicates), so the date alone orders the rows.
// The id, the revision, and the coverage range are not part of it (A39).
export function policyDigest(table: readonly TableRow[]): string {
  const rows = [...table]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((row) => [row.date, row.kind, row.name, row.source.name, row.source.url]);
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify({ rulesVersion: RULES_VERSION, bufferMinutes: BUFFER_MINUTES, rows }))));
}
