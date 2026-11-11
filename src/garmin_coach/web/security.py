"""Single-owner passwordless device sessions. Setup links are issued only by an operator."""

import os
import re
import time
from collections import deque
from typing import Any
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from . import access

COOKIE = "coach_session"
TTL = access.SESSION_TTL


def install_security(app: FastAPI) -> None:
    local = os.getenv("GARMIN_COACH_ENV") == "local"
    if os.getenv("RAILWAY_ENVIRONMENT") and local:
        raise RuntimeError("Local authentication bypass is forbidden on Railway")
    origin = os.getenv("COACH_ORIGIN", "").rstrip("/")
    parsed = urlsplit(origin)
    if not local and (
        parsed.scheme != "https"
        or not parsed.netloc
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
        or parsed.username
        or parsed.password
    ):
        raise RuntimeError("Set COACH_ORIGIN to an HTTPS origin")
    attempts: deque[float] = deque(maxlen=5)

    @app.middleware("http")
    async def guard(request: Request, call_next: Any) -> Any:
        path = request.url.path
        if not path.startswith("/api/"):
            return await call_next(request)
        if local:
            return await call_next(request)
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            if request.headers.get("origin") != origin:
                return JSONResponse({"detail": "Origin rejected"}, status_code=403)
        if path != "/api/auth/setup" and not access.valid_session(request.cookies.get(COOKIE)):
            return JSONResponse({"detail": "Device setup required"}, status_code=401)
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    @app.post("/api/auth/setup")
    async def setup(request: Request) -> JSONResponse:
        now = time.monotonic()
        while attempts and attempts[0] < now - 60:
            attempts.popleft()
        if len(attempts) >= 5:
            return JSONResponse({"detail": "Try again in a minute"}, 429)
        attempts.append(now)
        if len(await request.body()) > 4096:
            return JSONResponse({"detail": "Invalid setup link"}, 400)
        try:
            token = (await request.json()).get("token", "")
        except (ValueError, AttributeError):
            return JSONResponse({"detail": "Invalid setup link"}, 400)
        if not isinstance(token, str) or not re.fullmatch(r"[A-Za-z0-9_-]{43}", token):
            return JSONResponse(
                {"detail": "This setup link is invalid, expired, or already used"}, 401
            )
        session = access.exchange_link(token, request.cookies.get(COOKIE))
        if session is None:
            return JSONResponse(
                {"detail": "This setup link is invalid, expired, or already used"}, 401
            )
        response = JSONResponse({"authenticated": True})
        response.set_cookie(
            COOKIE,
            session,
            max_age=TTL,
            httponly=True,
            secure=not local,
            samesite="strict",
            path="/api",
        )
        return response

    @app.post("/api/auth/setup-link")
    async def setup_link() -> JSONResponse:
        try:
            token = access.issue_setup_link("Additional device", ttl=15 * 60)
        except ValueError:
            return JSONResponse({"detail": "Too many unused links. Please try again later."}, 429)
        return JSONResponse({"url": origin + "/#setup=" + token, "expiresIn": 15 * 60})

    @app.get("/api/auth/session")
    async def session() -> dict[str, bool]:
        return {"authenticated": True}

    @app.post("/api/auth/logout")
    async def logout(request: Request) -> JSONResponse:
        access.revoke_session(request.cookies.get(COOKIE))
        response = JSONResponse({"authenticated": False})
        response.delete_cookie(
            COOKIE, path="/api", secure=not local, httponly=True, samesite="strict"
        )
        return response
