import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react';
import { PriceTrack } from '../track.tsx';
import type { TodayDrawerProps } from './today.types.ts';
import { todayProps, type TodayInput } from './today.props.ts';

// A line that may wrap only at its spaces: each word is held whole, so a date breaks neither at its hyphens nor a time at its colon.
const Words = ({ text }: { readonly text: string }) =>
  text.split(' ').map((word, index) => (
    <Fragment key={index}>
      {index > 0 && ' '}
      <span className="whole">{word}</span>
    </Fragment>
  ));

// The comparison's scroll box, kept at its right end: where the table is wider than a phone, the current date and Change show first and the
// earlier date is the one reached by scrolling back. It follows a change of size (a turned phone); a reader's own scroll stays.
function ScrollsToEnd({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const toEnd = () => {
      element.scrollLeft = element.scrollWidth;
    };
    toEnd();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(toEnd);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={box} className="table-scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

// A card of labelled figures: the dated line and At entry.
const FigureCard = ({ id, heading, rows }: { readonly id: string; readonly heading: string; readonly rows: readonly { readonly label: string; readonly value: string }[] }) => (
  <section className="card" aria-labelledby={id}>
    <h2 id={id}>{heading}</h2>
    <dl className="figure-grid">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd className="number">{row.value}</dd>
        </div>
      ))}
    </dl>
  </section>
);

// The Stale context and the acknowledgment, each only where it applies, under the table.
const Notes = ({ notes }: { readonly notes: NonNullable<TodayDrawerProps['notes']> }) => (
  <>
    {notes.acknowledged && <p className="grid-note">{notes.acknowledged}</p>}
    {notes.stale && <p className="grid-note">{notes.stale}</p>}
  </>
);

// The Today drawer's content from finished props (A216).
export function TodayDrawerView({ marks, notes, stamp, noMarksText, tracksHeading, tracks, valuedAt, atEntry }: TodayDrawerProps) {
  const content = (
    <>
      {stamp && <p className="closed-stamp">{stamp}</p>}
      {noMarksText && <p className="waiting">{noMarksText}</p>}
      {!marks && notes && (
        <section className="card">
          <Notes notes={notes} />
        </section>
      )}
      {marks && (
        <section className="card" aria-labelledby="today-marks-heading">
          <h2 id="today-marks-heading">Marks</h2>
          <ScrollsToEnd label="Marks">
            <table className="trades" aria-labelledby="today-marks-heading">
              <thead>
                <tr>
                  <td />
                  {marks.columns.map((column) => (
                    <th key={column} scope="col" className="number">
                      <Words text={column} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {marks.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td className="number" aria-label={row.todayName}>
                      <span>{row.today}</span>
                    </td>
                    <td className="number" aria-label={row.yesterdayName}>
                      <span>{row.yesterday}</span>
                    </td>
                    <td className="number">{row.change}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollsToEnd>
          {notes && <Notes notes={notes} />}
        </section>
      )}
      {tracks.length > 0 && (
        <section className="card" aria-labelledby="today-tracks-heading">
          <h2 id="today-tracks-heading">{tracksHeading}</h2>
          <div className="tracks">
            {tracks.map((track) => (
              <PriceTrack key={track.title} {...track} />
            ))}
          </div>
        </section>
      )}
      {valuedAt && <FigureCard id="today-valued-at-heading" {...valuedAt} />}
      {atEntry && <FigureCard id="today-at-entry-heading" {...atEntry} />}
    </>
  );
  // A Closed Trade's Today is greyed as a whole (A242); the other states add no wrapper.
  return stamp ? <div className="closed-today">{content}</div> : content;
}

// What the shell places: the Detail view and zone, and the replay once Trade Detail reads it.
export const TodayDrawer = (input: TodayInput) => <TodayDrawerView {...todayProps(input)} />;
