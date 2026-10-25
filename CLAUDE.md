# Instructions for AI agents working in this repo

This file applies to every agent and every session, regardless of which branch, screen, or redesign task is in progress. Read it before touching any CSS, theme token, or font import.

## 🔒 LOCKED: Typography — do not change fonts

**The app's fonts are locked. No agent may change the font family for Tamil text, English/UI text, or monospace/ID text — ever — unless the human developer explicitly asks, in that exact conversation, to change the font.**

This applies no matter what else the task is: a visual redesign, a "civic design system" pass, a new theme, a new component library, a palette change, a new screen — **none of these are permission to touch typography.** If a redesign seems to call for a different font, stop and ask the developer first. Do not substitute, "improve," or quietly swap a font while doing something else.

### Canonical fonts (source of truth — see `PROJECT.md`)

| Use | Font |
|---|---|
| Tamil text | **Noto Sans Tamil** (weights 400/500/600/700, self-hosted via `@fontsource/noto-sans-tamil`) |
| English / UI text | **Inter** (weights 400/500/600/700, self-hosted via `@fontsource/inter`) |
| IDs, coordinates, monospace data | **JetBrains Mono** |

These are loaded once in `app/src/main.tsx` and exposed as `--font-ta`, `--font-ui`, `--font-head`, `--font-mono` CSS variables. Every stylesheet and every new component must reference these variables (or the equivalent `font.ta` / `font.ui` / `font.mono` entries in `app/src/core/theme/tokens.ts`) — never a literal font name, and never a new `@font-face`.

### Single source of truth — don't redeclare the font vars

`--font-ui`, `--font-head`, `--font-ta`, `--font-mono` are defined exactly **once**, at `:root` in `app/src/core/theme/tokens.css`. Every other stylesheet must *read* them (`font-family: var(--font-ui)` etc.) and never redeclare them with a literal value, even to "pin" the same fonts for a scoped theme class — CSS custom properties inherit automatically, so a scoped class only needs to override them if it genuinely wants a different value (it must not, per the lock above). A past pass redundantly re-listed the same Inter/Noto Sans Tamil value inside `.membership-page` in `membership-card.css`; that redeclaration was removed — don't reintroduce this pattern in a new component or theme file.

The only legitimate exception is `global.css`'s `html[lang='ta'] / :lang(ta) / .ta` rule, which flips the *priority order* (Noto Sans Tamil first) for Tamil-tagged content — same two fonts, just reordered for glyph coverage. That is not a new font and not something to copy elsewhere without the same `lang`-scoping reasoning.

### Past violation (already fixed — do not reintroduce)

An earlier redesign pass once set `app/src/core/theme/member.css`'s `--font-ui` to `'Outfit', 'Inter', 'Noto Sans Tamil', sans-serif` with a separate Latin-only `@font-face` for `'Outfit'` (no Tamil glyphs — Tamil text would have silently fallen back). It has since been reverted to `var(--font-ui)` with no local override. **This was a bug, not a precedent** — if you see any file defining its own font name again, that is a regression to undo, not a pattern to follow.

### If you think the font needs to change

Ask the developer directly: *"This task seems to want a different font for X — do you want me to change it, or keep the current Noto Sans Tamil / Inter / JetBrains Mono setup?"* Only proceed once they say yes, explicitly, to changing the font. A general instruction like "redesign this screen" or "make it look modern" is **not** that permission.

---

## Other conventions

- Tamil label first, English sub-label under it where both are shown (per `PROJECT.md`).
- Reuse the existing design tokens (`app/src/core/theme/tokens.ts`, `app/src/core/theme/tokens.css`) rather than hardcoding colors — but tokens for color/spacing are a separate concern from the font-family lock above, which is absolute.
- New apps take colours, spacing and fonts from `packages/design-tokens`. Its `fontFamily` is the same lock: Inter, Noto Sans Tamil, JetBrains Mono.

