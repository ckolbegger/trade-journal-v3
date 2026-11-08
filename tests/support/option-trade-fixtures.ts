// D7's option reference Trades for the UI tests (breakdown, section 4), with the engine's own derivation.
import { derive } from '../../src/domain/trade-analysis/index.ts';
import { OC_CONTRACT, OC_PC1, OC_PC2, OC_X1, ocRecord, OS_CONTRACT, OS_S1, osRecord } from '../../src/domain/trade-analysis/option-trade.ts';

export { OC_CONTRACT, OS_CONTRACT };

// O-C after PC1, PC2, and X1 (a Long Call exit), and O-S after S1 (a Cash-Secured Put entry).
export function optionTrade(which: 'O-C' | 'O-S') {
  const record = which === 'O-C' ? ocRecord([OC_PC1, OC_PC2, OC_X1]) : osRecord([OS_S1]);
  const derivation = derive({ record });
  if (derivation.kind !== 'Derived') throw new Error('incoherent fixture');
  return { record, derivation };
}
