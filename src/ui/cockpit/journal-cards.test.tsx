// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JournalCards } from './journal-cards.tsx';

describe('journal cards placeholder (T8P.5)', () => {
  it('should render nothing until the lane that owns it replaces it', () => {
    const { container } = render(<JournalCards />);
    expect(container.innerHTML).toBe('');
  });
});
