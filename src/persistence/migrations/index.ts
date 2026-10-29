import type { RecordTransform } from '../persistence.ts';
import { SCHEMA_VERSION } from '../schema.ts';
import { v1ToV2 } from './v1-to-v2.ts';
import { v2ToV3 } from './v2-to-v3.ts';
import { v3ToV4 } from './v3-to-v4.ts';

// Each schema's per-record transform to the next one, keyed by the schema it reads.
const STEPS: Readonly<Record<number, RecordTransform>> = { 1: v1ToV2, 2: v2ToV3, 3: v3ToV4 };

// The per-record transform chain from a supported older schema to the current one.
export function migrationChain(fromVersion: number): RecordTransform {
  const steps: RecordTransform[] = [];
  for (let version = fromVersion; version < SCHEMA_VERSION; version++) {
    const step = STEPS[version];
    if (!step) throw new Error(`No migration from schema ${version}`);
    steps.push(step);
  }
  return (record) => steps.reduce((current, step) => step(current), record);
}
