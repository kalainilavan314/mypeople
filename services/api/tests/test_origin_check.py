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
