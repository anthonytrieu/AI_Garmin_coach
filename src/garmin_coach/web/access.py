"""Single-owner device access. Only token hashes are persisted; links are operator-issued."""

from __future__ import annotations

import argparse
import hashlib
import os
import secrets
import sqlite3
import time
from contextlib import closing
from urllib.parse import urlsplit

from .store import data_dir

SESSION_TTL = 90 * 24 * 60 * 60
LINK_TTL = 24 * 60 * 60
_SCHEMA = """
CREATE TABLE IF NOT EXISTS device_sessions (
    token_hash TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    created_at REAL NOT NULL,
    expires_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS setup_links (
    token_hash TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    expires_at REAL NOT NULL
);
"""


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _connect() -> sqlite3.Connection:
    path = data_dir() / "auth.db"
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    conn = sqlite3.connect(path, timeout=10)
    path.chmod(0o600)
    conn.executescript(_SCHEMA)
    return conn


def issue_setup_link(label: str = "Owner device", ttl: int = LINK_TTL) -> str:
    if not 60 <= ttl <= 7 * LINK_TTL or not label.strip() or len(label) > 80:
        raise ValueError("Use a 1–80 character label and a link lifetime of 1 minute to 7 days")
    token = secrets.token_urlsafe(32)
    now = time.time()
    with closing(_connect()) as conn, conn:
        conn.execute("DELETE FROM setup_links WHERE expires_at <= ?", (now,))
        count = conn.execute("SELECT COUNT(*) FROM setup_links").fetchone()[0]
        if count >= 20:
            raise ValueError("Too many outstanding setup links; revoke unused links first")
        conn.execute("INSERT INTO setup_links VALUES (?, ?, ?)", (_hash(token), label, now + ttl))
    return token


def exchange_link(token: str, old_session: str | None = None) -> str | None:
    """Consume the link and create a device session in the same transaction."""
    now = time.time()
    session = secrets.token_urlsafe(32)
    with closing(_connect()) as conn, conn:
        conn.execute("BEGIN IMMEDIATE")
        link = conn.execute(
            "SELECT label FROM setup_links WHERE token_hash=? AND expires_at>?",
            (_hash(token), now),
        ).fetchone()
        if link is None:
            return None
        conn.execute("DELETE FROM setup_links WHERE token_hash=?", (_hash(token),))
        conn.execute("DELETE FROM device_sessions WHERE expires_at<=?", (now,))
        if old_session:
            conn.execute("DELETE FROM device_sessions WHERE token_hash=?", (_hash(old_session),))
        # Keep at most ten trusted devices, evicting the oldest only on successful setup.
        conn.execute(
            "DELETE FROM device_sessions WHERE token_hash IN "
            "(SELECT token_hash FROM device_sessions ORDER BY created_at DESC LIMIT -1 OFFSET 9)"
        )
        conn.execute(
            "INSERT INTO device_sessions VALUES (?, ?, ?, ?)",
            (_hash(session), link[0], now, now + SESSION_TTL),
        )
    return session


def valid_session(token: str | None) -> bool:
    if not token or len(token) != 43:
        return False
    with closing(_connect()) as conn:
        return (
            conn.execute(
                "SELECT 1 FROM device_sessions WHERE token_hash=? AND expires_at>?",
                (_hash(token), time.time()),
            ).fetchone()
            is not None
        )


def revoke_session(token: str | None) -> None:
    if token:
        with closing(_connect()) as conn, conn:
            conn.execute("DELETE FROM device_sessions WHERE token_hash=?", (_hash(token),))


def main() -> None:
    parser = argparse.ArgumentParser(description="Operator-only private device access")
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create-link", help="Issue a private, single-use device setup URL")
    create.add_argument("--label", default="Owner device")
    create.add_argument("--hours", type=int, default=24, choices=range(1, 169))
    commands.add_parser("revoke-all", help="Revoke all trusted devices and outstanding setup links")
    args = parser.parse_args()
    if args.command == "revoke-all":
        with closing(_connect()) as conn, conn:
            conn.execute("DELETE FROM device_sessions")
            conn.execute("DELETE FROM setup_links")
        print("All trusted devices and setup links revoked.")
        return
    origin = os.environ.get("COACH_ORIGIN", "")
    parsed = urlsplit(origin)
    if (
        parsed.scheme != "https"
        or not parsed.netloc
        or parsed.query
        or parsed.fragment
        or parsed.path not in {"", "/"}
        or parsed.username
        or parsed.password
    ):
        parser.error("Set COACH_ORIGIN to the personal app's HTTPS origin")
    token = issue_setup_link(args.label, args.hours * 3600)
    # Fragments are not sent in HTTP requests or Referer headers. Never log this URL.
    print(origin.rstrip("/") + "/#setup=" + token)


if __name__ == "__main__":
    main()
