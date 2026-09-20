# ui

Shared React UI for `apps/client` and `apps/admin`.

```ts
import { ManaCost, ManaText } from 'ui/mana';
import { ThemeProvider, useTheme } from 'ui/theme';
import { GuestOnly, RequireAuth } from 'ui/auth';
import { ApiHealthFooter } from 'ui/health';
```

- **`ui/mana`** — CR/Scryfall brace tokens (`{T}`, `{C}`, `{U/R}`, …) as Scryfall SVGs. `ManaText` for mixed oracle text; `ManaCost` for cost-only strings.
- **`ui/theme`** — `ThemeProvider` (`storageKey` per app) and `useTheme`.
- **`ui/auth`** — `RequireAuth` / `GuestOnly` with `redirectTo` (and optional `fallbackClassName`).
- **`ui/health`** — `ApiHealthFooter({ apiBaseUrl })` polls `GET /healthz` and `GET /info`.

Build types/dist with `task ui:build`.
