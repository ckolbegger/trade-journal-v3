import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { CardPager, useCardsPerPage } from '../card-pager.tsx';
import { Words } from './figure-words.tsx';
import type { ReadoutValue, SessionCard, SessionCardsProps } from './replay.types.ts';

// A card's least width and the gap between cards, in px: the carousel's width over these is how many fit.
const CARD_WIDTH = 280;
const CARD_GAP = 12;

// W61: a value that needs a Mark it does not have is a dash named "No Mark", as in Price History and the readout.
function shown(value: ReadoutValue) {
  return value.kind === 'Unavailable' && value.text === 'No Mark' ? (
    <span role="img" aria-label="No Mark">
      —
    </span>
  ) : (
    <Words text={value.text} />
  );
}

// One row: a figure, or a stake row's amount, R and where the Trade would end: "$672.00 · 2.07R · P&L if hit +$316.00".
function Row({ row }: { readonly row: SessionCard['rows'][number] }) {
  return (
    <div className="replay-card-row" data-row={row.label} data-weight={row.weight} title={row.term}>
      <dt>{row.label}</dt>
      <dd>
        <span className="replay-value" data-kind={row.value.kind}>
          {row.spoken ? (
            // A267: the odds are heard in full, where the page shows them as ratio-like marks; only the odds part is labelled.
            <>
              <Words text={row.value.text.split(' · ')[0]!} /> · <span role="img" aria-label={row.spoken}><Words text={row.value.text.split(' · ').slice(1).join(' · ')} /></span>
            </>
          ) : (
            shown(row.value)
          )}
        </span>
        {row.r && <> · <span data-kind={row.r.kind}>{shown(row.r)}</span></>}
        {row.tag && <span className="replay-chip-tag">{row.tag}</span>}
        {row.pnl && <> · P&L if hit <span data-kind={row.pnl.kind}>{shown(row.pnl)}</span></>}
      </dd>
    </div>
  );
}

// A277: the session cards, newest first. A card's heading is a button named by its session; pressing it moves the slider. The list's id is what
// the charts name in `aria-describedby`.
export function SessionCards({ title, newerLabel, earlierLabel, cards, id, onSelectSession }: SessionCardsProps) {
  const [requested, setPage] = useState(0);
  // The slider's card is the newest, so when the slider moves the cards turn back to the first page (state adjusted from a changed input).
  const [seen, setSeen] = useState(cards[0]?.id);
  if (cards[0]?.id !== seen) {
    setSeen(cards[0]?.id);
    setPage(0);
  }
  const list = useRef<HTMLOListElement>(null);
  // A page holds the cards that fit side by side, at least one; cards outside it stay in the page, hidden.
  const perPage = useCardsPerPage(list, CARD_WIDTH, CARD_GAP);
  const pages = Math.max(1, Math.ceil(cards.length / perPage));
  const page = Math.min(requested, pages - 1);
  // A resize that changes the page size repaginates; a card heading it hides or a paging button it disables can't hold focus, so focus goes to an
  // enabled paging button, or with none (one page) to the first shown card's heading.
  const root = useRef<HTMLElement>(null);
  const sized = useRef(perPage);
  useLayoutEffect(() => {
    if (sized.current === perPage) return;
    sized.current = perPage;
    const held = document.activeElement;
    if (!root.current || !held || !root.current.contains(held)) return;
    if (!held.closest('li[hidden]') && !(held as HTMLButtonElement).disabled) return;
    root.current.querySelector<HTMLElement>('.replay-cards-head button:not(:disabled), li:not([hidden]) h4 button')?.focus();
  }, [perPage]);
  return (
    <section className="replay-cards" ref={root} aria-labelledby={`${id}-title`} style={{ '--cards-per-page': perPage } as CSSProperties}>
      <div className="replay-cards-head">
        <h3 id={`${id}-title`}>{title}</h3>
        <CardPager page={page} pages={pages} onPage={setPage} newerLabel={newerLabel} earlierLabel={earlierLabel} />
      </div>
      <ol id={id} className="replay-cards-list" ref={list}>
        {cards.map((card, at) => (
          <li key={card.id} hidden={Math.floor(at / perPage) !== page}>
            <article className="card replay-session-card" {...(card.isCurrent && { 'aria-current': 'true' })}>
              <h4>
                <button type="button" onClick={() => onSelectSession(card.id)}>
                  {card.heading}
                </button>
              </h4>
              {/* W56: a Trade past a line, in one row above the stake rows. */}
              {card.pastLine && (
                <p className="replay-past-line" title={card.pastLine.term}>
                  <Words text={card.pastLine.text} />
                </p>
              )}
              <dl>
                {card.rows.map((row) => (
                  <Row key={row.label} row={row} />
                ))}
                {card.events.length > 0 && (
                  <div className="replay-card-row" data-row="Events">
                    <dt>Events</dt>
                    <dd>
                      <Words text={card.events.join('; ')} />
                    </dd>
                  </div>
                )}
              </dl>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
