import { describe, expect, it } from 'vitest';
import { PlanRiskBlock } from '../../screens/trade-detail/Composed.tsx';
import { PlanRiskDrawer } from './plan-risk.tsx';

describe('plan and risk drawer path (T8P.5)', () => {
  it('should be the current section behind its future path, so a lane replaces the content and not the shell', () => {
    expect(PlanRiskDrawer).toBe(PlanRiskBlock);
  });
});
