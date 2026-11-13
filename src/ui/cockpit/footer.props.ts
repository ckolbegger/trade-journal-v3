// The footer's adapter (A216): a Trade Detail's view to the footer's finished display values. The only file of the footer that reads
// `app/types`. The words are the moved sections' own (P96).
import type { TradeDetailView } from '../../app/types.ts';
import { contractCount } from '../screens/option-words.ts';
import { changeTime, legText } from '../screens/trade-detail/words.ts';
import type { DetailFooterProps } from './footer.types.ts';

// What the shell hands the footer: the Detail's view and the Workspace zone.
export interface FooterSource {
  readonly view: TradeDetailView;
  readonly timeZone: string;
}

const FULFILLMENT: Record<string, string> = {
  Unfilled: 'Unfilled',
  PartiallyFilled: 'Partially filled',
  FilledAsPlanned: 'Filled as planned',
  FilledWithDeviation: 'Filled with Deviation',
};

// Each Planned Leg's fulfillment under the frozen Plan (A25), and each recorded Deviation occurrence in its current version with the Position
// Change that caused it.
export function footerProps({ view, timeZone }: FooterSource): DetailFooterProps {
  if (!('positionChanges' in view)) return { sections: [] };
  const optionLeg = view.plan.legs[0]?.instrument.kind === 'Option';
  const items = view.deviations.map((occurrence) => {
    const current = occurrence.versions.at(-1)!;
    const unit = optionLeg ? contractCount(current.quantityAbovePlan ?? 0) : `${current.quantityAbovePlan} shares`;
    return {
      text: `Entry Size (Excess): ${unit} above plan, caused by the Position Change at ${changeTime(view, current.causingPositionChangeId, timeZone)}.`,
      superseded: current.status !== 'Active',
    };
  });
  return {
    sections: [
      {
        id: 'fulfillment',
        heading: 'Planned-Leg Fulfillment',
        rows: view.legFulfillment.map((f) => {
          const leg = view.plan.legs.find((l) => l.factId === f.plannedLegId);
          return { label: leg ? legText(leg) : f.plannedLegId, value: FULFILLMENT[f.fulfillment]! };
        }),
        items: [],
      },
      { id: 'deviations', heading: 'Deviations', rows: [], items, ...(items.length === 0 && { note: 'No Deviations recorded.' }) },
    ],
  };
}
