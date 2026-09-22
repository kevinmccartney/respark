# Respark Scryfall syntax

Local search understands a **subset** of [Scryfall syntax](https://scryfall.com/docs/syntax). Unsupported keywords return an error (HTTP 400).

This file mirrors `src/syntax-help.ts` (the string the apps render in the help modal). Edit both when changing supported syntax.

## Combining terms

- **AND** — space-separated terms (default)
- **OR** — explicit `OR`
- **NOT** — leading `-` (e.g. `-t:creature`)
- **Groups** — parentheses: `(c:r OR c:g) t:instant`

Bare words match **card name** (substring). Quotes allow phrases: `"doom blade"`.

## Colors & identity

- `c:` / `color:` — card colors
- `id:` / `identity:` — color identity

Values: pip letters (`wubrg`), names (`blue`), nicknames (`esper`), `c` / `colorless`, `m` / `multicolor`, or a count (`c=2`).

Operators: `:` `=` `!=` `<` `>` `<=` `>=` (containment / comparison).

Examples: `c:g`, `id<=esper`, `c=2`, `-c:c`

## Types

- `t:` / `type:` — type line substring

Example: `t:creature t:elf`

## Oracle text & keywords

- `o:` / `oracle:` — oracle text
- `fo:` / `fulloracle:` — same as oracle for now
- `kw:` / `keyword:` — exact keyword (case-insensitive)

`~` in oracle text stands for the card’s name.

Examples: `o:"enters tapped"`, `kw:flying`, `o:"~ deals"`

## Mana

- `m:` / `mana:` — mana symbols in cost
- `mv:` / `manavalue:` — mana value (CMC)
- `devotion:` — devotion-style pip containment
- `produces:` — produced mana colors

Examples: `m:2WW`, `mv<=3`, `manavalue:even`, `produces:wu`

## Rarity

- `r:` / `rarity:` — any printing of this rarity

Values: `common` `uncommon` `rare` `mythic` `special` `bonus` (or `c` `u` `r` `m` …).

Comparisons use rarity rank: `r>=r`

## Sets & printings

- `s:` `e:` `set:` `edition:` — set code
- `cn:` `number:` — collector number
- `b:` `block:` — block code / name
- `g:` `group:` — set + related (parent) sets
- `st:` — set type (e.g. `commander`)
- `in:` — set code, set type, or rarity

Examples: `e:war`, `cn>50`, `in:lea`, `st:commander`, `b:wwk`

## Format legality

- `f:` `format:` — `(legalities → format) = legal`

Examples: `f:commander`, `format:modern`, `-f:standard`

Use `:` `=` or `!=` only. `banned:` / `restricted:` are not supported yet.

## Flags

- `is:` — `hybrid`, `phyrexian`, `booster`, and common promo types (`fnm`, `prerelease`, `league`, …)
- `has:` — `indicator` (color indicator)
- `new:` — `rarity` (printing introduces a new rarity for the card)

Examples: `is:hybrid`, `has:indicator`, `new:rarity`

## Not supported (yet)

These keywords error instead of searching: power/toughness/loyalty, prices (`usd`…), artist, flavor, watermark, cube, year, game, border, frame, EDHREC rank, `banned`/`restricted`, and other out-of-scope Scryfall fields.

Sorting uses the app’s sort controls — not Scryfall `order:`.

## Example

`t:creature id:g f:commander mv<=3`
