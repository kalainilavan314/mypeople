# Gallery console and removal queue (GAP-04, D08)

BRD v1.1 §11.13, §15A.6; screen D08; requirements FR-GAL-001 to 007, FR-ADM-005, FR-ADM-006.

**Status: Built.**

Media administration console:
- Album management: draft creation, WebP image conversion removing EXIF/GPS, bilingual captions on each photo, submit and return workflows
- Separation of duties: album publishing requires explicit approval by a staff member other than the author who submitted it
- 24-hour statutory photo removal request queue handling member and public requests
- Safe authenticated photo previewing via streaming server proxy (never exposing evidence through public URLs)
- Removal decisions: remove (permanent deletion), blur, or keep with mandatory audit rationale
- Automated 18-hour escalation flags for pending removal requests
