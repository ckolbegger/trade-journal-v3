import { useEffect, useId, useRef, useState } from 'react';
import { ExpirationForm } from './ExpirationForm.tsx';
import type { UiFacade } from '../../app/compose.ts';
import type { DailyTradeReview, SettlementItem, TradeSaveBinding } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { signed } from '../figures.ts';
import { money, rMultiple, shortDate } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import type { SavedAction } from './ActionForm.tsx';
import type { FormHandle } from './form-handle.ts';

export interface ExpirationBlockProps {
  readonly facade: UiFacade;
  readonly item: SettlementItem;
  readonly underlying: string;
  // Where the contract finished, from the view; absent when the Trade's facts cannot be replayed.
  readonly standing: DailyTradeReview['expirationStanding'];
  // The card's binding: Settle Later presents it as an Action does.
  readonly binding: TradeSaveBinding;
  // A Settle Later is already saved for the Review Date.
  readonly settledLater: boolean;
  // The Review Date of an earlier Settle Later, which this Review asks again (W144); absent when there is none.
  readonly settledLaterOn: DailyTradeReview['settledLaterOn'];
  readonly onSaved: (saved: SavedAction) => void;
  // The Review is being read again, so a save would present the old binding.
  readonly pending: boolean;
  // "Sold before the close": the card's sale form opens in place of the block.
  readonly onSell: () => void;
  // The expiration form's values and its own save, for the card's unsaved-form rules (W128).
  readonly onDirtyChange: (dirty: boolean) => void;
  readonly onForm: (handle: FormHandle | undefined) => void;
  // The expiration closed the Trade: the card leaves out its open-position figures, and the Review is read again once the receipt is dismissed.
  readonly onClosedSale: () => void;
  readonly onRefresh: () => Promise<boolean>;
  readonly onLeftSold?: () => void;
  // The recorded expiration's receipt was dismissed and the card read again: the Review moves focus on.
  readonly onReceiptDone?: () => void;
}

const ZERO = Rational.of(0n);
const unsigned = (amount: Rational): Rational => (amount.compare(ZERO) < 0 ? amount.mul(Rational.of(-1n)) : amount);

// A refused save that read the Review again would not repeat itself; any other refusal could not write at all.
const refusalOf = (kind: string): 'Changed' | 'Failed' => (['ReviewChanged', 'ChangedDuringAssembly', 'Conflict'].includes(kind) ? 'Changed' : 'Failed');

// Where the Underlying finished against the strike, in words.
function sideOf(price: Rational, strike: Rational): string {
  const order = price.compare(strike);
  if (order === 0) return 'at';
  return order > 0 ? 'above' : 'below';
}

// What expiring worthless means to the trader, from the cost of the contracts that expire: a long contract loses what was paid, a short one keeps what was received.
function kept(cost: Rational): string {
  const amount = money(unsigned(cost));
  return cost.compare(ZERO) > 0 ? `You lose the ${amount} paid.` : `You keep ${amount}.`;
}