---

## Project map

The requirements are the BRD v1.1 (MP-BRD-001); see `docs/requirements/README.md`. The repository is moving to a monorepo one tested batch at a time (`docs/architecture/system-overview.md`).

| Folder | What it is | Status |
|---|---|---|
| `app/` | Live member PWA (Vite, React 18) | Production; frozen layout |
| `server/` | Live Express API (`/api`) and SQL migrations 0000–0011 | Production; frozen layout |
| `services/api/` | FastAPI modular monolith (`/v1`), Alembic | Built and tested; not yet deployed |
| `services/ai-worker/` | Private AI inference worker | Planned (BRD Phase 3); README only |
| `packages/` | `design-tokens`, `i18n`, `api-client` (TypeScript source) | Built and tested |
| `apps/` | Expo member and staff apps, Next.js admin | Being added |
| `docs/` | Architecture, setup, API, database, security, requirements | Keep in step with the code |
| `deployment/` | Release scripts and the release record | In use for production |

**Never move, rename or restructure `app/` or `server/`.** The release scripts and the server's systemd unit run `server/src/index.js` and serve `app/dist` from those exact paths. They are retired only when the Expo apps and FastAPI replace them.

## How to write code here

- Simple, descriptive names; one responsibility per file; small functions. No generic abstractions, helper layers or design patterns until a second real use needs them.
- TypeScript types and Python type annotations everywhere. Handle error states explicitly.
- Comments explain *why* (security decisions, non-obvious rules), not what the next line does.
- No placeholder functions or screens that pretend a feature works. Build a folder when it holds real code.
- Feature-based folders. Backend modules live in `services/api/app/modules/<name>/`: a thin `router.py`, rules in `service.py`, SQL in `repository.py`, request/response models in `schemas.py`. Tables still owned by the Express migrations are queried with SQL, not declared on `Base`.
- Shared types come from the OpenAPI document: after changing an endpoint run `python scripts/export_openapi.py` (in `services/api`) and `npm run generate -w @my-people/api-client`.
- Never hard-code secrets, tokens, credentials or member data. Real values live only in untracked `.env` files and on the server.
- Naming: React components `PascalCase.tsx`, TS functions `camelCase`, Python files `snake_case.py`, tables `snake_case`, endpoints `/v1/<plural-noun>`.

## Security rules (enforced on the server, never only in the UI)

- Keep identity, membership, household, assistance and finance data separate; no cross-purpose joins.
- NIC photos and biometric data stay in private storage. AI identity checks are advisory; a person with the right permission decides.
- Humanitarian assistance never depends on membership, donations or political support.
- Location is optional and purpose-specific. No voter-preference inference, persuasion scoring or political profiling from family or assistance data.
- Permission checks, MFA for privileged staff, audit logging, encryption and documented retention. Details and current status: `docs/security/security-rules.md`.
- Never ask for, accept, store or use an SSH key passphrase or private key. The developer loads deploy keys into an SSH agent themselves.

## Testing and checks

| What | Command |
|---|---|
| Live PWA | `npm run typecheck` and `npm run build` (root) |
| Express API | `npm test --prefix server` |
| FastAPI | `python -m pytest` in `services/api` (database tests need `DATABASE_URL`) |
| Packages | `npm run test:packages` and `npm run typecheck:packages` |

Never claim a check passed unless it ran and passed.

## Reporting a feature

When implementing a feature, report in this order: A. feature name and what it does; B. BRD requirement IDs and acceptance criteria; C. files, marked NEW or MODIFIED; D. the code; E. a plain-English explanation of how data moves between app, API and database; F. run instructions; G. how it was tested, with actual results; H. completion report: what changed, what passed, what remains.

## Deploying

Production uses the release-package workflow in `deployment/README.md` (backup, stage on port 3002, activate with automatic rollback, verify over HTTPS). Do not use the server's `deploy.sh`.
