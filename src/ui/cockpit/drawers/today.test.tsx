// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TodayDrawerView } from './today.tsx';

afterEach(cleanup);

// The component takes finished props only (A216); the adapter's cases are in today.props.test.ts.
describe('today drawer component (A216)', () => {
  it('should render nothing from props that carry nothing', () => {
    const { container } = render(<TodayDrawerView tracks={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render the comparison, its note, and each track with its markers from the props alone', () => {
    render(
      <TodayDrawerView
        marks={{
          heading: 'Marks: Thu Oct 15 against Tue Oct 13',
          columns: ['Tue Oct 13', 'Thu Oct 15', 'Change'],
          rows: [{ label: 'XYZ Mark', earlier: { price: '$51.80' }, current: { price: '$52.30' }, change: '+$0.50' }],
          note: 'Wed Oct 14 has no Marks, so Thu Oct 15 is compared with Tue Oct 13.',
        }}
        tracksHeading="Where the price sits"
        tracks={[{ title: 'XYZ', accessibleName: 'XYZ: Stop $47.50, Target $56.00, now $52.30', min: 45, max: 58, zones: [], markers: [{ kind: 'now', label: 'now', price: 52.3 }], conditionLines: [] }]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Marks: Thu Oct 15 against Tue Oct 13' });
    expect(within(table).getByRole('rowheader', { name: 'XYZ Mark' })).toBeTruthy();
    expect(screen.getByText('Wed Oct 14 has no Marks, so Thu Oct 15 is compared with Tue Oct 13.')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'XYZ: Stop $47.50, Target $56.00, now $52.30' }).querySelector<HTMLElement>('.mk')?.style.left).toBe('56.15%');
  });
});
