"""Record the gate and switch on v1.1 modules in one step, on the owner's decision.

The owner decided on 16 November 2026 to open every built module at once, before the full Gate G2
sign-off, instead of one dashboard form per module. Like the Tier 5 grant, an operator runs this on
the server, from services/api, with the approval reference first and, optionally, module keys:

    .venv/bin/python -m app.modules.features.open_modules "Owner decision, 16 Nov 2026" [key ...]

Without keys it opens every module. It acts as the one active Super Administrator (refused unless
there is exactly one, and only if they hold system.configure), and goes through the same service as
the dashboard: each module's own gate is recorded with the approval reference, then the module is
turned on, so every step is in the flag history and the audit log. A module still refused (the party
fund needs its finance policy decisions) is reported and stays off. Turning a module off again is
done on the dashboard (Settings), as before.
"""

import sys

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.session import create_database_engine
from app.modules.access import repository as access_repository
from app.modules.access import service as access_service
from app.modules.features import service
from app.modules.features.rules import FEATURES


def main(argv: list[str]) -> int:
    if not argv or not 3 <= len(argv[0].strip()) <= 200:
        print('Give the approval reference first (3 to 200 characters), then module keys, or none for every module.',
              file=sys.stderr)
        return 2
    approval_ref, keys = argv[0].strip(), argv[1:]
    unknown = [key for key in keys if key not in FEATURES]
    if unknown:
        print(f"Unknown modules: {', '.join(unknown)}", file=sys.stderr)
        return 2
    reason = f"Opened by server command on the owner's decision: {approval_ref}"
    settings = Settings()
    engine = create_database_engine(settings.database_url.get_secret_value())
    try:
        with Session(engine) as db:
            holders = access_repository.active_super_administrator_assignments(db)
            if len({holder.member_id for holder in holders}) != 1:
                print("Refused: there must be exactly one active Super Administrator", file=sys.stderr)
                return 1
            staff = access_service.load_staff(db, holders[0].member_id)
            results = service.open_modules(db, staff, keys or list(FEATURES), approval_ref, reason)
    except access_service.AccessRefused:
        print("Refused: the Super Administrator does not hold system.configure", file=sys.stderr)
        return 1
    finally:
        engine.dispose()
    # Module keys and outcomes only.
    for result in results:
        print(f"{result.key}: {result.outcome}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
