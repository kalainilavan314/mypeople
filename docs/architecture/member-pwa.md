# Frontend architecture

The frontend is Vite, React and TypeScript; the existing Express/PostgreSQL backend remains JavaScript. `app/src/features/` owns screens and their local components. The source moved from `screens/`, `components/`, `data/`, `styles/` and `theme/` into explicit feature, shared and core layers.

| Layer | Responsibility |
| --- | --- |
| `features/` | Home, events, card, gallery, profile, authentication and the remaining planned feature screens |
| `shared/components/` | Buttons, fields, query boundaries, icons, navigation and shared overlays |
| `shared/hooks/` | Authentication, member queries, theme and connectivity |
| `core/theme/` | CSS surfaces, component styles, typography and TypeScript token exports |
| `core/i18n/` | English/Tamil resources and the retained Sinhala resource |
| `core/lib/` | QR, images, dates/member display, NIC and viewport helpers |
| `core/api/` | API contracts, HTTP adapters, React Query hooks, models and outbox |

The `@/` alias resolves to `app/src/` in both Vite and TypeScript. A feature may import core/shared services and its own components. Model modules contain domain types and pure helpers; components own rendering. Screen files remain within 200 lines. Home stays below 150 lines. Static authentication CSS moved into theme files and is injected in its original position to preserve its cascade.

`core/theme/index.css` preserves the original order: global styles, civic components, member shell. Home's navy/pale-blue reference styling is scoped to Home. The detailed membership credential remains the canonical source for the on-screen card and PDF.

## Data boundaries

Authentication, member identity/profile, rotating card credentials, events/RSVP, community reports, donations and gallery use their existing backend adapters. Surveys, ideas, skills, courses and some historical activity views still use the existing prototype adapter. That limitation predates this refactor; moving files does not convert those features into production APIs. Active prototype data is retained to preserve working feature flows.

Do not put authentication secrets, uploaded identity documents, database backups or generated deployment packages into source control. Deployment scripts and runtime certificate files were preserved; only the explicitly requested generated artifact and unused native-design folders were removed.

## Validation and migrations

Run `npm --prefix app run typecheck` and `npm --prefix app run build`. Browser regression scripts under `scripts/` use local API fixtures. The Home checks cover responsive English/Tamil layouts and navigation clearance; membership tests include actual PDF generation.
