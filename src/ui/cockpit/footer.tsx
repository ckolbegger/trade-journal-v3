// The footer below the drawers (W16, P96, A216): Planned-Leg Fulfillment and Deviations as plain-prop sections. The shell hands it a Detail's
// view, and the adapter turns that into finished display values.
import { footerProps, type FooterSource } from './footer.props.ts';
import type { DetailFooterProps, DetailFooterSection } from './footer.types.ts';

function Section({ section }: { readonly section: DetailFooterSection }) {
  return (
    <section className="card" aria-labelledby={`${section.id}-heading`}>
      <h2 id={`${section.id}-heading`}>{section.heading}</h2>
      {section.rows.length > 0 && (
        <dl className="figure-grid one-column">
          {section.rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {section.note !== undefined && <p>{section.note}</p>}
      {section.items.length > 0 && (
        <ul>
          {section.items.map((item, at) => (
            <li key={at}>
              {item.superseded ? (
                <>
                  <span className="visually-hidden">Superseded</span>{' '}
                  <del>{item.text}</del>
                </>
              ) : (
                item.text
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export const FooterSections = ({ sections }: DetailFooterProps) => (
  <>
    {sections.map((section) => (
      <Section key={section.id} section={section} />
    ))}
  </>
);

export const DetailFooter = (source: FooterSource) => <FooterSections {...footerProps(source)} />;
