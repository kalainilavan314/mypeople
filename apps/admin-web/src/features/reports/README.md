# Community reports operations (D01)

**Status: Built for the M1.3 operational queue.**

The English-only administration console shows actionable counts, a bounded and status-filtered list, and an individual report view. Every list and detail lookup is permission checked against the report's immutable submission-time area snapshot. Reporter identity and contact fields are not returned to this console.

Aggregate dashboard refreshes are intentionally not audited because they run every minute. Identifiable list and record views are audited. A report outside the staff member's effective `reports.view` geography returns `404`, avoiding record-existence disclosure.

The snapshot trigger covers all future inserts, including the frozen Express producer. Moving a member after submission cannot reroute an existing report.
