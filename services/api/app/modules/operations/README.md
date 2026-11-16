# operations module

P2 closes the Phase 1 staff and governance foundations as one policy-bound vertical slice.

- `rules.py` contains deterministic control bounds, assignment transitions, replay checks and primary/secondary suppression.
- `repository.py` owns SQL for immutable controls, volunteer assignments, registered devices, offline scan evidence, policy versions, consent events and Tier 5 certifications.
- `service.py` applies area permissions, current-approved-revision gates, server pass revalidation, audit records and fail-closed publication rules.
- `router.py` exposes `/v1/operations` to the admin, staff and member clients.

No proposed value is live policy. Opening a newer revision invalidates the machine control linked to the older approved revision until a new approval and control version are recorded. Offline device tokens are shown once and stored only as SHA-256 hashes server-side. Identifiable volunteer records are area-scoped; aggregate results suppress small and derivable cells.
