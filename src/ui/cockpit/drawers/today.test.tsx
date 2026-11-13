import { describe, expect, it } from 'vitest';
import { TodayBlock } from '../../screens/trade-detail/Composed.tsx';
import { TodayDrawer } from './today.tsx';

describe('today drawer path (T8P.5)', () => {
  it('should be the current section behind its future path, so a lane replaces the content and not the shell', () => {
    expect(TodayDrawer).toBe(TodayBlock);
  });
});
