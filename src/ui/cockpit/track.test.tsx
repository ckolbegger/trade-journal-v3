// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PriceTrack } from './track.tsx';

describe('price track placeholder (T8P.5)', () => {
  it('should render nothing until the lane that owns it replaces it', () => {
    const { container } = render(<PriceTrack title="Option price" accessibleName="" min={0} max={1} zones={[]} markers={[]} conditionLines={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
