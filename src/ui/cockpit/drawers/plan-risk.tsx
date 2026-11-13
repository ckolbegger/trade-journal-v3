// The Plan and Risk drawer (P96, A216): Plan, Plan Baseline and Entry Quality as plain-prop sections. The shell hands it a Detail's view, and the
// adapter turns that into finished display values; the sections themselves import no view type.
import { planRiskProps, type PlanRiskSource } from './plan-risk.props.ts';
import type { PlanRiskDrawerProps, PlanRiskGroup, PlanRiskRow } from './plan-risk.types.ts';
import { WithSecondLine } from '../../SecondLine.tsx';

function Row({ row }: { readonly row: PlanRiskRow }) {
  const { value, second } = row;
  return (
    <div>
      <dt>{row.label}</dt>
      <dd className={row.plain ? undefined : 'number'}>
        {typeof value !== 'string' ? value.map((line, at) => <div key={at}>{line}</div>) : second === undefined ? value : <WithSecondLine amount={value} second={second} />}
      </dd>
    </div>
  );
}

function Group({ group }: { readonly group: PlanRiskGroup }) {
  return (
    <section className="card" aria-labelledby={`${group.id}-heading`}>
      <h2 id={`${group.id}-heading`}>{group.heading}</h2>
      {group.note !== undefined && <p>{group.note}</p>}
      {group.rows.length > 0 && (
        <dl className="figure-grid">
          {group.rows.map((row) => (
            <Row key={row.label} row={row} />
          ))}
        </dl>
      )}
    </section>
  );
}

export const PlanRiskPanel = ({ groups }: PlanRiskDrawerProps) => (
  <>
    {groups.map((group) => (
      <Group key={group.id} group={group} />
    ))}
  </>
);

export const PlanRiskDrawer = (source: PlanRiskSource) => <PlanRiskPanel {...planRiskProps(source)} />;
