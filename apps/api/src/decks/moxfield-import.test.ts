import { describe, expect, it } from 'vitest';

import { isIgnoredCommanderImport, parseMoxfieldExport } from './moxfield-import';

const commanderId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';

describe('parseMoxfieldExport', () => {
  it('marks COMMANDER section lines and keeps mainboard cards', () => {
    const { lines, skipped } = parseMoxfieldExport(`
1 Sol Ring (C21) 10
COMMANDER:
1 Aesi, Tyrant of Gyre Strait (CMR) 365
DECK:
1 Arcane Signet (LCC) 299
`);
    expect(skipped).toEqual([]);
    expect(lines).toEqual([
      expect.objectContaining({ name: 'Sol Ring', commander: false, sideboard: false }),
      expect.objectContaining({
        name: 'Aesi, Tyrant of Gyre Strait',
        commander: true,
        sideboard: false,
      }),
      expect.objectContaining({ name: 'Arcane Signet', commander: false, sideboard: false }),
    ]);
  });
});

describe('isIgnoredCommanderImport', () => {
  it('ignores COMMANDER section lines', () => {
    expect(isIgnoredCommanderImport({ commander: true }, otherId, commanderId)).toBe(true);
  });

  it('ignores the same oracle card as the deck commander', () => {
    expect(isIgnoredCommanderImport({ commander: false }, commanderId, commanderId)).toBe(true);
  });

  it('keeps other mainboard cards', () => {
    expect(isIgnoredCommanderImport({ commander: false }, otherId, commanderId)).toBe(false);
    expect(isIgnoredCommanderImport({ commander: false }, otherId, null)).toBe(false);
  });
});
