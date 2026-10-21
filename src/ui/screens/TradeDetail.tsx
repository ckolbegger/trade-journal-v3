import { useCallback, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type { NarrativeAnswer, PlannedTradeDetail, TradeDetailView } from '../../app/types.ts';
import { decimalMoney as price, localTime, money, ratio } from '../format.ts';

export interface TradeDetailProps {
  readonly facade: UiFacade;
  readonly timeZone: string;
}

type DetailState =
  | { readonly kind: 'Loading' }
  | { readonly kind: 'Ready'; readonly view: TradeDetailView }
  | { readonly kind: 'NotFound' }
  | { readonly kind: 'Error' };

function answerText(answer: NarrativeAnswer): string {
  if (answer.kind === 'Text') return answer.text;
  if (answer.kind === 'Scale') return String(answer.value);
  if (answer.kind === 'Option') return answer.label;
  return 'Not answered';
}

export function TradeDetail({ facade, timeZone }: TradeDetailProps) {
  const { tradeId = '' } = useParams();
  // A Plan just confirmed arrives with its post-commit view, so it is shown without a read.
  const confirmed = (useLocation().state as { confirmed?: PlannedTradeDetail } | null)?.confirmed;
  const [state, setState] = useState<DetailState>(confirmed?.tradeId === tradeId ? { kind: 'Ready', view: confirmed } : { kind: 'Loading' });

  // State is set only when the read settles; Retry resets to Loading itself.
  const request = useCallback(() => {
    facade.TradeViewsAndReporting.getTradeDetail({ tradeId }).then(
      (result) =>
        setState(
          result.kind === 'Ready' ? { kind: 'Ready', view: result.view } : result.kind === 'NotFound' ? { kind: 'NotFound' } : { kind: 'Error' },
        ),
      () => setState({ kind: 'Error' }),
    );
  }, [facade, tradeId]);

  const retry = () => {
    setState({ kind: 'Loading' });
    request();
  };

  const alreadyShown = confirmed?.tradeId === tradeId;
  useEffect(() => {
    if (!alreadyShown) request();
  }, [alreadyShown, request]);

  if (state.kind === 'Loading') return <p role="status">Loading the Trade…</p>;
  if (state.kind === 'NotFound') {
    return (
      <section className="card">
        <h1>Trade not found</h1>
        <p>No Trade with this identity exists in this journal.</p>
      </section>
    );
  }
  if (state.kind === 'Error') {
    return (
      <section className="card">
        <p>We couldn’t load this trade. Nothing was changed.</p>
        <button type="button" className="pill secondary" onClick={retry}>
          Retry
        </button>
      </section>
    );
  }

  const { view } = state;
  const leg = view.plan.legs[0];
  const stop = view.plan.stops[0];
  const target = view.plan.targets[0];
  const entry = view.journal[0];
  return (
    <article className="trade-detail">
      <header>
        <h1>{view.plan.underlying}</h1>
        <p>
          {view.labels.strategy} · <span className="badge">{view.lifecycle.stored}</span>
        </p>
      </header>
      <section className="card" aria-labelledby="plan-heading">
        <h2 id="plan-heading">Plan</h2>
        <dl>
          <dt>Leg</dt>
          <dd>{leg ? `${leg.side} ${leg.quantity} shares of ${leg.instrument.symbol}` : ''}</dd>
          <dt>Intended entry</dt>
          <dd className="number">{leg ? price(leg.intendedEntry) : ''}</dd>
          <dt>Stop</dt>
          <dd className="number">{stop ? price(stop.price) : ''}</dd>
          <dt>Target</dt>
          <dd className="number">{target ? price(target.price) : ''}</dd>
          <dt>Plan time</dt>
          <dd>{localTime(view.plan.planTime, timeZone)}</dd>
          <dt>Account</dt>
          <dd>{`${view.labels.institution} — ${view.labels.account}`}</dd>
        </dl>
      </section>
      <section className="card" aria-labelledby="baseline-heading">
        <h2 id="baseline-heading">Plan Baseline</h2>
        <dl>
          <dt>1R (original risk)</dt>
          <dd className="number">{money(view.baseline.oneR)}</dd>
          <dt>Original reward</dt>
          <dd className="number">{money(view.baseline.originalPlannedReward)}</dd>
          <dt>Reward : risk</dt>
          <dd className="number">{ratio(view.baseline.rewardRiskRatio)}</dd>
        </dl>
      </section>
      {entry && 'responses' in entry && (
        <section className="card" aria-labelledby="reflection-heading">
          <h2 id="reflection-heading">{entry.entryType}</h2>
          <dl>
            {entry.responses.map((response) => (
              <div key={response.prompt}>
                <dt>{response.prompt}</dt>
                <dd>{answerText(response.answer)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </article>
  );
}
