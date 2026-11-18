// The Journal drawer's session cards (W10 to W13, A214): one card per session, newest first. The adapter (`drawers/journal.props`) turns the
// replay and the Detail's view into display values; without a replay this renders nothing, and the Journal section keeps the drawer.
import { useContext, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Badge } from '../Badge.tsx';
import { ReflectRequestContext } from '../screens/OwedDebtItem.tsx';
import { DrawerFocusContext, useDrawerRequest, type DrawerFocus } from '../screens/trade-detail/drawer-request.ts';
import { journalCards, type JournalCardsInput } from './drawers/journal.props.ts';
import type { JournalCardItem, JournalCardProps, OwedControl } from './drawers/journal.types.ts';

// About one screen of cards.
const PAGE_SIZE = 3;

// For the shell's Journal tab (T8P.22).
export { journalTabCount } from './drawers/journal.props.ts';

function Item({ item, control }: { readonly item: JournalCardItem; readonly control: OwedControl }) {
  if (item.owed) return <>{item.owed(control)}</>;
  return (
    <li>
      <h3>
        <Badge tone="neutral">{item.type}</Badge>
        {item.badges.map((badge) => (
          <Badge key={badge} tone="info">
            {badge}
          </Badge>
        ))}
      </h3>
      <p className="journal-line">{item.line}</p>      {item.declined ? (
        <>
          <p>
            <Badge tone="warning">{item.declined.badge}</Badge>
          </p>
          <dl>
            <dt>Reason</dt>
            <dd>{item.declined.reason}</dd>
          </dl>
        </>
      ) : (
        <dl className="answers">
          {item.answers.map(({ prompt, answer }) => (
            <div key={prompt}>
              <dt>{prompt}</dt>
              <dd>{answer}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

function Card({ card, hidden, controlOf }: { readonly card: JournalCardProps; readonly hidden: boolean; readonly controlOf: (itemId: string) => OwedControl }) {
  const headingId = `journal-card-${card.id}`;
  const headed = card.kind === 'Plan' || card.kind === 'List';
  return (
    <li hidden={hidden}>
      <article className="card journal-card" aria-labelledby={headingId}>
        {/* The Plan card and the one list are headed by their title (W11, W13); a session by its date (W10, W12). */}
        {headed ? (
          <>
            <h3 id={headingId}>{card.title}</h3>
            <p className="journal-card-when">{card.when}</p>
          </>
        ) : (
          <>
            <h3 id={headingId}>{card.when}</h3>
            {card.title && (
              <p className="journal-card-title" data-tone={card.titleTone}>
                {card.title}
              </p>
            )}
          </>
        )}
        {card.change && (
          <p className="journal-card-change" data-tone={card.changeTone}>
            {card.change}
          </p>
        )}
        {card.marks.length > 0 && (
          <dl className="journal-card-marks">
            {card.marks.map(({ label, value, gap }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{gap ? <span role="img" aria-label="No Mark">{value}</span> : value}</dd>
              </div>
            ))}
          </dl>
        )}
        {card.note && <p className="journal-card-note">{card.note}</p>}
        {card.items.length > 0 && (
          <ul className="narrative">
            {card.items.map((item) => (
              <Item key={item.id} item={item} control={controlOf(item.id)} />
            ))}
          </ul>
        )}
      </article>
    </li>
  );
}

export function JournalCards(input: JournalCardsInput) {
  // At most one owed reflection's form is open at a time; a resolved one stays as it rendered.
  const [active, setActive] = useState<{ readonly itemId: string; readonly resolved: boolean }>();
  const [requested, setPage] = useState(0);
  // A disabled button can't hold focus, so paging to either end hands focus to the other paging button (tech debt item 24). The page is
  // rendered first (flushSync), because the other button may itself be disabled until then.
  const newerButton = useRef<HTMLButtonElement>(null);
  const earlierButton = useRef<HTMLButtonElement>(null);
  const props = journalCards(input);
  const requestDrawer = useDrawerRequest();
  // "Reflect now" for a Debt (A217): the cards turn to the page holding that Debt's card, whose item opens its own form from the same request.
  // The page is set while rendering, once per new request (state adjusted from a changed input, not in an effect).
  const request = useContext(ReflectRequestContext);
  const [seen, setSeen] = useState<string>();
  if (request.debtId !== seen) {
    setSeen(request.debtId);
    const at = props?.cards.findIndex((card) => card.items.some((item) => item.id === request.debtId)) ?? -1;
    if (request.debtId !== undefined && at >= 0) setPage(Math.floor(at / PAGE_SIZE));
  }
  // W46: a request for a session's card turns the cards to the page holding it, once per request.
  const focus = useContext(DrawerFocusContext);
  const [seenFocus, setSeenFocus] = useState<DrawerFocus>();
  if (focus !== seenFocus) {
    setSeenFocus(focus);
    const card = typeof focus?.target === 'object' ? focus.target.card : undefined;
    const at = card === undefined ? -1 : (props?.cards.findIndex((c) => c.id === card) ?? -1);
    if (at >= 0) setPage(Math.floor(at / PAGE_SIZE));
  }
  if (!props) return null;
  const pages = Math.ceil(props.cards.length / PAGE_SIZE);
  // The page follows the list: the last page that has cards, and the first for a list that does not page.
  const page = props.heading ? Math.max(0, Math.min(requested, pages - 1)) : 0;
  const controlOf = (itemId: string): OwedControl => ({
    blocked: active !== undefined && !active.resolved && active.itemId !== itemId,
    onOpen: () => setActive({ itemId, resolved: false }),
    onClose: () => setActive(undefined),
    onResolved: () => setActive({ itemId, resolved: true }),
  });
  return (
    <section className="journal-cards" {...(props.heading && { 'aria-labelledby': 'journal-cards-heading' })}>
      {props.deviations && (
        <p className="journal-deviations">
          {props.deviations.line}{' '}
          <button type="button" className="pill secondary" onClick={() => requestDrawer('Plan and Risk', 'Deviations')}>
            {props.deviations.action}
          </button>
        </p>
      )}
      {props.heading && (
        <div className="journal-cards-head">
          <h2 id="journal-cards-heading">{props.heading}</h2>
          <button type="button" className="pill secondary" aria-label="Newer sessions" disabled={page === 0} ref={newerButton} onClick={() => {
              flushSync(() => setPage(page - 1));
              if (page - 1 === 0) earlierButton.current?.focus();
            }}>
            ‹
          </button>
          <button type="button" className="pill secondary" aria-label="Earlier sessions" disabled={page >= pages - 1} ref={earlierButton} onClick={() => {
              flushSync(() => setPage(page + 1));
              if (page + 1 >= pages - 1) newerButton.current?.focus();            }}>
            ›
          </button>
        </div>
      )}
      <ol>
        {props.cards.map((card, at) => (
          <Card key={card.id} card={card} hidden={Math.floor(at / PAGE_SIZE) !== page} controlOf={controlOf} />
        ))}
      </ol>
    </section>
  );
}
