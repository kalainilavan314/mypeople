"""Give the Super Administrator every permission Tier 5 may hold.

The owner decided on 12 November 2026 that the Super Administrator should hold all 40 permissions
the BRD allows at Tier 5 (§9.8), not only the defaults. Tier 5 has nobody above it to grant it, so,
like the bootstrap, an operator runs this on the server, from services/api, with the person's NIC on
standard input, so it never appears in the shell history or the process list:

    .venv/bin/python -m app.modules.access.every_tier5_permission < nic.txt

It is refused if someone else holds Tier 5, the identity is not verified, or the membership is
suspended or inactive, and it is recorded in the audit log (access.assignment.widened).
"""

import sys

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import nic_hash
from app.db.session import create_database_engine
from app.modules.access import service
from app.modules.auth import repository as auth_repository


def main() -> int:
    nic = sys.stdin.readline().strip()
    if not nic:
        print("Give the person's NIC on standard input.", file=sys.stderr)
        return 2
    settings = Settings()
    engine = create_database_engine(settings.database_url.get_secret_value())
    try:
        with Session(engine) as db:
            member = auth_repository.find_sign_in_member(db, nic_hash(nic, settings.nic_pepper.get_secret_value()))
            if member is None:
                print("Refused: no member is registered with that NIC", file=sys.stderr)
                return 1
            assignment = service.grant_every_tier5_permission(db, member.id)
    except service.AssignmentRefused as error:
        print(f"Refused: {', '.join(error.problems)}", file=sys.stderr)
        return 1
    finally:
        engine.dispose()

    # Ids and a count only: the NIC is never printed.
    print(f"Tier 5 assignment {assignment.id} now holds {len(assignment.permissions)} permissions.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
