import { Temporal } from 'temporal-polyfill';
import type { Clock } from '../domain/time/index.ts';
import type { IdGenerator } from '../persistence/index.ts';

// The production clock and identity generator; tests inject fixed ones instead.
export const systemClock: Clock = { now: () => Temporal.Now.instant().toString() };
export const randomIds: IdGenerator = { next: () => crypto.randomUUID() };
