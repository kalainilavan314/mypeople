# Civic design verification · 11 October 2026

The current reference screenshots are in `civic-system/`: Home, Events, native digital pass, Gallery, Profile and the unchanged login. They use synthetic member and event data. Sample gallery images retain their source/credit metadata and explicit sample labels.

- `verify-civic.mjs`: 34 checks for the five destinations, English/Tamil at 320/430px with 200% text, failed RSVP state, gallery data and actions.
- `verify-civic-system.mjs`: computed palette/surface values, rendered-text contrast across five primary screens in light/dark, preserved twelve feature entry points, survey search, profile row geometry and authentication isolation.
- `verify-medtech.mjs`: stable five tabs, raised Card/QR action, repeat QR opening, 44px targets and measured navigation clearance.
- `verify-membership-card.mjs`: readable wallet pass at normal proportion, narrow-screen growth, long Tamil content, separate printable-ID viewer, QR, honest Wallet availability/public-share preview, optional real PDF download.

The DOM contrast audit handles solid and translucent backgrounds and the painted 40px action surface. Its photo scrim and decorative/print artwork exclusions are recorded separately in `../contrast-audit.json` and the production specification. It is evidence for supported scenarios, not formal WCAG certification. Native component trees/theme starters are design handoff files, not tested native binaries.

Previous `northunity/` screenshots describe the superseded visual reference; they are retained as history. `membership/` includes the detailed printable ID and PDF checks, which are separate from the primary wallet pass. Public release checks use actual health/gallery HTTP responses and production asset hashes; browser UI checks use isolated fixtures.
