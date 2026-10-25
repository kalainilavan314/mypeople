# Signed-in UI — NorthUnity reference

Current colour and navigation layer: see `medtech-navigation-specification.md`. The NorthUnity layout is retained; its warm/gold palette and original tab styling have been replaced by navy/cyan and the raised MedTech-style QR navigation.

The source supplied at `C:/Users/HP/Downloads/northunity/northunity` supersedes the earlier screenshot-only visual direction for the home page and action buttons. Its Flutter widgets are visual references; the running application remains React/TypeScript. Login, registration, welcome, and onboarding retain their existing components and theme.

The member shell uses cream `#FAFAF7`, card `#FFFDF8`, Outfit typography, gold `#E8A838`, 16px gutters, 20px hero corners, and 16px action-card corners. Action gradients reproduce the source orange, blue, green, coral, and purple colours. Dark text on the brighter gradients improves readability; all interactive controls have at least 44px touch targets. Dark mode retains this hierarchy with adapted surfaces.

Home structure: real member avatar/initials and greeting → searchable shortcuts → original coastal photo hero → Volunteer/Surveys → full-width Report Issue → Events/Community → full-width Party Fund → nearby event photo strip → upcoming events → My Area/Ideas/Courses/Referrals/Gallery/Card → real event/report/referral counters. All five existing tabs remain functional. Reference stub buttons and demo activity counts were not copied.

Images are self-hosted, optimized, and cached with the app. The hero is the same Pexels image referenced by the supplied source. Event covers are illustrative, visibly labelled, and mapped separately from real event records. The existing gallery API and replacement manifest remain intact; photo counts continue to reflect the returned photos.

Implementation: `app/src/screens/NorthUnityHome.tsx`, `app/src/styles/member.css`, `app/src/components/MemberVisuals.tsx`. Member-only variables are applied by `TabLayout`'s `member-shell` class. The authentication layout does not receive that class.

Assets: `app/public/member/coast-hero.webp` (original reference image), `outfit-latin.woff2` (SIL Open Font License, included OFL.txt), `sunset-alternative.webp` (generated optional alternative, not the live hero). The built-in imagegen tool generated the alternative with the prompt: “Photorealistic 16:9 tropical coastal sunset; teal sea, golden clouds, timber deck and thatched seaside bungalow at the right, small distant person enjoying the view; open sea and sky at the left for a heading; no text, logos or UI; illustrative branding, not documentary event imagery.”

QA uses fixture identities without production account access. It verifies working shortcuts, search, member-only styling, English/Tamil reflow, gallery dialogs, honest QR/wallet/share states, and server-confirmed RSVP behavior. Public health/assets/gallery checks follow deployment.
