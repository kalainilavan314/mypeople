# Instructions for AI agents working in this repo

This file is the cross-tool version of `CLAUDE.md` (Claude Code's convention), for any other agentic tool/IDE working in this repo (Antigravity, Cursor, etc.) that reads `AGENTS.md` instead of or in addition to `CLAUDE.md`. **The rules in `CLAUDE.md` apply in full — read that file.** This file exists only so tools that don't look for `CLAUDE.md` still see the same rules.

## 🔒 LOCKED: Typography — do not change fonts

The app's fonts are locked. No agent may change the font family for Tamil text, English/UI text, or monospace/ID text — ever — unless the human developer explicitly asks, in that exact conversation, to change the font. A general redesign, new theme, or "make it look modern" request is **not** that permission — stop and ask first.

**Canonical fonts** (defined once, at `:root` in `app/src/core/theme/tokens.css`):

| Use | Font |
|---|---|
| Tamil text | Noto Sans Tamil |
| English / UI text | Inter |
| IDs, coordinates, monospace data | JetBrains Mono |

Reference `--font-ta` / `--font-ui` / `--font-head` / `--font-mono` (or `font.ta` / `font.ui` / `font.mono` in `app/src/core/theme/tokens.ts`). Never a literal font name, never a new `@font-face`, never a redeclaration of these variables elsewhere — see `CLAUDE.md` for the full reasoning and the one legitimate exception (`.ta`/`[lang=ta]` reordering the same two fonts, not introducing a new one).

See `CLAUDE.md` for the rest of this repo's conventions.
