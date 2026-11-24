import { useNavigate, useParams, useSearchParams } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import { ExitForm } from './ExitForm.tsx';
import { PositionChangeFormBody } from './PositionChangeFormBody.tsx';
import { EXIT_ACTION } from './trade-detail/words.ts';

export interface PositionChangeFormProps {
  readonly facade: UiFacade;
  readonly timeZone: string;
  // The current instant, injectable so tests use a fixed clock.
  readonly now: () => string;
  // Reports whether any value differs from its initial value (update deferral, D1 A5).
  readonly onDirtyChange: (dirty: boolean) => void;
}

export { EXIT_ACTION };

// The route screen: Buy rows of the Plan's Stock (D2 A18, A33), or, opened with `?action=Sell`, the exit form.
export function PositionChangeForm(props: PositionChangeFormProps) {
  const { tradeId = '' } = useParams();
  const exit = useSearchParams()[0].get('action') === EXIT_ACTION;
  const navigate = useNavigate();
  const shared = { ...props, tradeId, onDone: () => void navigate(`/trades/${tradeId}`), backLabel: 'Back to the Trade' };
  return exit ? <ExitForm {...shared} /> : <PositionChangeFormBody {...shared} exit={false} />;
}
