// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConditionsCard } from './conditions.tsx';

describe('conditions card without a view (T8P.14)', () => {
  it('should render nothing without a view, as on a Detail that has no card', () => {
    const { container } = render(<ConditionsCard />);
    expect(container.innerHTML).toBe('');
  });
});
