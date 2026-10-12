# Profile and photo saving

The account reference is adapted to My People's actual features. A centred 80px circular avatar, member name, member ID, real contact information and status badges sit above a navy outlined Edit profile button. Pale gray grouped sections contain membership, activity and account settings, using aligned monochrome icons, readable labels and right-aligned values. Language, verification, privacy, notifications, theme, community, reports, member card and sign-out destinations remain available. No sample email or invented activity counts are displayed.

Styles are scoped to `.profile-page` in `app/src/core/theme/profile.css`. Inter and Noto Sans Tamil use the existing font system. The layout adapts to long names and enlarged text; dark mode keeps readable surfaces and contrast. The shared navy navigation follows the raised centre QR reference.

The photo-save failure came from an undefined member ID in the avatar endpoint after it had stored a replacement and deleted the old image. The route now uses the authenticated member's ID. Replacement stores the new object, locks the member row and commits its path before deleting the previous object. Failed database updates clean up uncommitted new objects and preserve the previous photo; uncertain commit results retain the bytes. Existing authentication, CSRF checks, image validation and signed avatar access remain in place.

Photo-only saves skip unchanged profile fields. The form waits for image compression, updates cached member data after successful upload and gives specific feedback for image, session, phone and partial-save failures. A failed photo can be retried without losing profile fields that were already saved.

Verification scripts: `scripts/verify-avatar.mjs`, `scripts/verify-profile-upload.mjs`, `scripts/verify-profile-ui.mjs` and the existing Home/civic/feature-route checks. Browser upload checks use local member/API fixtures; they do not change production member photos.
