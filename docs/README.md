# Documentation

| Doc                                   | Description                                                        |
| ------------------------------------- | ------------------------------------------------------------------ |
| [Domain model](domain.md)             | Business objects, system diagram, Mermaid ERDs                     |
| [AI chat](ai-chat.md)                 | Global assistant: sticky context, tools, Bedrock, WebSocket        |
| [Commander stats](commander-stats.md) | Layer A rank/salt vs future per-commander inclusion (Option B)     |
| [CI / CD](ci-cd.md)                   | GitHub Actions, Task isomorphism, OIDC, change detection, releases |
| [ETL overview](etl/overview.md)       | Sync / stage / job model, architecture, sources of truth           |
| [ETL data model](etl/data-model.md)   | Compact Postgres schema/table list                                 |
| [ETL operations](etl/operations.md)   | Running syncs (CLI + admin), reports, env                          |
| [ETL streaming](etl/streaming.md)     | In-process lib events and admin WebSocket                          |

Agent standing orders (thin; point here for depth): [`.cursor/rules/`](../.cursor/rules/), [`AGENTS.md`](../AGENTS.md).

Package-level READMEs (`apps/etl`, `apps/api`, `apps/admin`) stay short and point here for pipeline detail.

## Diagrams

Mermaid sources live next to the docs they illustrate (`docs/diagrams/*.mmd`, `etl/diagrams/*.mmd`). Markdown embeds the generated SVG so GitHub and plain preview work without a Mermaid plugin.

Edit the `.mmd`, then regenerate:

```bash
task docs:diagrams
```

Commit both the `.mmd` and the `.svg`.
