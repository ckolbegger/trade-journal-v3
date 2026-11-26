import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WIDE_LAYOUT_MIN_WIDTH } from './AppShell.tsx';

describe('The shell layout follows the viewport in the stylesheet (T95.59-F1)', () => {
  it('should set the sidebar columns from a min-width media query, so a resize to 375 never leaves the wide grid until the page script runs', () => {
    const css = readFileSync('src/ui/app.css', 'utf8');
    const wide = new RegExp(`@media \\(min-width: ${WIDE_LAYOUT_MIN_WIDTH}px\\) \\{[^@]*?\\.shell\\s*\\{[^}]*grid-template-columns:\\s*220px 1fr`);
    expect(css).toMatch(wide);
    expect(css).not.toMatch(/\.shell\[data-layout='wide'\]\s*\{[^}]*grid-template-columns/);
  });
});
