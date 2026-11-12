// D7's option reference Trades for the UI tests (breakdown, section 4), with the engine's own derivation.
import { derive } from '../../src/domain/trade-analysis/index.ts';
import { OC_CONTRACT, OC_E1, OC_PC1, OC_PC2, OC_X1, ocChange, ocRecord, opChange, opRecord, OS_CONTRACT, OS_ES, OS_S1, OS2_S1, osChange, osRecord } from '../../src/domain/trade-analysis/option-trade.ts';

export { OC_CONTRACT, OC_E1, OC_PC1, OC_PC2, OC_X1, ocChange, OS_CONTRACT, OS_ES, OS_S1, OS2_S1, osChange };

// O-C after PC1, PC2, and X1 (a Long Call exit), and O-S after S1 (a Cash-Secured Put entry).
export function optionTrade(which: 'O-C' | 'O-S') {
  const record = which === 'O-C' ? ocRecord([OC_PC1, OC_PC2, OC_X1]) : osRecord([OS_S1]);
  const derivation = derive({ record });
  if (derivation.kind !== 'Derived') throw new Error('incoherent fixture');
  return { record, derivation };
}

// O-C and O-S after their Expiration: O-C's last contract (E1) following PC1, PC2, and X1's sale, and both of
// O-S's contracts (ES) following S1.
export function expiredOptionTrade(which: 'O-C' | 'O-S') {
  const record = which === 'O-C' ? ocRecord([OC_PC1, OC_PC2, OC_X1, OC_E1]) : osRecord([OS_S1, OS_ES]);
  const derivation = derive({ record });
  if (derivation.kind !== 'Derived') throw new Error('incoherent fixture');
  return { record, derivation };
}

// The Long Put on ABC bought 2 contracts and closed by a Sell to close of 2: Closed, with its derivation.
export function closedLongPutTrade() {
  const record = { ...opRecord([opChange('pc-p1', '2026-10-12T14:00:00Z', 1, 'Buy', '2', '1.50', '1.30'), opChange('pc-px', '2026-10-13T14:00:00Z', 3, 'Sell', '2', '2.00', '1.30')]), storedLifecycle: 'Closed' as const };
  const derivation = derive({ record });
  if (derivation.kind !== 'Derived') throw new Error('incoherent fixture');
  return { record, derivation };
}
