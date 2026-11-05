"""Single-owner opaque sessions. No passwords or session tokens are logged.

One process/replica only: restart revokes sessions. Production requires TLS.
"""

import os
import secrets
import time
from collections import deque
from typing import Any
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

COOKIE = "coach_session"
TTL = 12 * 60 * 60


def install_security(app: FastAPI) -> None:
    local = os.getenv("GARMIN_COACH_ENV") == "local"
    if os.getenv("RAILWAY_ENVIRONMENT") and local:
        raise RuntimeError("Local authentication bypass is forbidden on Railway")
    password = os.getenv("COACH_PASSWORD", "")
    origin = os.getenv("COACH_ORIGIN", "")
    if not local and (len(password) < 24 or urlsplit(origin).scheme != "https"):
        raise RuntimeError("Set COACH_PASSWORD (24+ characters) and an HTTPS COACH_ORIGIN")
    sessions: dict[str, float] = {}
    attempts: deque[float] = deque(maxlen=5)

    @app.middleware("http")
    async def guard(request: Request, call_next: Any) -> Any:
        path = request.url.path
        if not path.startswith("/api/"):
            return await call_next(request)
        if local:
            return await call_next(request)
        now = time.monotonic()
        for token, expiry in list(sessions.items()):
            if expiry <= now:
                sessions.pop(token, None)
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            if request.headers.get("origin") != origin:
                return JSONResponse({"detail": "Origin rejected"}, status_code=403)
        if path != "/api/auth/login" and request.cookies.get(COOKIE) not in sessions:
            return JSONResponse({"detail": "Sign in required"}, status_code=401)
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.post("/api/auth/login")
    async def login(request: Request) -> JSONResponse:
        now = time.monotonic()
        while attempts and attempts[0] < now - 60:
            attempts.popleft()
        if len(attempts) >= 5:
            return JSONResponse({"detail": "Try again in a minute"}, 429)
        attempts.append(now)
        body = await request.body()
        if len(body) > 4096:
            return JSONResponse({"detail": "Invalid login"}, 400)
        try:
            submitted = (await request.json()).get("password", "")
        except (ValueError, AttributeError):
            return JSONResponse({"detail": "Invalid login"}, 400)
        if (
            not isinstance(submitted, str)
            or not secrets.compare_digest(submitted.encode(), password.encode())
            or (not password and not local)
        ):
            return JSONResponse({"detail": "Invalid login"}, 401)
        token = secrets.token_urlsafe(32)
        if len(sessions) >= 10:
            sessions.pop(next(iter(sessions)))
        sessions[token] = now + TTL
        response = JSONResponse({"authenticated": True})
        response.set_cookie(
            COOKIE,
            token,
            max_age=TTL,
            httponly=True,
            secure=not local,
            samesite="strict",
            path="/api",
        )
        return response

    @app.get("/api/auth/session")
    async def session() -> dict[str, bool]:
        return {"authenticated": True}

    @app.post("/api/auth/logout")
    async def logout(request: Request) -> JSONResponse:
        sessions.pop(request.cookies.get(COOKIE, ""), None)
        response = JSONResponse({"authenticated": False})
        response.delete_cookie(COOKIE, path="/api")
        return response
