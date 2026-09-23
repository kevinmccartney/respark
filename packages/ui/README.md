# ui

Shared React UI for `apps/client` and `apps/admin`.

```ts
import { ManaCost, ManaText } from 'ui/mana';
import { ThemeProvider, useTheme } from 'ui/theme';
import { GuestOnly, RequireAuth } from 'ui/auth';
import { BackButton } from 'ui/back-button';
import { ApiHealthFooter } from 'ui/health';
```

```css
@import '@respark/ui/styles/theme.css';
```

- **`ui/mana`** — CR/Scryfall brace tokens (`{T}`, `{C}`, `{U/R}`, …) as Scryfall SVGs. `ManaText` for mixed oracle text; `ManaCost` for cost-only strings.
- **`ui/theme`** — `ThemeProvider` (`storageKey` per app) and `useTheme`.
- **`ui/styles/theme.css`** — shared CSS variables, fonts, `@theme` tokens, and base layer. Import from each app’s `index.css` after Tailwind.
- **`ui/auth`** — `RequireAuth` / `GuestOnly` with `redirectTo` (and optional `fallbackClassName`).
- **`ui/back-button`** — `BackButton({ fallbackTo })` goes `history.back` when possible, else navigates to `fallbackTo`.
- **`ui/health`** — `ApiHealthFooter({ apiBaseUrl })` polls `GET /healthz` and `GET /info`.

Build types/dist with `task ui:build`.
