// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PriceTrack } from './track.tsx';

afterEach(cleanup);

describe('price track (A215)', () => {
  it('should map finished prices to percentages of its range, with the zones reaching the ends they were given', () => {
    render(
      <PriceTrack
        title="XYZ"
        accessibleName="XYZ: Stop $40.00, Target $60.00, now $50.00"
        min={30}
        max={70}
        zones={[
          { role: 'Stop', from: 30, to: 40 },
          { role: 'Target', from: 60, to: 70 },
        ]}
        markers={[{ kind: 'now', label: 'now', price: 50 }]}
        conditionLines={[]}
      />,
    );
    const track = screen.getByRole('img', { name: 'XYZ: Stop $40.00, Target $60.00, now $50.00' });
    expect([...track.querySelectorAll<HTMLElement>('.zone')].map((zone) => [zone.style.left, zone.style.width])).toEqual([
      ['0%', '25%'],
      ['75%', '25%'],
    ]);
    expect(track.querySelector<HTMLElement>('.mk')?.style.left).toBe('50%');
    expect(screen.queryByRole('list')).toBeNull();
  });
});
