"""Database engine and per-request sessions."""

from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker


def to_sqlalchemy_url(database_url: str) -> str:
    """Name the psycopg 3 driver in a plain PostgreSQL URL.

    The Express API (node-postgres) accepts postgres:// and postgresql:// URLs.
    SQLAlchemy needs the driver in the scheme, so one DATABASE_URL value can
    serve both APIs while they run side by side.
    """
    for prefix in ("postgresql://", "postgres://"):
        if database_url.startswith(prefix):
            return "postgresql+psycopg://" + database_url.removeprefix(prefix)
    return database_url


def create_database_engine(database_url: str) -> Engine:
    # Keep the pool small. Every API instance holds its own pool, while the
    # database caps connections across all of them (see server/src/db.js).
    # pool_pre_ping replaces connections the database closed while idle.
    return create_engine(
        to_sqlalchemy_url(database_url),
        pool_size=5,
        max_overflow=5,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 5},
    )


def get_db(request: Request) -> Iterator[Session]:
    """FastAPI dependency: one session per request, always closed afterwards."""
    session_factory: sessionmaker[Session] = request.app.state.session_factory
    with session_factory() as session:
        yield session
