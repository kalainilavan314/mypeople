"""Entry point for the My People API.

Run locally from services/api with:
    uvicorn app.main:create_app --factory --reload --port 8000

--factory makes uvicorn call create_app() at startup, so importing this module
(for example in tests) does not need a DATABASE_URL.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.orm import sessionmaker

from app import health
from app.core.config import Settings
from app.core.middleware import add_security_headers, refuse_cross_origin_writes
from app.db.session import create_database_engine
from app.modules.auth import router as auth
from app.modules.membership import router as membership

API_VERSION = "0.1.0"


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the API. Tests pass their own Settings; the server uses the environment."""
    settings = settings or Settings()

    # The engine connects lazily, so the API starts even while the database is
    # down; /v1/health/db reports that state instead.
    engine = create_database_engine(settings.database_url.get_secret_value())

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        yield
        engine.dispose()

    # The interactive docs and the OpenAPI document list every endpoint, so
    # production does not publish them. The schema can still be produced
    # offline with create_app().openapi().
    publish_docs = settings.app_env != "production"

    app = FastAPI(
        title="My People API",
        version=API_VERSION,
        docs_url="/docs" if publish_docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if publish_docs else None,
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(membership.router)

    # The middleware added last runs first, so the security headers are also
    # set on the 403 that the origin check returns.
    app.middleware("http")(refuse_cross_origin_writes)
    app.middleware("http")(add_security_headers)

    return app
