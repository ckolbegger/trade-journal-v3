// The D7S Node application-stack suite (plan section 6.1): the real facade from createApplication on
// fake-indexeddb, NodeTestHost and the in-process lifecycle lock, called through facade operations only,
// as in D1 to D7. Clocks are fixed per case, and restart means a new application over the same factory.
// D7S adds no substitute (section 6.0). It reuses D7's helpers and adds O-S2 and O-C2 (section 4).
import { readFileSync } from 'node:fs';
import type { Application } from '../../../src/app/compose.ts';
import type { ConfirmPlanCommand } from '../../../src/coordinators/trade-workflows/index.ts';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { loadDump, type WorkspaceDump } from '../../../tools/fixtures/workspace-fixture.ts';
import { device, type Device, type MutableDump, MNO_PUT, optionPlanCommand, recordOption, saveMark, XYZ_CALL } from '../d7/support.ts';

export * from '../d7/support.ts';

// --- The committed fixtures, schema 1 to 6 (D6's helpers name versions 1 to 5 only) ---

export type FixtureVersion = 1 | 2 | 3 | 4 | 5 | 6;

export function fixtureDump(version: FixtureVersion): WorkspaceDump {
  return JSON.parse(readFileSync(`tests/fixtures/workspace-v${version}/dump.json`, 'utf8')) as WorkspaceDump;
}

export function fixtureViews(version: FixtureVersion): unknown {
  return JSON.parse(readFileSync(`tests/fixtures/workspace-v${version}/expected-views.json`, 'utf8'));
}

// The name of the fixture's Workspace database.
export function fixtureDatabase(version: FixtureVersion): string {
  const name = Object.keys(fixtureDump(version).databases).find((n) => n.startsWith('tj-ws-'));
  if (!name) throw new Error(`workspace-v${version} has no Workspace database`);
  return name;
}

// A device holding a committed fixture, optionally edited before any application opens it, at the fixture's
// recorded as-of instant. Its identities use the `mig` prefix, never the fixture's `fx-`.
export async function fixtureDevice(version: FixtureVersion, edit?: (dump: MutableDump) => void): Promise<Device> {
  const dump = structuredClone(fixtureDump(version));
  edit?.(dump as unknown as MutableDump);
  return device(await loadDump(dump), fixtureDump(version).asOf, 'mig');
}

// Both contracts expire Friday 2026-12-18, so nothing in D7S is Settlement Due.
export const MNO_DEC_PUT = { ...MNO_PUT, expiration: '2026-12-18' } as const;
export const XYZ_DEC_CALL = { ...XYZ_CALL, expiration: '2026-12-18' } as const;

// 17:00 New York (UTC-4) on the three sessions of section 4's table.
export const TUESDAY_1700_NY = '2026-10-13T21:00:00Z';
export const WEDNESDAY_1700_NY = '2026-10-14T21:00:00Z';
export const THURSDAY_1700_NY = '2026-10-15T21:00:00Z';
export const TUESDAY = '2026-10-13';
export const WEDNESDAY = '2026-10-14';
export const THURSDAY = '2026-10-15';

export type ConditionInput = ConfirmPlanCommand['plan']['stops'][number];
export const underlyingPrice = (price: string): ConditionInput => ({ kind: 'UnderlyingPrice', price });
export const optionPrice = (price: string): ConditionInput => ({ kind: 'StructureValue', price });

// O-S2's Plan command: the Cash-Secured Put on MNO 18 Dec 2026 45 Put, -2 at 1.20, Stops S-u 41.00 and S-o 3.60,
// Targets T-u 44.50 and T-o 0.30, in that Plan order.
export async function os2Command(app: Application): Promise<ConfirmPlanCommand> {
  const base = await optionPlanCommand(app, 'O-S');
  return {
    ...base,
    plan: {
      ...base.plan,
      legs: [{ ...base.plan.legs[0]!, instrument: MNO_DEC_PUT }],
      stops: [underlyingPrice('41.00'), optionPrice('3.60')],
      targets: [underlyingPrice('44.50'), optionPrice('0.30')],
    },
  };
}

// O-C2's Plan command: the Long Call on XYZ 18 Dec 2026 55 Call, 2 at 2.00, Exercise Intent NotAuthorized,
// Stops 48.00 and option 1.00, Targets 60.00 and option 4.00.
export async function oc2Command(app: Application): Promise<ConfirmPlanCommand> {
  const base = await optionPlanCommand(app, 'O-C');
  return {
    ...base,
    plan: {
      ...base.plan,
      legs: [{ ...base.plan.legs[0]!, instrument: XYZ_DEC_CALL }],
      stops: [underlyingPrice('48.00'), optionPrice('1.00')],
      targets: [underlyingPrice('60.00'), optionPrice('4.00')],
    },
  };
}

// Confirms O-S2 and returns the whole Confirmed result.
export async function confirmOs2(app: Application) {
  const result = await app.TradeWorkflows.confirmPlan(await os2Command(app));
  if (result.kind !== 'Confirmed') throw new Error(`confirmPlan: ${JSON.stringify(result)}`);
  return result;
}

// O-S2 after S1' (Monday 10:00, Sell 2 at 1.25, fee 1.30).
export async function openOs2(app: Application): Promise<string> {
  const tradeId = (await confirmOs2(app)).receipt.tradeId;
  await recordOption(app, tradeId, 'Sell', { quantity: '2', price: '1.25', economicTime: '2026-10-12T14:00:00Z', fee: '1.30' });
  return tradeId;
}

// One session's Marks for MNO and the put (section 4's table); an omitted Mark is not saved.
export async function saveSession(app: Application, date: string, marks: { mno?: string; put?: string }): Promise<void> {
  if (marks.mno !== undefined) await saveMark(app, 'MNO', date, marks.mno);
  if (marks.put !== undefined) await saveMark(app, instrumentKey(MNO_DEC_PUT), date, marks.put);
}
