import { describe, expect, it } from 'vitest';
import { PositionBlock } from '../../screens/trade-detail/Composed.tsx';
import { PositionDrawer } from './position.tsx';

describe('position drawer path (T8P.5)', () => {
  it('should be the current section behind its future path, so a lane replaces the content and not the shell', () => {
    expect(PositionDrawer).toBe(PositionBlock);
  });
});
