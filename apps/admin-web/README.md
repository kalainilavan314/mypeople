# My People administration dashboard (Next.js)

The staff web dashboard (BRD §15A.6, screens W01–W09 and D01–D35): Next.js 16 App Router, TypeScript, Tailwind CSS 4.

**Status: staff modules built (Batch 22); not deployed.** Staff sign in with their own account and an authenticator code, then see only the modules their roles allow:

| Module | Screens |
|---|---|
| Verification queue and decision | W01, W02, D03 notice; images through 5-minute links |
| Appeals | D05 |
| Duplicate investigations | D04 |
| Membership activation | D06, with exact member-ID look-up |
| Roles and access | W09: roles in your areas, preview, assign, end |
| Audit log | FR-ADM-011, with the hash-chain check |

Before it goes anywhere public: a strict content-security policy, the evidence watermark (FR-WEB-006), `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` set on the server, and running behind Nginx as described in `deployment/README.md`.

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
- **Sessions.** Sign-in is a Server Action calling `/v1/auth/sign-in`; the API's 15-minute session token and its refresh token are kept in the `mp_staff` and `mp_staff_refresh` cookies (HttpOnly, SameSite=Strict, Secure in production), so browser scripts never see them and other sites cannot send them. `src/proxy.ts` renews the token before a page or action runs when it has a minute or less left; simultaneous requests share one renewal for 30 seconds, because a refresh token sent twice ends the session (this holds for one dashboard process). Every page reads it on the server (`src/lib/session.ts`, `server-only`) and `requireStaff()` (`src/lib/staff.ts`) sends a person without a working session to `/sign-in` and one without the second factor in this session to `/mfa`. The API checks the session, the factor and the permission again on every call.
- **API calls** go through `@my-people/api-client` from the server, with the staff member's token and their address as `X-Forwarded-For`, so the API address never reaches the browser.
- **Actions** are Server Actions in `src/features/<feature>/actions.ts` used by plain forms, so they work without client JavaScript. A refusal redirects back with the API's code and problem codes in the address (never personal data) and `Feedback` shows them in words (`src/lib/messages.ts`).
- **Evidence** opens through `src/app/evidence/[documentId]/route.ts`, which asks the API for the reviewer's 5-minute link and passes the image through with `no-store`, `nosniff` and a sandbox policy.
- **Cache Components** is on: data read per request lives in an async component wrapped in `<Suspense>`, and calls `connection()` so it is never frozen at build time.
- Features go in `src/features/<feature>/` as they are built. `AGENTS.md` is written by `next dev`; it points to the docs for this Next.js version in `node_modules/next/dist/docs/`.

Page titles are Tamil first with English under them; the rest of the staff text is English for now.
