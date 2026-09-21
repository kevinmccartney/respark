/** Comparison / bind operator. Scryfall `:` behaves like a soft equals for most fields. */
export type CompareOp = ':' | '=' | '!=' | '<' | '>' | '<=' | '>=';

export type ColorPip = 'W' | 'U' | 'B' | 'R' | 'G';

export type RarityName = 'common' | 'uncommon' | 'rare' | 'mythic' | 'special' | 'bonus';

export type Field =
  | 'color'
  | 'identity'
  | 'type'
  | 'oracle'
  | 'fulloracle'
  | 'keyword'
  | 'mana'
  | 'manavalue'
  | 'devotion'
  | 'produces'
  | 'rarity'
  | 'set'
  | 'collectorNumber'
  | 'block'
  | 'group'
  | 'setType'
  | 'in'
  | 'is'
  | 'has'
  | 'new';

export type ColorValue =
  | { kind: 'pips'; pips: ColorPip[] }
  | { kind: 'colorless' }
  | { kind: 'multicolor' }
  | { kind: 'count'; count: number };

export type ManaValue =
  | { kind: 'symbols'; symbols: string[] }
  | { kind: 'number'; n: number }
  | { kind: 'parity'; parity: 'even' | 'odd' };

export type ClauseValue =
  | { kind: 'text'; text: string }
  | { kind: 'colors'; value: ColorValue }
  | { kind: 'mana'; value: ManaValue }
  | { kind: 'rarity'; rarity: RarityName }
  | { kind: 'number'; n: number }
  | { kind: 'flag'; flag: string };

export type Ast =
  | { type: 'and'; children: Ast[] }
  | { type: 'or'; children: Ast[] }
  | { type: 'not'; child: Ast }
  | { type: 'name'; text: string }
  | { type: 'clause'; field: Field; op: CompareOp; value: ClauseValue };
