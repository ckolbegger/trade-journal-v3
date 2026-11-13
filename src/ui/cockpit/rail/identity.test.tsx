import { describe, expect, it } from 'vitest';
import { IdentityCardBlock } from '../../screens/trade-detail/Composed.tsx';
import { IdentityCard } from './identity.tsx';

describe('identity card path (T8P.5)', () => {
  it('should be the current section behind its future path, so a lane replaces the content and not the shell', () => {
    expect(IdentityCard).toBe(IdentityCardBlock);
  });
});
