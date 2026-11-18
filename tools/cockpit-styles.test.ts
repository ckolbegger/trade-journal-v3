import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesDir = new URL('../src/ui/cockpit/styles/', import.meta.url);
const indexCss = readFileSync(new URL('../src/ui/cockpit/index.css', import.meta.url), 'utf8');
const mainTsx = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

// Stylesheets that main.tsx loads itself, before index.css, so index.css must not import them.
const loadedFromMain = ['legacy-detail.css'];

describe('cockpit stylesheets', () => {
  it('should load every stylesheet under src/ui/cockpit/styles/ from src/ui/cockpit/index.css', () => {
    const imported = [...indexCss.matchAll(/@import\s+'\.\/styles\/([^']+)'/g)].map((m) => m[1]);
    const onDisk = readdirSync(stylesDir).filter((f) => f.endsWith('.css'));
    for (const file of loadedFromMain) expect(mainTsx).toContain(`cockpit/styles/${file}`);
    const expected = onDisk.filter((f) => !loadedFromMain.includes(f));
    const missing = expected.filter((f) => !imported.includes(f));
    expect(missing).toEqual([]);
  });
});
