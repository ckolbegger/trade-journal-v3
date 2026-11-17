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
        ticks={[]}
      />,
    );
    const track = screen.getByRole('img', { name: 'XYZ: Stop $40.00, Target $60.00, now $50.00' });
    expect([...track.querySelectorAll<HTMLElement>('.zone')].map((zone) => [zone.style.left, zone.style.width])).toEqual([
      ['0%', '25%'],
      ['75%', '25%'],
    ]);
    expect(track.querySelector<HTMLElement>('.mk')?.style.left).toBe('50%');
    expect(screen.queryByRole('list', { hidden: true })).toBeNull();
  });

  it('should expose each open lot tick by its name, $3.30 · Fri Oct 16, to assistive technology', () => {
    render(
      <PriceTrack
        title="XYZ"
        accessibleName="XYZ: Stop $40.00, Target $60.00, now $50.00"
        min={30}
        max={70}
        zones={[]}
        markers={[{ kind: 'now', label: 'now', price: 50 }]}
        ticks={[{ price: 45, label: '$3.30 · Fri Oct 16' }]}
      />,
    );
    const tick = screen.getByRole('img', { name: '$3.30 · Fri Oct 16' });
    // ARIA makes an img's children presentational, so a tick inside another img loses its name; Testing Library does not model that, so the rule is checked on the ancestors.
    expect(tick.parentElement?.closest('[role="img"]')).toBeNull();
    expect(tick.getAttribute('title')).toBe('$3.30 · Fri Oct 16');
    expect(screen.getByRole('img', { name: 'XYZ: Stop $40.00, Target $60.00, now $50.00' })).toBeTruthy();
  });
});
