# Geography and configuration (D34)

BRD v1.1 §11.18, §15A.6, §20.2; screen D34; requirements FR-ARCH-011, PRM-26.

**Status: Built.**

Registry and system administration:
- Feature flag and architecture module registry: phase gate verification, gate sign-off recording, and live module enabling/disabling
- Audited configuration changes: all mutations require documented rationale, recording actor, time, and impact
- Read-only system configuration & security policy indicators (MFA policy, token rotation, hash-chained audit, AES-256-GCM evidence vault)
- Read-only official district, DS and GN hierarchy; Phase 2 administrative boundary mutation endpoints remain out of scope
