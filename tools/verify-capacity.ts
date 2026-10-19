// npm run verify:capacity: the embedded capacity requirement equals 3 × M recomputed from the
// measured basis and the mature profile, and the basis was measured at the current schema
// version, so a schema change fails until the basis is recomputed (D1 T1.19).
import { readFile } from 'node:fs/promises';
import { CAPACITY_REQUIREMENT } from '../src/delivery/capacity.ts';
import { SCHEMA_VERSION } from '../src/persistence/schema.ts';
import { BASIS_FILE, largestProjection, type EngineMeasurement } from './capacity/profile.ts';

const basis = JSON.parse(await readFile(BASIS_FILE, 'utf8')) as {
  schemaVersion: number;
  engines?: EngineMeasurement[];
  projectedWorkspaceBytes: number;
  requiredQuotaBytes: number;
};
const problems: string[] = [];
if (basis.schemaVersion !== SCHEMA_VERSION) {
  problems.push(`basis measured at schema version ${basis.schemaVersion}, current is ${SCHEMA_VERSION}: run measure:capacity`);
}
if (!basis.engines || basis.engines.length === 0) {
  problems.push('basis has no engine measurement: run measure:capacity');
} else {
  const expected = largestProjection(basis.engines);
  if (basis.projectedWorkspaceBytes !== expected.projectedWorkspaceBytes) {
    problems.push(`projectedWorkspaceBytes ${basis.projectedWorkspaceBytes} is not the recomputed ${expected.projectedWorkspaceBytes}`);
  }
  if (CAPACITY_REQUIREMENT.requiredQuotaBytes !== 3 * expected.projectedWorkspaceBytes) {
    problems.push(`embedded requiredQuotaBytes ${CAPACITY_REQUIREMENT.requiredQuotaBytes} is not 3 × ${expected.projectedWorkspaceBytes}`);
  }
  if (CAPACITY_REQUIREMENT.projectedWorkspaceBytes !== expected.projectedWorkspaceBytes) {
    problems.push(`embedded projectedWorkspaceBytes ${CAPACITY_REQUIREMENT.projectedWorkspaceBytes} is not ${expected.projectedWorkspaceBytes}`);
  }
}
if (problems.length > 0) {
  for (const p of problems) console.error(`FAIL ${p}`);
  process.exit(1);
}
console.log(`verify:capacity OK: required quota ${CAPACITY_REQUIREMENT.requiredQuotaBytes} = 3 × ${CAPACITY_REQUIREMENT.projectedWorkspaceBytes}, schema ${SCHEMA_VERSION}`);
