# Integrations

One small client per outside service, so modules never call a vendor directly.

**Status:** `sms.py` exists as an interface with no vendor (INT-01 not contracted): it answers "not configured" in production and keeps messages in memory in development. **The other integrations are not built yet.** Identity images use a local encrypted store (`modules/identity/documents/vault.py`) until object storage is chosen (INT-08, OD-20).

BRD v1.1: INT-01 SMS, INT-02 push, INT-03 wallet passes, INT-07 email, INT-08 object storage, INT-09 staff identity provider, INT-13 payments, INT-14 WhatsApp, INT-16 speech, INT-17 language models, INT-18 official alerts, INT-21 observability.
