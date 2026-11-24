// I95.26-B1 A Stop read on the Underlying (Daily Review, "Date, eligibility, and ordering"): the contract's own Mark is acknowledged unavailable
// but the Underlying's Mark is in, past the Stop. The Trade keeps its Stop-reached band and its "Past Stop" label, and no figure is invented.
import { describe, expect, it } from 'vitest';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { labelsOf } from '../../../src/ui/screens/review-attention.ts';
import { confirmOption, MNO_PUT, onboardedAt, OS_S1, recordOption, saveMark } from '../d7/support.ts';
import { openOn, walkOf } from './support.ts';

const TUE_1700 = '2026-10-13T21:00:00Z';
const TUESDAY = '2026-10-13';

describe('I95.26-B1 A Stop reached on the Underlying with the contract Mark unavailable', () => {
  it('I95.26-B1 should label the short put Past Stop in the Stop reached band with its P&L still Unavailable', { timeout: 120_000 }, async () => {
    const { app } = await onboardedAt(TUE_1700);
    const tradeId = (await confirmOption(app, 'O-S')).postCommit.trade.tradeId;
    await recordOption(app, tradeId, 'Sell', OS_S1);
    const acknowledged = await app.MarketData.save({ intention: 'AssertUnavailable', instrumentKey: instrumentKey(MNO_PUT), tradingDate: TUESDAY, reason: 'No quote available.', expectedResolutionRevision: 'None' });
    expect(acknowledged.kind).toBe('Saved');
    await saveMark(app, 'MNO', TUESDAY, '41.00');

    const walked = walkOf(await openOn(app, TUE_1700)).find((t) => t.tradeId === tradeId)!;

    expect(walked.band).toBe('StopReached');
    expect(labelsOf(walked)).toEqual(['Past Stop']);
    expect(walked.basis).toMatchObject({ kind: 'Unavailable', reason: 'AcknowledgedUnavailable' });
  });
});
