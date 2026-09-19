# Documentation

| Doc | Description |
| --- | --- |
| [ETL overview](etl/overview.md) | Sync / stage / job model, architecture, sources of truth |
| [ETL data model](etl/data-model.md) | Postgres schemas and tables (`raw`, `catalog`, `ops`, `app`) |
| [ETL operations](etl/operations.md) | Running syncs (CLI + admin), reports, env |
| [ETL streaming](etl/streaming.md) | In-process lib events and admin WebSocket |

Package-level READMEs (`apps/etl`, `apps/api`, `apps/admin`) stay short and point here for pipeline detail.

## Diagrams

Mermaid sources live next to the docs they illustrate (e.g. `etl/diagrams/*.mmd`). Markdown embeds the generated SVG so GitHub and plain preview work without a Mermaid plugin.

Edit the `.mmd`, then regenerate:

```bash
task docs:diagrams
```

Commit both the `.mmd` and the `.svg`.
