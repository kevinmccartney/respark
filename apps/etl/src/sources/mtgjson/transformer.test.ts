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

  it('keeps edhrecSaltiness and isGameChanger', () => {
    assert.equal(
      extractEnrichment({ uuid: 'd', edhrecSaltiness: 1.25, isGameChanger: true }).edhrecSaltiness,
      1.25,
    );
    assert.equal(extractEnrichment({ uuid: 'd', isGameChanger: true }).isGameChanger, true);
    assert.equal(extractEnrichment({ uuid: 'e' }).edhrecSaltiness, null);
    assert.equal(extractEnrichment({ uuid: 'e' }).isGameChanger, null);
  });
});
