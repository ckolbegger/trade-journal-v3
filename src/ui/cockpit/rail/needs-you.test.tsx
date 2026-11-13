import { describe, expect, it } from 'vitest';
import { NeedsYouBlock } from '../../screens/trade-detail/Composed.tsx';
import { NeedsYou } from './needs-you.tsx';

describe('needs you card path (T8P.5)', () => {
  it('should be the current section behind its future path, so a lane replaces the content and not the shell', () => {
    expect(NeedsYou).toBe(NeedsYouBlock);
  });
});
