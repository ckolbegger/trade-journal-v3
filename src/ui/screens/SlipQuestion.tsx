import { MARK_SLIP_LIMITS, type MarkSlipAnswer } from '../../domain/mark-slip/index.ts';
import { decimalMoney } from '../format.ts';

// What the grid asks of a Review Date price that reads as a slip (W106): the domain's answer, which is never a pass.
export type SlipOpen = Exclude<MarkSlipAnswer, { readonly kind: 'Pass' }>;

// The price the trader kept, the one they pressed; or a wish to type another.
export type SlipChoice = { readonly kind: 'keep'; readonly price: string } | { readonly kind: 'retype' };

export interface SlipQuestionProps {
  readonly answer: SlipOpen;
  // The price as typed, and the last Mark it was measured from.
  readonly entry: string;
  readonly last: string | undefined;
  readonly onChoose: (choice: SlipChoice) => void;
}

// The line under the grid that states the limits (W108), read from the one constant the check uses.
const { stock, option } = MARK_SLIP_LIMITS;
export const SLIP_LIMITS_WORDS = `Asks before saving a Mark that moved more than ${stock.up}% (stock), or ${option.up}% up or ${option.down}% down (option), since the last Mark.`;

// The question under a row. The percent and the readings come from the domain's check; this only words them.
export function SlipQuestion({ answer, entry, last, onChoose }: SlipQuestionProps) {
  const keep = (price: string, label: string) => ({ label, choice: { kind: 'keep', price } as const });
  const retype = { label: 'Retype', choice: { kind: 'retype' } as const };
  let asked: { readonly text: string; readonly options: readonly { readonly label: string; readonly choice: SlipChoice }[] };
  if (answer.kind === 'Scaled') {
    const readings = [answer.candidate, entry];
    asked = { text: `${readings.map(decimalMoney).join(' or ')}?`, options: readings.map((price) => keep(price, decimalMoney(price))) };
  } else if (answer.kind === 'Moved' && last !== undefined) {
    asked = { text: `${answer.percent}% from ${decimalMoney(last)}. Right?`, options: [keep(entry, `Yes, ${decimalMoney(entry)}`), retype] };
  } else if (answer.kind === 'WorthNothing') {
    asked = { text: 'Worth nothing?', options: [keep(entry, `Yes, ${decimalMoney(entry)}`), retype] };
  } else if (answer.kind === 'NotAPrice') {
    return <p role="alert">Not a price. Digits only, like 45.10.</p>;
  } else if (answer.kind === 'ZeroSharePrice') {
    return <p role="alert">A share price can't be $0.00.</p>;
  } else return null;
  return (
    <div role="alert">
      <p>{asked.text}</p>
      {asked.options.map(({ label, choice }) => (
        <button key={label} type="button" className="pill secondary" onClick={() => onChoose(choice)}>
          {label}
        </button>
      ))}
    </div>
  );
}
