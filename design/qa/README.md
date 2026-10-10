# Verification evidence

The five screenshots use an isolated synthetic member and event. Gallery content comes from the new local gallery router and the bundled licensed sample photographs. No production database or deployed host is contacted.

Run the app on 127.0.0.1:5175 and the isolated gallery router on 127.0.0.1:8788:

```powershell
npm run dev --prefix app -- --host 127.0.0.1 --port 5175 --strictPort
node scripts/gallery-preview.mjs
node scripts/verify-civic.mjs
```

The browser script requires Playwright and an installed Edge browser. If Playwright is supplied by the Codex runtime, set MY_PEOPLE_PLAYWRIGHT_MODULE to that package directory. This is a test-only dependency; it is not part of the client bundle.

Coverage: five normal mobile layouts; all visible core button targets; gallery API list/detail/category/404 behavior and local asset attribution/counts; failed RSVP retention; album dialog Escape dismissal; wallet availability and public-share preview; English and Tamil at 320px/430px and 200% text. The JSON report records each scenario. Native starter themes were not compiled as native projects.

For release, also test with real member status/permission data, a physical Android/iOS device, screen readers, and the intended production API. This evidence does not claim app-wide accessibility certification.
