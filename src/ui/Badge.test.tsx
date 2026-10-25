// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Badge } from './Badge.tsx';

afterEach(cleanup);

describe('Badge', () => {
  it('should render its text with a data-tone of neutral, info, or warning', () => {
    render(
      <>
        <Badge tone="neutral">Quiet</Badge>
        <Badge tone="info">Planned</Badge>
        <Badge tone="warning">Records disagree</Badge>
      </>,
    );
    expect(screen.getByText('Quiet').getAttribute('data-tone')).toBe('neutral');
    expect(screen.getByText('Planned').getAttribute('data-tone')).toBe('info');
    expect(screen.getByText('Records disagree').getAttribute('data-tone')).toBe('warning');
    expect(screen.getByText('Planned').className).toBe('badge');
  });
});
