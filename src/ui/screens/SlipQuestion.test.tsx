// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SlipQuestion } from './SlipQuestion.tsx';

describe('the ten-times slip question (T95.13-B2)', () => {
  it('should show two readings that match to the cent as typed, each on its own button', () => {
    render(<SlipQuestion answer={{ kind: 'Scaled', factor: 10, candidate: '0.0004' }} entry="0.004" last="0.0004" onChoose={() => undefined} />);
    expect(screen.getByText('$0.0004 or $0.004?')).toBeTruthy();
    expect(screen.getByRole('button', { name: '$0.0004' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '$0.004' })).toBeTruthy();
  });
});
