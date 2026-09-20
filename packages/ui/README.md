# ui

Shared React UI for `apps/web` and `apps/admin`. First slice is mana shortcode interpolation (`ui/mana`).

```ts
import { ManaCost, ManaText } from 'ui/mana';
```

`ManaText` turns CR/Scryfall brace tokens (`{T}`, `{C}`, `{U/R}`, …) into Scryfall SVGs inside mixed oracle text. `ManaCost` is the same interpolator for cost-only strings.

Build types/dist with `task ui:build`.
