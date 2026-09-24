# TODO

Writing down ideas for the future

- Mythic Tools (gameplay/social/stats)
- Scryfall (card browsing)
- Moxfield (deckbuilding/social)
- EchoMTG/MtgStocks (financial)
- ??? maybe Wizards app? (stats)

## Stuff to do

### Features

- changelog for decks
- bulk actions
- (admin) ai cost management
- stacks
- collection
- (admin/etl) failed rows don't stream into the UI
- MTG pricing data
- bracket estimator
- get search more consistent to scryfall
- UX juice
  - hotkeys
  - undo
- ui snazziness for collecction/search views
  - rummage (card in hand left to right) or bin (pull one out, put one back in)
  - binder view
- social
  - friends
  - news feed
  - suggestions
  - tournament results
  - draft rooms
  - EDH online via that one site
  - trade binders
  - other peoples profiles
- lifetracker
  - ties into stats - can automatically tell who won the game
    - can definitely track your life total/commander damage over turns
    - can correlate to decks
  - websocket so everyone can have their own tracker
    - everyone assigns damage to the player life total targets
  - turn clock
  - ruling lookup chat (with links)
-

### Tech Debt

- mdc AI agent docs guidance and refresh
- (api) refactor/cleanup
- (etl) refactor/cleanup
- scryfall E2E tests
- tear out demo mismatches/errors. Then figure out how I can recreate them via sql script
- build combo graph from Commander Spellbook myself?
- Per-commander inclusion — see docs/commander-stats.md
