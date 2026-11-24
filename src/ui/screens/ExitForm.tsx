import type { UiFacade } from '../../app/compose.ts';
import { PositionChangeFormBody } from './PositionChangeFormBody.tsx';

export interface ExitFormProps {
  readonly facade: UiFacade;
  readonly tradeId: string;
  readonly timeZone: string;
  // The current instant, injectable so tests use a fixed clock.
  readonly now: () => string;
  // Reports whether any value differs from its initial value (update deferral, D1 A5).
  readonly onDirtyChange: (dirty: boolean) => void;
  // Leaves the form without recording anything.
  readonly onDone: () => void;
  // The words of the link back to the Trade.
  readonly backLabel: string;
}

// The sale that exits a Trade's Position (D6 A93): a component any screen can place, taking the
// Trade, what to do on leaving and the words of the way back.
export function ExitForm(props: ExitFormProps) {
  return <PositionChangeFormBody {...props} exit />;
}
