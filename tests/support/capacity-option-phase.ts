import type { EngineMeasurement } from '../../tools/capacity/profile.ts';

// The Option phase fields of an EngineMeasurement (D7 T7.26) for capacity-projection tests of earlier
// schemas, which price nothing from the Option phase: every count and byte figure is zero. A test whose
// expectation counted all 25,000 Trades at the stock Plan's bytes sets `bytesPerOptionTradeWithReflection`
// to the same figure, so the 17,500 stock and 7,500 option Trades together price as before.
export const NO_OPTION_PHASE: Pick<
  EngineMeasurement,
  | 'optionPlans'
  | 'optionLongCalls'
  | 'optionLongPuts'
  | 'optionCashSecuredPuts'
  | 'optionAuthorizedPlans'
  | 'optionEntries'
  | 'optionPartialExits'
  | 'expirations'
  | 'optionPlanOverheadRatio'
  | 'jsonBytesPerOptionTradeWithReflection'
  | 'bytesPerOptionTradeWithReflection'
  | 'optionExpirationOverheadRatio'
  | 'jsonBytesPerExpiration'
  | 'bytesPerExpiration'
> = {
  optionPlans: 0,
  optionLongCalls: 0,
  optionLongPuts: 0,
  optionCashSecuredPuts: 0,
  optionAuthorizedPlans: 0,
  optionEntries: 0,
  optionPartialExits: 0,
  expirations: 0,
  optionPlanOverheadRatio: 1,
  jsonBytesPerOptionTradeWithReflection: 0,
  bytesPerOptionTradeWithReflection: 0,
  optionExpirationOverheadRatio: 1,
  jsonBytesPerExpiration: 0,
  bytesPerExpiration: 0,
};
