"""Create the first Super Administrator (Tier 5, platform scope).

Every other assignment is made through the API by someone who holds
roles.assign (RB-02, RB-03). The first one has nobody above it to grant it,
so an operator runs this once, on the server, from services/api:

    python -m app.modules.access.bootstrap <member-id> --permission members.verify

It gives the Tier 5 default permissions plus any explicit Tier 5 permissions
named with --permission. It is refused if an active Super Administrator
already exists or the member's identity has not been confirmed, and it is
recorded in the audit log.
"""

import argparse
import sys
import uuid

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.session import create_database_engine
from app.modules.access import service


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create the first Super Administrator.")
    parser.add_argument("member_id", type=uuid.UUID, help="npm.member id of a member whose identity is confirmed")
    parser.add_argument(
        "--permission",
        action="append",
        default=[],
        help="an explicit Tier 5 permission to include, e.g. members.verify (repeatable)",
    )
    args = parser.parse_args(argv)

    engine = create_database_engine(Settings().database_url.get_secret_value())
    try:
        with Session(engine) as db:
            assignment = service.bootstrap_super_administrator(db, args.member_id, args.permission)
    except service.AssignmentRefused as error:
        print(f"Refused: {', '.join(error.problems)}", file=sys.stderr)
        return 1
    finally:
        engine.dispose()

    print(f"Created assignment {assignment.id} with {len(assignment.permissions)} permissions.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
