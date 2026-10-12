# Refactor handoff

The implementation is pushed to `codex/feature-first` and deployed as `civic-20261012T045612Z` at https://178.128.126.35.nip.io. The production source commit is `834cccf`. Home and its feature cards follow the latest uploaded MedTech reference. The other four tab sections and authentication retain their behaviour and appearance. Draft pull request #2 contains the default-branch review; `main` has not been updated.

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

See `../architecture.md` for boundaries and `../home-design.md` for the new visual specification and component tree. `before/` and `after/` contain local fixture screenshots. Backend routes, permissions, cookies and migrations were not changed by this task.

The final query/component/router naming cleanup is prepared in `scripts/refactor/finalize-modules.mjs` and is awaiting the separate approval requested after automatic approval review rejected that broader operation. The compiled implementation does not depend on applying that cleanup.
