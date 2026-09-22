# Admin catalog browse

Read-only Catalog screens in `apps/admin` for **Cards** and **Sets**, with printings reached by drilldown (not a top-level nav item). **ETL is the source of truth** for `catalog.*` — the admin UI never mutates cards, sets, or printings. Writable policy (goodstuff) stays under Recommendations.

Domain objects: [domain.md](domain.md). Ingest: [etl/overview.md](etl/overview.md).

## Decisions

| Topic       | Choice                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------- |
| Entities    | Cards + Sets in nav. Printings only on card detail and set detail.                       |
| Mutability  | Read-only. No POST/PATCH/DELETE on catalog.                                              |
| Printing UX | Same idea as the player app: selected printing + list of other printings (`?printing=`). |
| Writes      | ETL only. Goodstuff remains a separate admin list.                                       |

## Information architecture

```text
/catalog/cards ──► /catalog/cards/:id?printing=
/catalog/sets  ──► /catalog/sets/:id ──► card detail (with printing)
card detail (if goodstuff) ···► /recommendations/goodstuff
```

| Route                | Page                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| `/catalog/cards`     | Searchable card table                                                |
| `/catalog/cards/:id` | Card detail; `?printing=` selects printing (omit = default / newest) |
| `/catalog/sets`      | Searchable set table                                                 |
| `/catalog/sets/:id`  | Set summary + printings in that set                                  |

Admin feature folder: [`apps/admin/src/catalog/`](../apps/admin/src/catalog/). Nav leaves for Cards / Sets are live (no `comingSoon`).

## Screens

Match existing admin chrome: table + filter form, pagination ([`OffsetPagination`](../apps/admin/src/core/components/OffsetPagination.tsx) over page-based list APIs), `applyAdminLoadError`. **No edit / save / delete controls** on catalog pages. Short page copy: catalog data comes from ETL syncs.

### Cards list (`/catalog/cards`)

**Columns:** optional thumb, name, type line, mana cost, rarity (representative printing), legal formats, game-changer / goodstuff badges.

**Filters:** `scryfall` (local Scryfall-syntax → SQL; colors / types / oracle / mana / rarity / sets / format `f:`), `sort` (`name` \| `edhrecRank` \| `manaValue`), `dir`, pagination. Column headers control sort. Unsupported Scryfall keywords return **400**. In-app **syntax** help documents the supported subset ([`packages/scryfall-query/SYNTAX.md`](../packages/scryfall-query/SYNTAX.md)); full public reference: [scryfall.com/docs/syntax](https://scryfall.com/docs/syntax).

Row click → card detail.

### Card detail (`/catalog/cards/:id`)

Mirror player card detail (browse-only):

- **Oracle block:** name, mana, type, oracle text, keywords, legalities, leadership skills, EDHREC rank / salt / game-changer, goodstuff flag + tags.
- **Selected printing:** image, set code/name, collector number, rarity, finishes, artist.
- **Other printings:** list; switching updates `?printing=` (default printing = first/newest; omit query when default).
- **Goodstuff:** if flagged, link to `/recommendations/goodstuff`; otherwise a quiet deep link to Recommendations → Goodstuff.

No deck-add or foil toggle — admin is browse-only.

### Sets list (`/catalog/sets`)

**Columns:** code, name, set type, released, card count, digital.

**Filters:** `q` (name or code), optional `setType` (comma-separated exact types, OR), optional `digital`, `sort` (`name` \| `code` \| `releasedAt` \| `setType` \| `cardCount` \| `digital`).

### Set detail (`/catalog/sets/:id`)

Set metadata (code, name, type, released, card count, digital, Scryfall id).

**Printings table** (paginated): collector number, card name → `/catalog/cards/:cardId?printing=:printingId`, rarity, optional thumb.

## API

### Cards (reuse)

- `GET /cards` — catalog search. Primary: `scryfall` (+ `sort` / `dir` / pagination). Legacy structured match params (`q`, `legalIn`, `colorIdentity`, `typeContains`, `rarity`, …) still work but catalog UIs no longer send them — prefer Scryfall clauses. Invalid/unsupported `scryfall` → 400.
- `GET /cards/:id` — detail including `printings[]` (existing).
- `GET /cards/suggestions` — name autocomplete for pickers (not full search).
- `GET /cards/type-suggestions` — legacy; unused by current admin UI.

Admin is already Clerk-authenticated. No catalog write routes.

### Sets (GET only)

| Method | Path                     | Purpose                                                                              |
| ------ | ------------------------ | ------------------------------------------------------------------------------------ |
| `GET`  | `/sets`                  | List/search: `q`, `setType` (comma OR), `digital`, `sort`, `page` / `limit`          |
| `GET`  | `/sets/type-suggestions` | Distinct `set_type` values for bounded autocomplete (`q`, `limit`)                   |
| `GET`  | `/sets/:id`              | Set row + paginated printings: `cardId`, `cardName`, collector number, rarity, image |

Nest module: [`apps/api/src/sets/`](../apps/api/src/sets/). Wire schemas: [`packages/schemas/src/sets.ts`](../packages/schemas/src/sets.ts).

## Out of scope

- Editing or deleting catalog rows; forcing re-ingest of one card
- Top-level Printings / Faces / Identifiers nav
- Player client changes
- Replacing ETL as source of truth for catalog
