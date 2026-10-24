"""Alembic environment: connects with the API's DATABASE_URL setting."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app.core.config import Settings
from app.db.base import Base, include_object
from app.db.express_baseline import applied_express_migrations, missing_express_migrations
from app.db.session import to_sqlalchemy_url

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

database_url = to_sqlalchemy_url(Settings().database_url.get_secret_value())


def run_migrations_offline() -> None:
    """Print the SQL for review (alembic upgrade head --sql) without connecting."""
    context.configure(url=database_url, target_metadata=Base.metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(database_url, poolclass=pool.NullPool)

    # Revision 0001 records the schema built by the Express migrations. Check
    # them on a separate connection before Alembic writes anything (including
    # a stamp), so a database that is behind is never marked as up to date.
    with engine.connect() as connection:
        missing = missing_express_migrations(applied_express_migrations(connection))
    if missing:
        raise RuntimeError(
            "This database is missing Express migrations that the Alembic baseline "
            f"assumes: {', '.join(missing)}. Apply them first with "
            "`npm run migrate --prefix server`, then rerun this command."
        )

    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=Base.metadata,
            include_schemas=True,
            include_object=include_object,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
