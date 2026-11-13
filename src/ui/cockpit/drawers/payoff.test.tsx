import { describe, expect, it } from 'vitest';
import { PayoffBlock } from '../../screens/trade-detail/Composed.tsx';
import { PayoffDrawer } from './payoff.tsx';

describe('payoff drawer path (T8P.5)', () => {
  it('should be the current section behind its future path, so a lane replaces the content and not the shell', () => {
    expect(PayoffDrawer).toBe(PayoffBlock);
  });
});
