import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import create_app


def make_client(app_env: str) -> TestClient:
    return TestClient(create_app(Settings(app_env=app_env)))


def test_health_reports_ok():
    response = make_client("development").get("/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_is_only_served_under_v1():
    # Every endpoint is versioned (NFR-ARCH-02); an unversioned path must not exist.
    assert make_client("development").get("/health").status_code == 404


def test_openapi_documents_health_under_v1():
    schema = create_app(Settings(app_env="production")).openapi()

    assert schema["openapi"].startswith("3.1")
    assert "/v1/health" in schema["paths"]


def test_development_publishes_docs():
    client = make_client("development")

    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_production_hides_docs_but_stays_healthy():
    client = make_client("production")

    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404
    assert client.get("/v1/health").status_code == 200


def test_misspelt_environment_is_rejected(monkeypatch):
    monkeypatch.setenv("APP_ENV", "prod")

    with pytest.raises(ValidationError):
        Settings()
