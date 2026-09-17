# respark

**respark** is a Magic: The Gathering companion app that helps you reignite your MTG journey — continuously learn, evaluate and reevaluate cards, and build decks with confidence.

## Vision

Whether you're returning after years away or deepening an existing collection habit, respark is built around the loop of **learn → evaluate → build**. Start with decks you care about, search the card catalog, and refine lists over time instead of one-off deck dumps.

## MVP scope

The first release focuses on a solid web foundation and deck building basics:

| Area         | Goal                                    |
| ------------ | --------------------------------------- |
| **Platform** | React web app with authentication       |
| **Account**  | Sign up, log in, and onboarding         |
| **Decks**    | Deck list view and individual deck view |
| **Cards**    | Search for cards and add them to a deck |

## Monorepo

This repository is organized as a monorepo so the web app, shared types, and future packages (API, workers, etc.) can evolve together. Package layout and tooling will be added as implementation begins.

```plaintext
respark/
├── README.md          # You are here
└── (apps & packages TBD)
```

## Getting started

> Setup instructions will be added once the initial app scaffold and package manager workspace are in place.

## Contributing

Contribution guidelines and development workflow will be documented as the codebase grows.

## License

TBD.

---

_Magic: The Gathering is a trademark of Wizards of the Coast. respark is an unofficial fan project and is not affiliated with Wizards of the Coast._
