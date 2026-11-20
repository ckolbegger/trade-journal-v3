import { describe, expect, it } from 'vitest';
import { figureParts } from './figure-parts.ts';

describe('figureParts (D9AR-retro-1)', () => {
  it('should take a percentage on its own as a figure: Behind: 15% of the way to the Stop.', () => {
    expect(figureParts('Behind: 15% of the way to the Stop.')).toEqual([{ text: 'Behind: ' }, { text: '15%', figure: true }, { text: ' of the way to the Stop.' }]);
  });
});