// The expired contract's block on the card (W136): an expired contract owes no Action, only a word on how it settled.
export function ExpirationBlock({ facade, item, underlying, standing, binding, settledLater, settledLaterOn, onSaved, pending, onSell, onDirtyChange, onForm, onClosedSale, onRefresh, onLeftSold, onReceiptDone }: ExpirationBlockProps) {
  const { writable, report, timeZone } = useRuntime();
  const finished = standing?.kind === 'Value' ? standing.value : undefined;
  const long = item.quantity.compare(Rational.of(0n)) > 0;
  // A date outside the market calendar has no settlement time to record at (D7 Q1).
  const recordable = item.settlementTime.kind === 'Value';
  const laterId = useId();
  const [saving, setSaving] = useState(false);
  // What a refused save says: the Review changed under it (Refresh reads it again), or it could not be saved at all.
  const [refused, setRefused] = useState<'Changed' | 'Failed' | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  // "It expired worthless" in the money: what it would book, and the form that asks why.
  const [opened, setOpened] = useState<'plain' | 'why' | undefined>();
  // A recorded expiration is read again once the receipt is dismissed; a card left first has the Review read at once.
  const readOwed = useRef(false);
  const leftSold = useRef(onLeftSold);
  useEffect(() => {
    leftSold.current = onLeftSold;
  });
  useEffect(
    () => () => {
      if (readOwed.current) leftSold.current?.();
    },
    [],
  );
  const recordLater = async () => {
    if (saving || pending) return;
    setSaving(true);
    try {
      // A Settle Later records no Trade fact: it only lets this Review finish (A315).
      const result = await facade.DailyReview.save({ kind: 'SettleLater', binding });
      // A refusal to write switches the whole shell to read only.
      report(result);
      setRefused(result.kind === 'Saved' ? undefined : refusalOf(result.kind));
      if (result.kind === 'Saved') onSaved(result);
    } finally {
      setSaving(false);
    }
  };
  const refresh = async () => {
    setRefreshing(true);
    try {
      if (await onRefresh()) setRefused(undefined);
    } finally {
      setRefreshing(false);
    }
  };
  const sellButton = (words: string) => (
    <button type="button" className="pill secondary" disabled={saving} onClick={onSell}>
      {words} before the close
    </button>
  );
  const laterButton = (main: boolean) =>
    !settledLater && (
      <button type="button" className={`pill ${main ? 'primary' : 'secondary'}`} aria-describedby={finished?.inTheMoney ? laterId : undefined} disabled={saving || pending} onClick={() => void recordLater()}>
        {long ? 'Exercised' : 'Assigned'}: record later
      </button>
    );
  return (
    <section aria-label="Expired contract">
      <h4>Expired {shortDate(item.expiration)} · no Action needed</h4>
      {finished?.inTheMoney && (
        <>
          <p>
            {underlying} {money(finished.underlyingPrice)}, strike {money(finished.strike)}: {money(finished.amount)} in the money
          </p>
          <p>
            Worth {money(unsigned(finished.worth))} at expiration: {signed(money)(finished.ifSettled.dollars)} · {signed(rMultiple)(finished.ifSettled.r)} on the Trade.
          </p>
        </>
      )}
      {finished && !finished.inTheMoney && (
        <p>
          {underlying} {money(finished.underlyingPrice)}, {sideOf(finished.underlyingPrice, finished.strike)} the {money(finished.strike)} strike: expired worthless. {kept(finished.contractsCost)}
        </p>
      )}
      {!finished && <p>No price for {underlying}, so the app can&apos;t say where it finished. What happened?</p>}
      {settledLaterOn && !settledLater && (
        <p>
          {shortDate(settledLaterOn)} you chose {long ? 'Exercised' : 'Assigned'}: record later. It is still to settle, so this Review asks again.
        </p>
      )}
      {settledLater && <p>{long ? 'Exercised' : 'Assigned'}, to record later. Today&apos;s Review can finish. The next Review asks again.</p>}
      {refused === 'Failed' && <p role="alert">This could not be saved. Nothing was saved.</p>}
      {refused === 'Changed' && (
        <div role="alert">
          <p>The Review changed after you opened this Trade. Nothing was saved. Refresh to see the current Review.</p>
          <button type="button" className="pill secondary" disabled={refreshing} onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      )}
      {writable && !opened && (
        <div className="expiration-choices">
          {finished?.inTheMoney && laterButton(true)}
          {finished?.inTheMoney && sellButton(long ? 'Sold' : 'Bought back')}
          {finished && !finished.inTheMoney && recordable && (
            <button type="button" className="pill primary" disabled={saving} onClick={() => setOpened('plain')}>
              Record expiration
            </button>
          )}
          {finished && !finished.inTheMoney && sellButton(long ? 'Sold it' : 'Bought it back')}
          {!finished && laterButton(false)}
          {!finished && sellButton(long ? 'Sold' : 'Bought back')}
          {!finished && recordable && (
            <button type="button" className="pill secondary" disabled={saving} onClick={() => setOpened('plain')}>
              It expired worthless
            </button>
          )}
          {finished?.inTheMoney && recordable && (
            <button type="button" className="link-button" disabled={saving} onClick={() => setOpened('why')}>
              It expired worthless
            </button>
          )}
        </div>
      )}
      {finished?.inTheMoney && !settledLater && (
        <p id={laterId} className="hint">
          {`The app can't record ${long ? 'an exercise' : 'an assignment'} yet. This only lets today's Review finish. The next Review asks again.`}
        </p>
      )}
      {opened && (
        <div>
          {opened === 'why' && finished && (
            <p>
              This books {signed(money)(finished.ifExpiredWorthless.dollars)} · {signed(rMultiple)(finished.ifExpiredWorthless.r)} on a {item.instrument.right.toLowerCase()} worth {money(unsigned(finished.worth))}.
            </p>
          )}
          <ExpirationForm facade={facade} tradeId={binding.tradeId} timeZone={timeZone ?? 'UTC'} onDirtyChange={onDirtyChange} onDone={() => setOpened(undefined)} backLabel="Back to the Review" fromReview card={{
              onRecorded: () => {
                readOwed.current = true;
                onClosedSale();
              },
              onDismiss: () => {
                void onRefresh().then((read) => {
                  if (!read) return;
                  readOwed.current = false;
                  onReceiptDone?.();
                });
              },
              onForm,
            }} askWhy={opened === 'why'} submitLabel={opened === 'why' ? 'Record expiration anyway' : 'Record expiration'} />
        </div>
      )}
    </section>
  );
}
