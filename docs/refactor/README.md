# Refactor handoff

The implementation is pushed to `codex/feature-first` and deployed as `civic-20261012T060314Z` at https://178.128.126.35.nip.io. The production source commit is `0f841b1`. Home follows the uploaded MedTech reference with six photo service cards; the subsequent request adds raised QR navigation, centred Profile menus and a photo-save fix. Events, the restored detailed membership card, Gallery content and sign-in/registration remain preserved. Draft pull request #2 contains the default-branch review; `main` has not been updated.

## Terminal commands

For the **current checkout**, run:

```powershell
Set-Location -LiteralPath "C:\Users\HP\Downloads\Northern Province People's Movement app"
npm --prefix app install
npm --prefix app run typecheck
npm --prefix app run build
npm --prefix app run dev
```

For a separate **pre-refactor checkout**, the exact initial moves are listed in `move-files.ps1`. Review that file first, change its project root to the separate checkout and then run it:

```powershell
Get-Content -LiteralPath .\docs\refactor\move-files.ps1
& .\docs\refactor\move-files.ps1
```

Do not run the migration script on this already-migrated working tree. It records directory creation, native PowerShell moves, the three requested folder deletes and the proven-unused source deletions. The component extractions are implemented code changes, rather than filesystem-only moves.

## Refactored code

The complete editable code is under `app/src/core/`, `app/src/shared/` and `app/src/features/`. Home is split into HomeHeader, CommunityHero, HomeServices and NearbyEvents. Membership view, dialogs, PDF actions and credential rendering remain in the card feature. API models are grouped by domain. Common stylesheet imports preserve their original cascade order.

See `../architecture.md` for boundaries, `../home-design.md` for Home and navigation, and `../profile-design.md` for Profile and safe avatar replacement. `before/` and `after/` contain fixture screenshots. The refactor preserved backend routes, permissions, cookies and migrations. The subsequent photo-save fix updates the existing avatar/profile routes without changing authentication, CSRF checks or the database schema.

The final query/component/router naming cleanup is prepared in `scripts/refactor/finalize-modules.mjs` and is awaiting the separate approval requested after automatic approval review rejected that broader operation. The compiled implementation does not depend on applying that cleanup.
