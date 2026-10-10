# Navy theme and MedTech navigation

This visual layer supersedes the warm/gold palette in the earlier NorthUnity specification. The NorthUnity home layout, original hero photo, feature routes, fonts, gallery API, and authentication screens remain in place.

The signed-in shell uses civic navy `#07172D`, cards `#0C2546`, white text `#EDF6FF`, muted text `#A4BFDC`, and cyan `#57D9FF`. Home actions use subtle navy gradients with bright monochrome icons. The hero action and centre QR control use cyan-to-blue highlights. Glow is static and restrained; focus rings and labels remain clear. The existing appearance switch selects a deeper midnight navy `#030F21`.

The MedTech-style bar keeps five destinations: Home, Events, **Card / QR**, Gallery, Profile. The central scan-frame icon sits in a circular control raised above the bar, surrounded by a navy rim and cyan halo. It opens `/card?qr=1`, showing the existing server-issued check-in credential. It reopens the QR if the member hid it while remaining on the card screen. A missing credential still produces the existing unavailable state; the UI does not fabricate credentials.

The bar floats 10px above the bottom safe area, with 12px side gutters and a 540px maximum width. All buttons have at least 44px touch targets. The page's bottom clearance follows the actual bar height using ResizeObserver, including enlarged Tamil labels. Keyboard focus, one active-tab indicator, and accessible control names are retained. Reduced-motion preferences are respected.

The theme is scoped to `member-shell`; no root theme default or authentication theme was changed. Implementation: `app/src/components/BottomNav.tsx`, `app/src/screens/Card.tsx`, and `app/src/styles/member.css`. QA: `scripts/verify-medtech.mjs`, `scripts/verify-northunity.mjs`, and `scripts/verify-civic.mjs`; previews and results are in `design/qa/medtech`.

Measured minimum contrast: action captions 6.77:1, active navigation labels 7.95:1, inactive navigation labels 6.96:1, centre QR icon 5.74:1, and primary action text 8.93:1. The five navigation/QR checks and eight reference-UI checks pass, alongside the 34 existing mobile and behavior checks.
