import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractEnrichment } from './transformer';

describe('extractEnrichment', () => {
  it('keeps brawl, commander, and oathbreaker from leadershipSkills', () => {
    assert.deepEqual(
      extractEnrichment({
        uuid: 'a',
        leadershipSkills: { brawl: false, commander: true, oathbreaker: true, predh: false },
      }).leadershipSkills,
      { brawl: false, commander: true, oathbreaker: true },
    );
    assert.equal(
      extractEnrichment({
        uuid: 'b',
        leadershipSkills: { commander: false },
      }).leadershipSkills,
      null,
    );
    assert.equal(extractEnrichment({ uuid: 'c' }).leadershipSkills, null);
  });
});
