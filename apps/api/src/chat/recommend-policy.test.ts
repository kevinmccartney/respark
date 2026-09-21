import { describe, expect, it } from 'vitest';
import { hitsFromToolResult, recommendPolicy } from './recommend-policy';

const remora = { id: 'remora', goodstuff: { tags: ['card_draw', 'value_engine', 'tax'] } };
const counterspell = { id: 'counter', goodstuff: null };
const cultivate = { id: 'cultivate', goodstuff: null };

describe('recommendPolicy', () => {
  it('flags an all-goodstuff slate when alternatives were retrieved', () => {
    expect(
      recommendPolicy({
        userText: 'What would be a good add?',
        presentedIds: [remora.id],
        retrieved: [remora, counterspell, cultivate],
      }),
    ).toEqual(['all_goodstuff_slate']);
  });

  it('skips when the player asked for a goodstuff class', () => {
    expect(
      recommendPolicy({
        userText: 'I need more interaction',
        presentedIds: [remora.id],
        retrieved: [remora, counterspell],
      }),
    ).toEqual([]);
  });

  it('does not flag a mixed slate', () => {
    expect(
      recommendPolicy({
        userText: 'What would be a good add?',
        presentedIds: [remora.id, counterspell.id],
        retrieved: [remora, counterspell],
      }),
    ).toEqual([]);
  });

  it('does not flag when every retrieved hit is goodstuff', () => {
    expect(
      recommendPolicy({
        userText: 'What would be a good add?',
        presentedIds: [remora.id],
        retrieved: [remora],
      }),
    ).toEqual([]);
  });

  it('reads searchCards and getCard goodstuff flags', () => {
    expect(
      hitsFromToolResult('searchCards', {
        cards: [remora, counterspell],
      }),
    ).toEqual([remora, counterspell]);
    expect(
      hitsFromToolResult('getCard', {
        id: 'x',
        goodstuff: { tags: ['counterspell', 'interaction'] },
      }),
    ).toEqual([{ id: 'x', goodstuff: { tags: ['counterspell', 'interaction'] } }]);
  });
});
