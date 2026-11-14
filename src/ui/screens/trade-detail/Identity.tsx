import { Link } from 'react-router';
import { BackIcon } from '../../icons.tsx';

// Returns to the Trades tab the Trade is listed under; where the lifecycle is unknown, the default tab.
export function BackToTrades({ lifecycle }: { readonly lifecycle?: string }) {
  return (
    <Link className="back-link" to={lifecycle === 'Planned' ? '/?lifecycle=Planned' : '/'}>
      <BackIcon />
      Back to Trades
    </Link>
  );
}
