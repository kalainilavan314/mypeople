# messaging module

Notifications, SMS, WhatsApp, subscriptions and templates, with opt-in and STOP.

**Status: in-app notifications, push behind an interface and staff broadcasts built (Batch 19); SMS and WhatsApp notices, subscriptions and STOP not built yet (no vendors, INT-01, INT-14).**

- `notifications/`: `/v1/notifications`, the inbox, channel choices and quiet hours, push devices, the fixed templates (`templates.py`) and push delivery (`service.dispatch`). Other modules call `notify()` inside their own transaction.
- `broadcasts/`: `/v1/notifications/broadcasts`, staff announcements by area with preview, scheduling and approval above district scope; announcements are held while an election silence window covers the area (Batch 20, NFR-ELC-03).

BRD v1.1: FR-MSG-001 to 008, FR-REG-021, FR-ADM-007, FR-STF-009, FR-HOME-009 to 011, FR-PROF-012; INT-01, INT-02, INT-07, INT-14; BR-027, BR-145, BR-146. Alembic `0017`.
