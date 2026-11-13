# Phase 1 policy decisions

P1 records the decision catalogue from MP-DEC-001 without converting its
proposed defaults into live policy. A Tier 5 holder of `system.configure`
creates a revision, submits it, and records each named owner's signed evidence.
The revision is approved only after every required role approves it. Reviews
are append-only, every state transition is audited, and a rejected or approved
revision can only be changed by creating a new revision.

Bank-transfer finance remains fail-closed until FIN-01, FIN-02, FIN-03 and
FIN-05 are approved. FIN-04 controls the separate card-payment scope and is not
treated as approval for bank transfers.
