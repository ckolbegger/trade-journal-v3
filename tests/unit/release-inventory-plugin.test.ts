import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitReleaseInventoryAndStampSw } from '../../vite-plugins/release-inventory';

describe('Offline Release Inventory & SW release-stamp emitter', () => {
  it('changes sw.js bytes with the new releaseId whenever app assets change so browsers detect SW updates', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tjv3-sw-stamp-'));
    try {
      writeFileSync(join(dir, 'index.html'), '<!doctype html><script src="/assets/v1.js"></script>');
      writeFileSync(join(dir, 'sw.js'), 'self.addEventListener("install", () => {});\n');

      const inv1 = emitReleaseInventoryAndStampSw(dir);
      const sw1 = readFileSync(join(dir, 'sw.js'), 'utf8');
      expect(sw1).toContain(inv1.releaseId);

      // Update app bundle WITHOUT changing sw.js source
      writeFileSync(join(dir, 'index.html'), '<!doctype html><script src="/assets/v2.js"></script>');
      writeFileSync(join(dir, 'sw.js'), 'self.addEventListener("install", () => {});\n');

      const inv2 = emitReleaseInventoryAndStampSw(dir);
      const sw2 = readFileSync(join(dir, 'sw.js'), 'utf8');
      expect(inv2.releaseId).not.toBe(inv1.releaseId);
      expect(sw2).toContain(inv2.releaseId);
      expect(sw2).not.toBe(sw1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
