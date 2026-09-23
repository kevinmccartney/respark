import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { hasAlchemyNamePrefix, hasBareCardFace, isCatalogExtra } from './catalogSkip';

describe('hasBareCardFace', () => {
  it('matches a face that is exactly Card', () => {
    assert.equal(hasBareCardFace('Card'), true);
    assert.equal(hasBareCardFace('Card // Card'), true);
    assert.equal(hasBareCardFace('Emblem // Card'), true);
    assert.equal(hasBareCardFace('  Card  // Land'), true);
  });

  it('ignores real type lines', () => {
    assert.equal(hasBareCardFace('Token Creature — Goblin'), false);
    assert.equal(hasBareCardFace('Legendary Creature — Elf'), false);
    assert.equal(hasBareCardFace(null), false);
    assert.equal(hasBareCardFace(''), false);
  });
});

describe('hasAlchemyNamePrefix', () => {
  it('matches A- rebalance names', () => {
    assert.equal(hasAlchemyNamePrefix('A-Acererak the Archlich'), true);
    assert.equal(hasAlchemyNamePrefix('  A-Lightning Strike'), true);
  });

  it('ignores paper names', () => {
    assert.equal(hasAlchemyNamePrefix('Acererak the Archlich'), false);
    assert.equal(hasAlchemyNamePrefix('Aardvark'), false);
    assert.equal(hasAlchemyNamePrefix(null), false);
  });
});

describe('isCatalogExtra', () => {
  it('skips extra layouts', () => {
    assert.equal(isCatalogExtra({ layout: 'art_series' }), true);
    assert.equal(isCatalogExtra({ layout: 'token', typeLine: 'Token Creature — Pilot' }), true);
    assert.equal(isCatalogExtra({ layout: 'emblem', typeLine: 'Emblem — Ajani' }), true);
    assert.equal(isCatalogExtra({ layout: 'planar', typeLine: 'Plane — Dominaria' }), true);
    assert.equal(isCatalogExtra({ layout: 'scheme' }), true);
    assert.equal(isCatalogExtra({ layout: 'vanguard' }), true);
    assert.equal(isCatalogExtra({ layout: 'front_card', typeLine: 'Card' }), true);
    assert.equal(isCatalogExtra({ layout: 'double_faced_token' }), true);
  });

  it('skips extra set types even when layout is normal', () => {
    assert.equal(isCatalogExtra({ layout: 'normal', setType: 'memorabilia' }), true);
    assert.equal(isCatalogExtra({ layout: 'normal', setType: 'minigame' }), true);
    assert.equal(isCatalogExtra({ layout: 'normal', setType: 'token' }), true);
  });

  it('skips a bare Card type line as a backstop', () => {
    assert.equal(isCatalogExtra({ layout: 'normal', typeLine: 'Card // Card' }), true);
  });

  it('skips digital cards, alchemy sets, and A- rebalance names', () => {
    assert.equal(isCatalogExtra({ layout: 'normal', digital: true }), true);
    assert.equal(isCatalogExtra({ layout: 'normal', typeLine: 'Instant', digital: true }), true);
    assert.equal(isCatalogExtra({ layout: 'normal', setType: 'alchemy' }), true);
    assert.equal(
      isCatalogExtra({ layout: 'normal', typeLine: 'Creature — Human', setType: 'alchemy' }),
      true,
    );
    assert.equal(
      isCatalogExtra({
        layout: 'normal',
        name: 'A-Acererak the Archlich',
        setType: 'expansion',
        digital: false,
      }),
      true,
    );
    assert.equal(
      isCatalogExtra({
        layout: 'normal',
        name: 'A-Lightning Strike',
        setType: 'expansion',
      }),
      true,
    );
  });

  it('keeps playable cards including Un-sets', () => {
    assert.equal(
      isCatalogExtra({ layout: 'normal', typeLine: 'Instant', setType: 'funny' }),
      false,
    );
    assert.equal(
      isCatalogExtra({ layout: 'transform', typeLine: 'Legendary Creature — Bat God // Land' }),
      false,
    );
    assert.equal(isCatalogExtra({ layout: 'host', typeLine: 'Host Creature — Clamfolk' }), false);
    assert.equal(isCatalogExtra({ layout: 'reversible_card' }), false);
    assert.equal(
      isCatalogExtra({
        layout: 'normal',
        typeLine: 'Instant',
        digital: false,
        name: 'Acererak the Archlich',
      }),
      false,
    );
  });
});
