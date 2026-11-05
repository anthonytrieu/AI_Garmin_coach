import pytest
from fastapi.testclient import TestClient

from garmin_coach.web.app import create_app

PASSWORD = "test-only-password-32-characters-long"
ORIGIN = "https://coach.example.test"


@pytest.fixture
def secured(monkeypatch, tmp_path):
    monkeypatch.delenv("GARMIN_COACH_ENV", raising=False)
    monkeypatch.setenv("COACH_PASSWORD", PASSWORD)
    monkeypatch.setenv("COACH_ORIGIN", ORIGIN)
    monkeypatch.setenv("GARMIN_COACH_DATA", str(tmp_path))
    return TestClient(create_app(), base_url=ORIGIN)


def test_production_fails_closed(monkeypatch):
    monkeypatch.delenv("GARMIN_COACH_ENV", raising=False)
    monkeypatch.delenv("COACH_PASSWORD", raising=False)
    with pytest.raises(RuntimeError):
        create_app()


def test_railway_rejects_bypass(monkeypatch):
    monkeypatch.setenv("GARMIN_COACH_ENV", "local")
    monkeypatch.setenv("RAILWAY_ENVIRONMENT", "production")
    with pytest.raises(RuntimeError):
        create_app()


def test_protected_routes_and_csrf(secured):
    assert secured.get("/healthz").status_code == 200
    for path in ["/api/rides", "/api/chat/conversations", "/api/docs", "/api/auth/session"]:
        assert secured.get(path).status_code == 401
    assert secured.post("/api/auth/login", json={"password": PASSWORD}).status_code == 403
    assert (
        secured.post(
            "/api/auth/login", headers={"Origin": "https://evil.test"}, json={"password": PASSWORD}
        ).status_code
        == 403
    )
    login = secured.post("/api/auth/login", headers={"Origin": ORIGIN}, json={"password": PASSWORD})
    assert login.status_code == 200
    cookie = login.headers["set-cookie"]
    assert "HttpOnly" in cookie and "Secure" in cookie and "SameSite=strict" in cookie
    assert secured.get("/api/chat/conversations").json() == []
    assert secured.delete("/api/chat/conversations/nope").status_code == 403
    old_cookie = secured.cookies.get("coach_session")
    assert secured.post("/api/auth/logout", headers={"Origin": ORIGIN}).status_code == 200
    assert (
        secured.get(
            "/api/auth/session", headers={"Cookie": f"coach_session={old_cookie}"}
        ).status_code
        == 401
    )


def test_login_limit_and_bad_password(secured):
    for _ in range(5):
        assert (
            secured.post(
                "/api/auth/login", headers={"Origin": ORIGIN}, json={"password": "wrong"}
            ).status_code
            == 401
        )
    assert (
        secured.post(
            "/api/auth/login", headers={"Origin": ORIGIN}, json={"password": PASSWORD}
        ).status_code
        == 429
    )
