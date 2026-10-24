"""Entry point for the My People API.

Run locally from services/api with:
    uvicorn app.main:app --reload --port 8000
"""

from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

from app.core.config import Settings

API_VERSION = "0.1.0"


class HealthStatus(BaseModel):
    status: Literal["ok"]


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the API. Tests pass their own Settings; the server uses the environment."""
    settings = settings or Settings()

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
    )

    @app.get("/v1/health", tags=["health"])
    def check_health() -> HealthStatus:
        """Confirm the API process is running. This does not check the database."""
        return HealthStatus(status="ok")

    return app


app = create_app()
