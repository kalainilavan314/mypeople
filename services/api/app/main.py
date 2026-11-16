"""Entry point for the My People API.

Run locally from services/api with:
    uvicorn app.main:create_app --factory --reload --port 8000

--factory makes uvicorn call create_app() at startup, so importing this module
(for example in tests) does not need a DATABASE_URL.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import sessionmaker

from app import health
from app.core.config import Settings
from app.core.middleware import add_security_headers, cors_options, refuse_cross_origin_writes
from app.db.session import create_database_engine
from app.integrations.sms import build_sms
from app.integrations.push import build_push
from app.modules.access import router as access
from app.modules.access.reviews import router as access_reviews
from app.modules.audit import router as audit
from app.modules.content.gallery import router as gallery
from app.modules.content.gallery.dependencies import build_media_store
from app.modules.community.reports.router import router as community_reports
from app.modules.election import router as election
from app.modules.events import router as events
from app.modules.features import router as features
from app.modules.finance.router import finance_router, fund_router, readiness_router as finance_readiness_router
from app.modules.home import router as home
from app.modules.households import router as households
from app.modules.messaging.broadcasts import router as broadcasts
from app.modules.messaging.notifications import router as notifications
from app.modules.privacy import router as privacy
from app.modules.policy_decisions import router as policy_decisions
from app.modules.operations import router as operations
from app.modules.profile import router as profile
from app.modules.profile.area_changes import router as area_changes
from app.modules.auth import router as auth
from app.modules.identity.appeals import router as identity_appeals
from app.modules.identity.documents import router as identity_documents
from app.modules.identity.documents.dependencies import build_vault
from app.modules.identity.duplicates import router as identity_duplicates
from app.modules.identity.recovery import router as identity_recovery
from app.modules.identity.registration import router as identity_registration
from app.modules.geography import router as geography
from app.modules.identity.reviews import router as identity_reviews
from app.modules.membership import router as membership
from app.modules.membership.card import router as member_card

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
    app.state.evidence_vault = build_vault(settings)
    app.state.media_store = build_media_store(settings)
    app.state.sms = build_sms(settings)
    app.state.push = build_push(settings)
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(membership.router)
    app.include_router(membership.membership_router)
    app.include_router(member_card.router)
    app.include_router(access.router)
    app.include_router(access_reviews.router)
    app.include_router(audit.router)
    app.include_router(identity_documents.router)
    app.include_router(identity_reviews.router)
    app.include_router(identity_appeals.router)
    app.include_router(identity_duplicates.router)
    app.include_router(identity_registration.router)
    app.include_router(identity_recovery.router)
    app.include_router(geography.router)
    app.include_router(events.router)
    app.include_router(gallery.router)
    app.include_router(community_reports)
    app.include_router(home.router)
    app.include_router(profile.router)
    app.include_router(area_changes.router)
    app.include_router(privacy.router)
    app.include_router(broadcasts.router)
    app.include_router(notifications.router)
    app.include_router(features.router)
    app.include_router(policy_decisions.router)
    app.include_router(operations)
    app.include_router(finance_readiness_router)
    app.include_router(fund_router)
    app.include_router(finance_router)
    app.include_router(households.router)
    app.include_router(election.router)
    app.include_router(election.member_router)

    # The middleware added last runs first, so the security headers are also
    # set on the 403 that the origin check returns.
    app.middleware("http")(refuse_cross_origin_writes)
    app.middleware("http")(add_security_headers)
    # Outermost, so browser preflight requests are answered before anything else.
    if options := cors_options(settings):
        app.add_middleware(CORSMiddleware, **options)

    return app
