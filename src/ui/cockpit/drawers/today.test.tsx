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

  it('should render the Marks table, its notes, and each track with its markers from the props alone', () => {
    render(
      <TodayDrawerView
        marks={{
          columns: ['Today, Thu Oct 15', 'Yesterday, Wed Oct 14', 'Change'],
          rows: [{ label: 'XYZ Mark', today: '$52.30', yesterday: '—', change: '—' }],
        }}
        notes={{ stale: 'Stale context: $51.80 from Tue Oct 13 close (stale, not used in any current figure)' }}
        tracksHeading="Where the price sits"
        tracks={[{ title: 'XYZ', accessibleName: 'XYZ: Stop $47.50, Target $56.00, now $52.30', min: 45, max: 58, zones: [], markers: [{ kind: 'now', label: 'now', price: 52.3 }], conditionLines: [] }]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Marks' });
    expect(within(table).getByRole('rowheader', { name: 'XYZ Mark' })).toBeTruthy();
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Today, Thu Oct 15', 'Yesterday, Wed Oct 14', 'Change']);
    expect(screen.getByText('Stale context: $51.80 from Tue Oct 13 close (stale, not used in any current figure)')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'XYZ: Stop $47.50, Target $56.00, now $52.30' }).querySelector<HTMLElement>('.mk')?.style.left).toBe('56.15%');
  });
});
