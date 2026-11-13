// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PnlCard } from './pnl.tsx';

describe('P&L card placeholder (T8P.5)', () => {
  it('should render nothing until the lane that owns it replaces it', () => {
    const { container } = render(<PnlCard />);
    expect(container.innerHTML).toBe('');
  });
});
