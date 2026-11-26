import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// A rule's declarations, from the stylesheet's text: the first rule whose selector is exactly `selector`.
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
}

describe('Replay: the touch route (T95.57, U12)', () => {
  it('should offer the slider and the step buttons at 44px as the touch route', () => {
    const css = readFileSync('src/ui/cockpit/styles/replay-frame.css', 'utf8');
    // The chart's own tap target is about 12px, so the slider and the step buttons are the way to move on a phone.
    for (const selector of ['.replay-slider button', ".replay-slider input[type='range']", '.replay-moments select']) {
      const declarations = rule(css, selector);
      expect(declarations, selector).toMatch(/min-height:\s*44px/);
    }
    expect(rule(css, '.replay-slider button')).toMatch(/min-width:\s*44px/);
  });
});
