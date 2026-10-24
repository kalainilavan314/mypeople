"""Health checks for load balancers, deploy scripts and monitoring."""

import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/health", tags=["health"])


class HealthStatus(BaseModel):
    status: Literal["ok", "unavailable"]


@router.get("")
def check_health() -> HealthStatus:
    """Confirm the API process is running. This does not touch the database."""
    return HealthStatus(status="ok")


@router.get("/db")
def check_database(response: Response, db: Annotated[Session, Depends(get_db)]) -> HealthStatus:
    """Confirm the API can run a query on PostgreSQL."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        # The cause stays in the server log. Callers only learn that the
        # database is unreachable, never host names or driver messages.
        logger.warning("Database health check failed", exc_info=True)
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthStatus(status="unavailable")
    return HealthStatus(status="ok")
