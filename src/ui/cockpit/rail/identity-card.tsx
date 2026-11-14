import { Link } from 'react-router';
import { Badge } from '../../Badge.tsx';
import { BackIcon } from '../../icons.tsx';
import { PageTitle } from '../../PageTitle.tsx';
import type { IdentityCardProps } from './identity.types.ts';

// The rail's identity card (W2): the way back, the symbol as the page heading, the Strategy and lifecycle, the strike, expiration and account
// lines, and the entry and exit actions.
export function IdentityCardView({ symbol, badge, deviationActive, lines, actions, backTo }: IdentityCardProps) {
  return (
    <header className="identity-card">
      <Link className="back-link" to={backTo}>
        <BackIcon />
        Back to Trades
      </Link>
      <PageTitle>{symbol}</PageTitle>
      <p>
        <Badge tone="info">{badge}</Badge>
        {deviationActive && <Badge tone="warning">Deviation active</Badge>}
      </p>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {actions.map((action) => (
        <Link key={action.label} className={`pill ${action.label === 'Record entry' ? 'primary' : 'secondary'}`} to={action.to}>
          {action.label}
        </Link>
      ))}
    </header>
  );
}
