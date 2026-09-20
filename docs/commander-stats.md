# Commander inclusion stats (future)

Respark today stores **global** Commander popularity (`catalog.card.edhrec_rank`, salt, game-changer) and an admin **overperformers** list. That is Layer A. This page is the design for **Layer B** — per-commander inclusion — if we revisit it. Do not implement these tables, HTTP clients, or a `getCommanderSuggestions` tool unless that work is explicitly scoped.

## Why Layer A is not enough

`edhrec_rank` is a format-wide rank order (1 = most played in Commander overall). It is a decent sort for “legal in this identity, commonly played, not already in the 99.” It cannot answer “what are people putting in Atraxa?”

EDHREC’s commander pages publish a different pair of numbers:

- **Inclusion** = (decks _with this commander_ that contain card X) / (all decks with this commander).
- **Synergy** = (inclusion for this commander) − (inclusion for this **color identity** across the format). Sol Ring is in most decks of every identity, so synergy is near zero. High Synergy exists to hide generic goodstuff.

Layer A plus `app.recommendation_downweight` is a policy workaround for staple bias. Layer B would make synergy a first-class signal; the downweight list would still be useful as a “player asked for spicy, not goodstuff” filter.

## Sources (if we revisit)

- **EDHREC unofficial JSON** (`https://json.edhrec.com/pages/commanders/{slug}.json`) — already has inclusion, synergy, themes, bracket/budget splits. [Terms](https://edhrec.com/terms) forbid automated queries. Endpoints are undocumented and break. If used: lazy snapshot when a player asks, persist, TTL ~24h. Email EDHREC before any crawl of many commanders.
- **Archidekt public decks** — maintainers have said the read API is open and they hope others use it. We would compute inclusion ourselves. Synergy needs a color-identity baseline we would also compute.
- **Moxfield** — unofficial, user-agent gated; worse default than Archidekt.
- **Commander Spellbook** — official MIT combo API. Complements this graph; does not replace it.

## Schema sketch (not implemented)

```text
catalog.commander_snapshot
  commander_card_id → catalog.card
  partner_card_id   → catalog.card (nullable)
  source            -- 'edhrec' | 'archidekt'
  source_slug
  theme_slug / budget
  deck_count
  type_mix
  fetched_at

catalog.commander_inclusion
  snapshot_id
  card_id → catalog.card
  category            -- high_synergy | top_cards | creatures | …
  inclusion_rate
  synergy
  num_decks / potential_decks
  salt
  position

catalog.commander_theme
  snapshot_id
  slug / label / deck_count
```

Join by English name or EDHREC slug → `catalog.card.id`. Never create printings. Unmatched names go to `ops.ingestion_unmatched`.

Chat would add `getCommanderSuggestions` and extend this-turn `retrievedCardIds` so `presentRecommendations` still grounds prose.

## What shipped instead (Layer A)

- Scryfall `edhrec_rank` and `game_changer` on `catalog.card` (catalog job).
- MTGJSON `edhrecSaltiness` on `catalog.card` (identifiers job). Fills `is_game_changer` only when Scryfall left it null.
- `GET /cards?sort=edhrecRank` (and chat `searchCards`, which defaults to that) orders by global rank. Name match still wins when `q` is set. HTTP default is `sort=name`.
- `app.recommendation_downweight` — admin-maintained soft flags on search/getCard and a short system-prompt appendix.
