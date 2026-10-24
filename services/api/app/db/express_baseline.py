"""The Express migrations that the Alembic baseline revision (0001) stands for.

Before Alembic, the Express API built the schema with server/migrations/*.sql
and recorded each file in public.schema_migrations. Alembic takes over from the
point where all of these files have run; alembic/env.py refuses to run against
a database where any of them is missing.

Remove this module when the Express API and server/migrations are retired.
"""

from sqlalchemy import Connection, text

BASELINE_MIGRATIONS = (
    "0000_geo_reference.sql",
    "0001_init.sql",
    "0002_npm_membership.sql",
    "0003_events.sql",
    "0004_survey_profile.sql",
    "0005_community_reports.sql",
    "0006_party_fund.sql",
    "0007_profile_edit.sql",
    "0008_integrity_and_throttling.sql",
    "0009_verification.sql",
    "0010_error_log.sql",
    "0011_session_revocation.sql",
)


def applied_express_migrations(connection: Connection) -> set[str]:
    """Filenames recorded in the Express ledger; empty if the ledger does not exist."""
    ledger_exists = connection.scalar(text("SELECT to_regclass('public.schema_migrations') IS NOT NULL"))
    if not ledger_exists:
        return set()
    return set(connection.scalars(text("SELECT filename FROM public.schema_migrations")))


def missing_express_migrations(applied: set[str]) -> list[str]:
    """Baseline files not yet applied, in the order Express would run them."""
    return [filename for filename in BASELINE_MIGRATIONS if filename not in applied]
