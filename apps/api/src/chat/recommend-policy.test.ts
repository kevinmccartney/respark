import { describe, expect, it } from 'vitest';
import { hitsFromToolResult, recommendPolicy } from './recommend-policy';

const rhystic = { id: 'rhystic', downweight: { kind: 'staple' } };
const counterspell = { id: 'counter', downweight: null };
const cultivate = { id: 'cultivate', downweight: null };

describe('recommendPolicy', () => {
  it('flags an all-downweight slate when alternatives were retrieved', () => {
    expect(
      recommendPolicy({
        userText: 'What would be a good add to this deck?',
        presentedIds: [rhystic.id],
        retrieved: [rhystic, counterspell, cultivate],
      }),
    ).toEqual(['all_downweight_slate']);
  });

  it('does not flag when the player asked for that class', () => {
    expect(
      recommendPolicy({
        userText: 'Suggest a tutor',
        presentedIds: [rhystic.id],
        retrieved: [rhystic, counterspell],
      }),
    ).toEqual([]);
  });

  it('does not flag a mixed slate', () => {
    expect(
      recommendPolicy({
        userText: 'What would be a good add?',
        presentedIds: [rhystic.id, counterspell.id],
        retrieved: [rhystic, counterspell],
      }),
    ).toEqual([]);
  });

  it('does not flag when every retrieved hit is downweighted', () => {
    expect(
      recommendPolicy({
        userText: 'What would be a good add?',
        presentedIds: [rhystic.id],
        retrieved: [rhystic],
      }),
    ).toEqual([]);
  });
});

describe('hitsFromToolResult', () => {
  it('reads searchCards and getCard downweight flags', () => {
    expect(
      hitsFromToolResult('searchCards', {
        cards: [rhystic, counterspell, { name: 'no-id' }],
      }),
    ).toEqual([rhystic, counterspell]);
    expect(hitsFromToolResult('getCard', { id: 'x', downweight: { kind: 'tutor' } })).toEqual([
      { id: 'x', downweight: { kind: 'tutor' } },
    ]);
    expect(hitsFromToolResult('getDeck', { id: 'deck' })).toEqual([]);
  });
});
