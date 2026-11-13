import type { OpenTradeDetail } from '../../../app/types.ts';
import { Rational } from '../../../domain/values/index.ts';
import { decimalMoney as price, money, quantity, rMultiple, shortDate } from '../../format.ts';
import { contractCount } from '../option-words.ts';
import { Figure } from './figure.tsx';
import { ExposureFigures } from './RiskReward.tsx';
import { ValuationFigures } from './Valuation.tsx';
import { abs, type Evaluation } from './words.ts';

// The Position held at an earlier close, valued with that session's own exact Mark (P12, P13).
export function DatedSection({ line }: { readonly line: NonNullable<OpenTradeDetail['current']['datedLine']> }) {
  const mark = line.evaluation.observation.mark;
  return (
    <section className="card" aria-labelledby="dated-heading">
      <h2 id="dated-heading">{`At ${shortDate(line.tradingDate)} close`}</h2>
      <dl className="figure-grid">
        {mark && <Figure term="Mark">{price(mark.price)}</Figure>}
        <ValuationFigures evaluation={line.evaluation} />
        <ExposureFigures evaluation={line.evaluation} />
      </dl>
    </section>
  );
}

// Lots bought after the last close with an exact Mark: risk and reward measured from their prices, never a P&L (A54).
export function AtEntrySection({ atEntry, option }: { readonly atEntry: NonNullable<Evaluation['atEntry']>; readonly option: boolean }) {
  const inR = (dollars: Rational, planR: Rational) => `${money(dollars)} · ${rMultiple(planR)}`;
  return (
    <section className="card" aria-labelledby="at-entry-heading">
      <h2 id="at-entry-heading">At entry</h2>
      <dl className="figure-grid">
        <Figure term="Quantity">{option ? contractCount(quantity(abs(atEntry.quantity))) : `${quantity(atEntry.quantity)} shares`}</Figure>
        <Figure term="Average entry">{money(atEntry.averageEntry)}</Figure>
        <Figure term="Risk from entry">{inR(atEntry.riskFromEntry, atEntry.riskFromEntryInPlanR)}</Figure>
        <Figure term="Reward from entry">{inR(atEntry.rewardFromEntry, atEntry.rewardFromEntryInPlanR)}</Figure>
      </dl>
    </section>
  );
}
