import concurrent.futures
import sqlite3
from contextlib import closing

import pytest
from fastapi.testclient import TestClient

from garmin_coach.web import access
from garmin_coach.web.app import create_app

ORIGIN = "https://coach.example.test"


@pytest.fixture
def secured(monkeypatch, tmp_path):
    monkeypatch.delenv("GARMIN_COACH_ENV", raising=False)
    monkeypatch.delenv("COACH_PASSWORD", raising=False)
    monkeypatch.setenv("COACH_ORIGIN", ORIGIN)
    monkeypatch.setenv("GARMIN_COACH_DATA", str(tmp_path))
    return TestClient(create_app(), base_url=ORIGIN)


def setup(client, token=None):
    return client.post(
        "/api/auth/setup",
        headers={"Origin": ORIGIN},
        json={"token": token or access.issue_setup_link()},
    )


def test_production_fails_closed(monkeypatch):
    monkeypatch.delenv("GARMIN_COACH_ENV", raising=False)
    monkeypatch.delenv("COACH_ORIGIN", raising=False)
    with pytest.raises(RuntimeError):
        create_app()


def test_railway_rejects_bypass(monkeypatch):
    monkeypatch.setenv("GARMIN_COACH_ENV", "local")
    monkeypatch.setenv("RAILWAY_ENVIRONMENT", "production")
    with pytest.raises(RuntimeError):
        create_app()


def test_protected_routes_csrf_and_no_password_access(secured):
    assert secured.get("/healthz").status_code == 200
    for path in ["/api/tracking", "/api/chat/conversations", "/api/docs", "/api/auth/session"]:
        assert secured.get(path).status_code == 401
    token = access.issue_setup_link()
    assert secured.post("/api/auth/setup", json={"token": token}).status_code == 403
    assert (
        secured.post(
            "/api/auth/setup", headers={"Origin": "https://evil.test"}, json={"token": token}
        ).status_code
        == 403
    )
    assert (
        secured.post(
            "/api/auth/login", headers={"Origin": ORIGIN}, json={"password": "old-password"}
        ).status_code
        == 401
    )
    login = setup(secured, token)
    assert login.status_code == 200
    cookie = login.headers["set-cookie"]
    assert all(part in cookie for part in ["HttpOnly", "Secure", "SameSite=strict", "Path=/api"])
    assert f"Max-Age={access.SESSION_TTL}" in cookie
    assert login.headers["cache-control"] == "no-store"
    assert secured.get("/api/chat/conversations").json() == []
    assert secured.delete("/api/chat/conversations/nope").status_code == 403
    session = secured.cookies.get("coach_session")
    assert secured.post("/api/auth/logout", headers={"Origin": ORIGIN}).status_code == 200
    assert not access.valid_session(session)
    assert secured.get("/api/auth/session").status_code == 401


def test_setup_rate_limit_and_bad_tokens(secured):
    for _ in range(5):
        assert setup(secured, "invalid").status_code == 401
    assert setup(secured).status_code == 429


def test_link_single_use_hash_storage_and_restart(secured, tmp_path):
    token = access.issue_setup_link("Synthetic phone")
    assert setup(secured, token).status_code == 200
    session = secured.cookies.get("coach_session")
    assert session and session != token
    restarted = TestClient(create_app(), base_url=ORIGIN)
    restarted.cookies.set("coach_session", session, domain="coach.example.test", path="/api")
    assert restarted.get("/api/auth/session").status_code == 200
    assert setup(restarted, token).status_code == 401
    assert access.valid_session(session), "Replayed links must not revoke the original device"
    with sqlite3.connect(tmp_path / "auth.db") as conn:
        rows = str(conn.execute("SELECT * FROM device_sessions").fetchall())
        assert session not in rows and token not in rows
    assert (tmp_path / "auth.db").stat().st_mode & 0o777 == 0o600
    assert restarted.post("/api/auth/logout", headers={"Origin": ORIGIN}).status_code == 200
    assert secured.get("/api/auth/session").status_code == 401


def test_expired_links_sessions_and_forged_cookies(secured, monkeypatch):
    now = access.time.time()
    monkeypatch.setattr(access.time, "time", lambda: now)
    expired = access.issue_setup_link(ttl=60)
    valid = access.issue_setup_link()
    assert setup(secured, valid).status_code == 200
    session = secured.cookies.get("coach_session")
    monkeypatch.setattr(access.time, "time", lambda: now + 61)
    assert setup(secured, expired).status_code == 401
    assert access.valid_session(session)
    assert not access.valid_session("A" * 43)
    monkeypatch.setattr(access.time, "time", lambda: now + access.SESSION_TTL + 1)
    assert secured.get("/api/auth/session").status_code == 401


def test_concurrent_link_redemption_and_session_rotation(secured):
    token = access.issue_setup_link()
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(access.exchange_link, [token, token]))
    assert sum(value is not None for value in outcomes) == 1
    first = next(value for value in outcomes if value)
    second = access.exchange_link(access.issue_setup_link(), first)
    assert not access.valid_session(first)
    assert access.valid_session(second)


def test_operator_revocation_and_device_bound(secured, monkeypatch):
    sessions = [access.exchange_link(access.issue_setup_link()) for _ in range(12)]
    assert sum(access.valid_session(token) for token in sessions) == 10
    unused = access.issue_setup_link()
    monkeypatch.setattr("sys.argv", ["access", "revoke-all"])
    access.main()
    assert not any(access.valid_session(token) for token in sessions)
    assert access.exchange_link(unused) is None
    with closing(access._connect()) as conn:
        assert conn.execute("SELECT COUNT(*) FROM device_sessions").fetchone()[0] == 0


def test_only_trusted_device_can_issue_a_new_link(secured):
    assert secured.post("/api/auth/setup-link", headers={"Origin": ORIGIN}).status_code == 401
    assert setup(secured).status_code == 200
    assert secured.post("/api/auth/setup-link").status_code == 403
    response = secured.post("/api/auth/setup-link", headers={"Origin": ORIGIN})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    token = response.json()["url"].split("#setup=")[1]
    assert response.json()["expiresIn"] == 900
    other = TestClient(create_app(), base_url=ORIGIN)
    assert setup(other, token).status_code == 200
    assert other.get("/api/auth/session").status_code == 200
