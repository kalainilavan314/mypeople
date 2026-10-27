# Mobile design

The design system and screen specifications of the live member app (`app/`, the PWA). The running app's tokens are in `app/src/core/theme`; `packages/design-tokens` carries the same values for the Expo apps, and its drift test checks them against the app.

- `production-design-specification.md`: screen and navigation specification.
- `my-people.tokens.css`, `my-people.components.css`, `component-trees.md`: tokens, components and component trees.
- `contrast-audit.json`, `review.html`: contrast audit and the review page. The review page shows the screenshots that the `scripts/verify-*.mjs` checks write to `qa/`; that folder is generated and not committed.

Fonts are locked (Inter, Noto Sans Tamil, JetBrains Mono); see `CLAUDE.md`.
