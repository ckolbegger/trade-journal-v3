// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PriceHistory } from './price-history.tsx';

describe('price history drawer placeholder (T8P.5)', () => {
  it('should render nothing until the lane that owns it replaces it', () => {
    const { container } = render(<PriceHistory />);
    expect(container.innerHTML).toBe('');
  });
});
