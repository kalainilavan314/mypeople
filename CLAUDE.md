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

These are loaded once in `app/src/main.tsx` and exposed as `--font-ta`, `--font-ui`, `--font-head`, `--font-mono` CSS variables. Every stylesheet and every new component must reference these variables (or the equivalent `font.ta` / `font.ui` / `font.mono` entries in `app/src/theme/tokens.ts`) — never a literal font name, and never a new `@font-face`.

### Single source of truth — don't redeclare the font vars

`--font-ui`, `--font-head`, `--font-ta`, `--font-mono` are defined exactly **once**, at `:root` in `app/src/styles/tokens.css`. Every other stylesheet must *read* them (`font-family: var(--font-ui)` etc.) and never redeclare them with a literal value, even to "pin" the same fonts for a scoped theme class — CSS custom properties inherit automatically, so a scoped class only needs to override them if it genuinely wants a different value (it must not, per the lock above). A past pass redundantly re-listed the same Inter/Noto Sans Tamil value inside `.membership-page` in `membership-card.css`; that redeclaration was removed — don't reintroduce this pattern in a new component or theme file.

The only legitimate exception is `global.css`'s `html[lang='ta'] / :lang(ta) / .ta` rule, which flips the *priority order* (Noto Sans Tamil first) for Tamil-tagged content — same two fonts, just reordered for glyph coverage. That is not a new font and not something to copy elsewhere without the same `lang`-scoping reasoning.

### Past violation (already fixed — do not reintroduce)

An earlier redesign pass once set `app/src/styles/member.css`'s `--font-ui` to `'Outfit', 'Inter', 'Noto Sans Tamil', sans-serif` with a separate Latin-only `@font-face` for `'Outfit'` (no Tamil glyphs — Tamil text would have silently fallen back). It has since been reverted to `var(--font-ui)` with no local override. **This was a bug, not a precedent** — if you see any file defining its own font name again, that is a regression to undo, not a pattern to follow.

### If you think the font needs to change

Ask the developer directly: *"This task seems to want a different font for X — do you want me to change it, or keep the current Noto Sans Tamil / Inter / JetBrains Mono setup?"* Only proceed once they say yes, explicitly, to changing the font. A general instruction like "redesign this screen" or "make it look modern" is **not** that permission.

---

## Other conventions

- Tamil label first, English sub-label under it where both are shown (per `PROJECT.md`).
- Reuse the existing design tokens (`app/src/theme/tokens.ts`, `app/src/styles/tokens.css`) rather than hardcoding colors — but tokens for color/spacing are a separate concern from the font-family lock above, which is absolute.
