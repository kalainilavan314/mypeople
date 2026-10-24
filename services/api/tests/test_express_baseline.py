from pathlib import Path

from app.db.express_baseline import BASELINE_MIGRATIONS, missing_express_migrations

EXPRESS_MIGRATIONS_DIR = Path(__file__).resolve().parents[3] / "server" / "migrations"


def test_nothing_is_missing_once_every_baseline_file_ran():
    assert missing_express_migrations(set(BASELINE_MIGRATIONS)) == []


def test_missing_files_are_reported_in_run_order():
    applied = set(BASELINE_MIGRATIONS[:8])

    assert missing_express_migrations(applied) == list(BASELINE_MIGRATIONS[8:])


def test_an_empty_ledger_is_missing_everything():
    assert missing_express_migrations(set()) == list(BASELINE_MIGRATIONS)


def test_baseline_lists_exactly_the_express_migration_files():
    # A new file in server/migrations would not be covered by Alembic's
    # baseline. New schema changes belong in Alembic revisions instead.
    files = tuple(sorted(path.name for path in EXPRESS_MIGRATIONS_DIR.glob("*.sql")))

    assert files == BASELINE_MIGRATIONS
