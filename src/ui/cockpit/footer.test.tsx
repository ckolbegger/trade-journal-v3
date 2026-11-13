import { describe, expect, it } from 'vitest';
import { FooterBlock } from '../screens/trade-detail/Composed.tsx';
import { DetailFooter } from './footer.tsx';

describe('footer path (T8P.5)', () => {
  it('should be the current section behind its future path, so a lane replaces the content and not the shell', () => {
    expect(DetailFooter).toBe(FooterBlock);
  });
});
