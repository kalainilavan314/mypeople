# My People administration dashboard (Next.js)

The staff web dashboard (BRD §15A.6, screens W01–W09 and D01–D35): Next.js 16 App Router, TypeScript, Tailwind CSS 4.

**Status: shell. Not for deployment.** The home page shows live API and database health, read on the server for every request, and lists the BRD's dashboard modules, all marked "Not built yet". Before the dashboard goes anywhere public it needs, per the BRD: staff sign-in with MFA, server-side sessions in secure HttpOnly cookies, per-route permission checks in the API, a strict content-security policy, and watermarking on evidence and exports.

## Run

```powershell
copy .env.example .env.local              # API_URL, read on the server only
npm run dev --workspace @my-people/admin-web   # http://localhost:3000
```

Start the FastAPI service too (`docs/development/setup.md`).

## Check

```powershell
npm run typecheck --workspace @my-people/admin-web   # next typegen, then tsc
npm run lint --workspace @my-people/admin-web
npm run build --workspace @my-people/admin-web
```

## How it is put together

- **Colours and fonts** come from `packages/design-tokens`. `src/app/layout.tsx` turns them into CSS variables and `globals.css` maps those into Tailwind (`bg-primary`, `text-muted`, `border-line`…); add no literal colours or fonts. Inter and Noto Sans Tamil are self-hosted with `@fontsource`, as in the PWA.
- **API calls** go through `@my-people/api-client` from the server (`src/lib/api.ts`, marked `server-only`), so the API address and, later, staff sessions never need to be exposed to the browser.
- **Cache Components** is on: data read per request lives in an async component wrapped in `<Suspense>`, and calls `connection()` so it is never frozen at build time.
- Features go in `src/features/<feature>/` as they are built. `AGENTS.md` is written by `next dev`; it points to the docs for this Next.js version in `node_modules/next/dist/docs/`.

Text is English with the Tamil product name for now; Tamil labels follow with the first real module.
