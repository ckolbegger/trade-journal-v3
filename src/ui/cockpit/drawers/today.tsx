import { Link } from 'react-router';
import { Badge } from '../../Badge.tsx';
import { Figure } from '../../screens/trade-detail/figure.tsx';
import { PriceTrack } from '../track.tsx';
import type { CurrentMarks, MarkCell, TodayDrawerProps } from './today.types.ts';
import { todayProps, type TodayInput } from './today.props.ts';

const MarkValue = ({ cell }: { readonly cell: MarkCell }) => (
  <>
    <span>{cell.price}</span>
    {cell.provenance && <small className="provenance">{cell.provenance}</small>}
    {cell.correction !== undefined && (
      <small className="provenance">
        <Badge tone="info">Corrected</Badge> {cell.correction}
      </small>
    )}
  </>
);

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

// The current Marks card (revision 96).
const CurrentMarksCard = ({ currentMarks }: { readonly currentMarks: CurrentMarks }) => (
  <section className="card current-marks">
    {currentMarks.missing && (
      <p>
        <Link to={currentMarks.missing.to}>{currentMarks.missing.text}</Link>
      </p>
    )}
    {currentMarks.acknowledged && <p>{currentMarks.acknowledged}</p>}
    {currentMarks.stale && <p>{currentMarks.stale}</p>}
    <dl className="figure-grid">
      {currentMarks.rows.map(({ label, value, plain }) => (
        <Figure key={label} term={label} {...(plain && { plain })}>
          {value}
        </Figure>
      ))}
    </dl>
    {currentMarks.correction !== undefined && (
      <p>
        <Badge tone="info">Corrected</Badge> {currentMarks.correction}
      </p>
    )}
  </section>
);

// What a state without a Today drawer shows in its Position drawer: the current Marks card and nothing else of Today's (revision 96, T8P.31).
export function CurrentMarksOnly(input: TodayInput) {
  const { currentMarks } = todayProps(input);
  return currentMarks ? <CurrentMarksCard currentMarks={currentMarks} /> : null;
}

// The Today drawer's content from finished props (A216).
export function TodayDrawerView({ marks, currentMarks, noMarksText, tracksHeading, tracks, valuedAt, atEntry }: TodayDrawerProps) {
  return (
    <>
      {noMarksText && <p className="waiting">{noMarksText}</p>}
      {currentMarks && <CurrentMarksCard currentMarks={currentMarks} />}
      {marks && (
        <section className="card" aria-labelledby="today-marks-heading">
          <h2 id="today-marks-heading">{marks.heading}</h2>
          <div className="table-scroll" role="region" aria-label={marks.heading} tabIndex={0}>
            <table className="trades" aria-labelledby="today-marks-heading">
              <thead>
                <tr>
                  <td />
                  {marks.columns.map((column) => (
                    <th key={column} scope="col" className="number">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {marks.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td className="number">
                      <MarkValue cell={row.earlier} />
                    </td>
                    <td className="number">
                      <MarkValue cell={row.current} />
                    </td>
                    <td className="number">{row.change}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {marks.note && <p className="grid-note">{marks.note}</p>}
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
}

// What the shell places: the Detail view and zone, and the replay once Trade Detail reads it.
export const TodayDrawer = (input: TodayInput) => <TodayDrawerView {...todayProps(input)} />;
