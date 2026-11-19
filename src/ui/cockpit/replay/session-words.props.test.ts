import { describe, expect, it } from 'vitest';
import { sessionWords } from './session-words.props.ts';
import { AXIO, BREN, brenMon1102, condition, DALE, frac, NOT_APPLICABLE, session, usd, value, view } from './view-doubles.props.ts';

describe('replay.props: how it is going (W36, W37)', () => {
  it('should head R-BREN-U\'s Mon 11-02 "+$28.00 · 0.09R" and "Ahead: 3% of the way to the Target."', () => {
    const words = sessionWords(view([brenMon1102]), 0);
    expect(words.headline).toEqual({ figure: '+$28.00 · 0.09R', tone: 'Profit' });
    expect(words.howItIsGoing).toBe('Ahead: 3% of the way to the Target.');
  });

  it('should say "Behind: 63% of the way to the Stop." for R-AXIO-D on Fri 11-06', () => {
    const axioFri1106 = session({
      date: '2026-11-06',
      instrument: AXIO,
      held: 200,
      pnl: -380,
      pnlR: frac(-380, 600),
      standing: value({ zone: 'Between', share: frac(380, 600) }),
    });
    const words = sessionWords(view([axioFri1106]), 0);
    expect(words.headline).toEqual({ figure: '−$380.00 · −0.63R', tone: 'Loss' });
    expect(words.howItIsGoing).toBe('Behind: 63% of the way to the Stop.');
  });

  it('should say "Past the Stop by $180.00 (0.30R)." once the Stop is breached', () => {
    const axioMon1109 = session({
      date: '2026-11-09',
      instrument: AXIO,
      held: 100,
      pnl: -920,
      standing: value({ zone: 'PastStop', pastBy: { dollars: usd(180), r: frac(3, 10), crossed: true } }),
    });
    expect(sessionWords(view([axioMon1109]), 0).howItIsGoing).toBe('Past the Stop by $180.00 (0.30R).');
  });

  it('should say "Target reached, $32.00 past it." for R-BREN-U on Mon 11-16', () => {
    const brenMon1116 = session({
      date: '2026-11-16',
      held: 2,
      pnl: 988,
      standing: value({ zone: 'PastTarget', pastBy: { dollars: usd(32), r: frac(32, 324), crossed: true } }),
    });
    expect(sessionWords(view([brenMon1116]), 0).howItIsGoing).toBe('Target reached, $32.00 past it.');
    const atTarget = session({ date: '2026-11-16', pnl: 956, standing: value({ zone: 'PastTarget', pastBy: { dollars: usd(0), r: usd(0), crossed: true } }) });
    expect(sessionWords(view([atTarget]), 0).howItIsGoing).toBe('Target reached.');
  });

  it('should head a session without a Mark with the line No Mark for the call on Tue Nov 10 said once, and no figure of another session', () => {
    const corvMon1109 = session({ date: '2026-11-09', pnl: 642, pnlR: frac(642, 318), standing: value({ zone: 'Between', share: frac(642, 867) }) });
    const corvTue1110 = session({ date: '2026-11-10', pnl: null });
    const words = sessionWords(view([corvMon1109, corvTue1110]), 1);
    expect(words.headline).toEqual({ reason: 'No Mark for the call on Tue Nov 10.', tone: 'None' });
    expect(words.headline).not.toHaveProperty('figure');
    // Said once: the sentence under the headline no longer repeats it.
    expect(words.howItIsGoing).toBe('');
    expect(words.stake).toBeNull();
  });

  it('should keep the acknowledgment own words on a session whose Mark the trader acknowledged as unavailable, and never say No Mark for there', () => {
    const date = '2026-11-10';
    const gap = session({ date, pnl: null });
    const acknowledged = { ...gap, tradePnl: { kind: 'Unavailable', reason: 'AcknowledgedUnavailable', instrument: BREN, date } } as typeof gap;
    const words = sessionWords(view([acknowledged]), 0);
    expect(words.headline).toEqual({ reason: 'Acknowledged unavailable: BREN Nov 20 $100 Call, Tue Nov 10', tone: 'None' });
    expect(words.headline.reason).not.toContain('No Mark for');
    expect(words.howItIsGoing).toBe('');
  });

  it('should head a final session "Final result: sold out Fri Nov 13." or "Final result: the put expired Fri Nov 20."', () => {
    const sold = session({ date: '2026-11-13', held: 0, pnl: 1260, realized: 1260, standing: NOT_APPLICABLE, final: { kind: 'Sold' } });
    const soldWords = sessionWords(view([sold]), 0);
    expect(soldWords.howItIsGoing).toBe('Final result: sold out Fri Nov 13.');
    expect(soldWords.headline).toEqual({ figure: '+$1,260.00', tone: 'Profit' });
    const expired = session({ date: '2026-11-20', instrument: DALE, held: 0, pnl: 564, realized: 564, standing: NOT_APPLICABLE, final: { kind: 'Expired', contract: DALE } });
    expect(sessionWords(view([expired]), 0).howItIsGoing).toBe('Final result: the put expired Fri Nov 20.');
  });

  it("should say \"Past the Stop's planned amount by $9.00, though DALE is still above $54.00.\" for R-DALE-D on Thu 11-12", () => {
    const daleThu1112 = session({
      date: '2026-11-12',
      instrument: DALE,
      held: -3,
      pnl: -1272,
      standing: value({ zone: 'PastStop', pastBy: { dollars: usd(9), r: frac(9, 1536), crossed: false } }),
      figures: { conditions: [condition('Stop', 'UnderlyingPrice', '54.00')] },
    });
    expect(sessionWords(view([daleThu1112]), 0).howItIsGoing).toBe("Past the Stop's planned amount by $9.00, though DALE is still above $54.00.");
    // A long stock Target reached in dollars while the price is short of its trigger: the price is still below it.
    const axioTarget = session({
      date: '2026-11-17',
      instrument: AXIO,
      held: 200,
      pnl: 1100,
      standing: value({ zone: 'PastTarget', pastBy: { dollars: usd(40), r: frac(40, 600), crossed: false } }),
      figures: { conditions: [condition('Target', 'UnderlyingPrice', '56.00')] },
    });
    expect(sessionWords(view([axioTarget]), 0).howItIsGoing).toBe("Past the Target's planned amount by $40.00, though AXIO is still below $56.00.");
  });
});
