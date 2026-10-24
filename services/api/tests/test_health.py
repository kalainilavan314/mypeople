def test_health_reports_ok(make_client):
    response = make_client().get("/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_is_only_served_under_v1(make_client):
    # Every endpoint is versioned (NFR-ARCH-02); an unversioned path must not exist.
    assert make_client().get("/health").status_code == 404


def test_database_health_reports_unavailable_without_details(make_client):
    response = make_client().get("/v1/health/db")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}


def test_openapi_documents_every_path_under_v1(make_client):
    schema = make_client("production").app.openapi()

    assert schema["openapi"].startswith("3.1")
    assert {"/v1/health", "/v1/health/db", "/v1/members/me"} <= set(schema["paths"])
    assert all(path.startswith("/v1/") for path in schema["paths"])


def test_openapi_shows_which_endpoints_need_a_session(make_client):
    paths = make_client().app.openapi()["paths"]

    assert paths["/v1/members/me"]["get"]["security"] == [{"APIKeyCookie": []}, {"HTTPBearer": []}]
    assert "security" not in paths["/v1/health"]["get"]


def test_development_publishes_docs(make_client):
    client = make_client("development")

    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_production_hides_docs_but_stays_healthy(make_client):
    client = make_client("production")

    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404
    assert client.get("/v1/health").status_code == 200
