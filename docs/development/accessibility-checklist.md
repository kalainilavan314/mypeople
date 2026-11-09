# Accessibility acceptance checklist

Use this checklist for every new or materially changed member, staff, or
administrator screen. It is a release acceptance gate, not a substitute for
testing with people who use assistive technology.

## All apps

- [ ] The locked typography is unchanged: Inter for English UI, Noto Sans Tamil
  for Tamil, and JetBrains Mono only for identifiers.
- [ ] The selected language is coherent across the whole screen. The admin
  dashboard is English-only; mobile screens remain Tamil-first
  where both languages are required.
- [ ] Every action has visible text or an accessible name, a semantic role,
  and a minimum 44 by 44 px touch target. Primary fields and buttons use the
  shared 48 px control height.
- [ ] Focus order follows the visual and task order. Keyboard users can reach,
  operate, and visibly identify every control on web.
- [ ] Inputs have programmatic labels, useful hints where needed, and an error
  message tied to the invalid field. New errors are announced once; success
  and loading state changes are announced without stealing focus.
- [ ] Status is never communicated by colour alone: pair a written label with
  an icon or another visible cue.
- [ ] Body text has 4.5:1 contrast, large text has 3:1 contrast, and focus
  indicators are visible against every surface.
- [ ] At 200% text scaling, content reflows or scrolls without clipping,
  overlap, horizontal traps, or loss of the primary action. Tamil text keeps a
  line height of at least 1.4 times its font size.
- [ ] Images that convey information have useful alternative text. Decorative
  icons are hidden from assistive technology.

## Required evidence before review

1. Run the relevant typecheck and lint command.
2. Run `npm run test:packages`; it guards the shared mobile accessibility
   contracts and design-token contrast pairs in CI.
3. For changed admin screens, run `npm run lint --workspace @my-people/admin-web`
   and manually test keyboard-only navigation at 200% browser zoom.
4. For changed mobile screens, test TalkBack or VoiceOver and the largest
   supported device text size on a real device or emulator.
5. Record any exception in the PR with the affected BRD ID, user impact, and
   a follow-up owner. Do not silently waive a criterion.

## Baseline audit record

The 54 screens in the Phase 1 inventory still need a recorded manual audit.
Automated source-contract and colour-token tests cover shared controls, not
rendered screens or assistive-technology behaviour. For each screen, record:
screen ID, app, device/browser and version, language, keyboard or screen-reader
result, 200% scaling result, contrast and target-size result, defects, owner,
and retest evidence. A pass requires the checklist above on the rendered screen.

Admin Web also needs an automated DOM accessibility sweep in CI. The existing
ESLint rules do not measure rendered contrast, focus order or dynamic states.
Track this as an open M1.0 acceptance item until a browser runner is installed
and its results are reviewed. Mobile TalkBack and VoiceOver evidence likewise
requires real devices or emulators.
