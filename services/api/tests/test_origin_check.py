"""The cross-origin write check and security headers (no database needed).

POST /v1/auth/sign-out is used as the write: with an unreadable token it does
no database work, so these tests run without PostgreSQL.
"""

import pytest

SIGN_OUT = "/v1/auth/sign-out"


def post_sign_out(client, *, cookie: bool, origin: str | None):
    if cookie:
        client.cookies.set("mp_session", "not-a-real-token")
    headers = {"Origin": origin} if origin else {}
    return client.post(SIGN_OUT, headers=headers)


def test_cookie_write_from_another_site_is_refused(make_client):
    response = post_sign_out(make_client(), cookie=True, origin="https://evil.example")

    assert response.status_code == 403
    assert response.json() == {"detail": "csrf_origin_mismatch"}


@pytest.mark.parametrize(
    ("cookie", "origin"),
    [
        (True, "http://testserver"),  # same origin as the API
        (True, None),  # no Origin header, e.g. a non-browser client
        (False, "https://evil.example"),  # no cookie to abuse, e.g. a mobile app with a Bearer token
    ],
)
def test_writes_that_cannot_be_cross_site_cookie_abuse_are_allowed(make_client, cookie, origin):
    assert post_sign_out(make_client(), cookie=cookie, origin=origin).status_code == 204


def test_configured_origins_are_allowed(make_client):
    client = make_client(allowed_origins="https://admin.example")

    assert post_sign_out(client, cookie=True, origin="https://admin.example").status_code == 204


def test_reads_are_never_blocked(make_client):
    client = make_client()
    client.cookies.set("mp_session", "not-a-real-token")

    response = client.get("/v1/health", headers={"Origin": "https://evil.example"})

    assert response.status_code == 200


def test_security_headers_match_the_express_api(make_client):
    response = make_client().get("/v1/health")

    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert response.headers["x-frame-options"] == "SAMEORIGIN"
    assert response.headers["cache-control"] == "no-store"


def test_the_refusal_also_carries_the_security_headers(make_client):
    response = post_sign_out(make_client(), cookie=True, origin="https://evil.example")

    assert response.headers["cache-control"] == "no-store"


def test_sign_out_without_a_session_clears_the_cookie(make_client):
    response = make_client().post(SIGN_OUT)

    assert response.status_code == 204
    cookie = response.headers["set-cookie"]
    assert cookie.startswith("mp_session=")
    assert "Max-Age=0" in cookie


# --- Cross-origin reads (CORS) ----------------------------------------------


def preflight(client, origin: str):
    return client.options(
        "/v1/members/me",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization"},
    )


def test_development_lets_local_apps_call_the_api(make_client):
    # Expo web on 8081 and Next.js on 3000 call the API on 8000 during development.
    response = preflight(make_client("development"), "http://localhost:8081")

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:8081"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_development_does_not_open_the_api_to_other_sites(make_client):
    response = preflight(make_client("development"), "https://evil.example")

    assert "access-control-allow-origin" not in response.headers


def test_production_allows_no_cross_origin_calls_by_default(make_client):
    response = preflight(make_client("production"), "http://localhost:8081")

    assert "access-control-allow-origin" not in response.headers


def test_production_allows_configured_origins(make_client):
    client = make_client("production", allowed_origins="https://admin.example")

    assert preflight(client, "https://admin.example").headers["access-control-allow-origin"] == "https://admin.example"
    assert "access-control-allow-origin" not in preflight(client, "http://localhost:8081").headers


def test_development_local_apps_may_sign_out_with_the_cookie(make_client):
    client = make_client("development")
    client.cookies.set("mp_session", "not-a-real-token")

    assert client.post(SIGN_OUT, headers={"Origin": "http://localhost:3000"}).status_code == 204


def test_production_refuses_local_origins_for_cookie_writes(make_client):
    client = make_client("production")
    client.cookies.set("mp_session", "not-a-real-token")

    assert client.post(SIGN_OUT, headers={"Origin": "http://localhost:3000"}).status_code == 403
