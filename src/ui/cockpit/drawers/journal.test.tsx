import { describe, expect, it } from 'vitest';
import { JournalBlock } from '../../screens/trade-detail/Composed.tsx';
import { JournalDrawer } from './journal.tsx';

describe('journal drawer path (T8P.5)', () => {
  it('should be the current section behind its future path, so a lane replaces the content and not the shell', () => {
    expect(JournalDrawer).toBe(JournalBlock);
  });
});
