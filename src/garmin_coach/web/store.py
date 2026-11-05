"""SQLite persistence for coach chat history.

Single-user local storage: conversations and their messages, written as the
chat streams. Lives outside the repo (like Garmin tokens) so `git clean` can
never eat a chat log. The schema is deliberately small; ride/wellness cache
tables can join this database later.
"""

from __future__ import annotations

import json
import os
import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

DEFAULT_DATA_DIR = Path.home() / ".garmin-coach"
TITLE_MAX = 60

_SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    sdk_session_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    tools TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
"""


def data_dir() -> Path:
    """Storage directory: $GARMIN_COACH_DATA or ~/.garmin-coach."""
    env = os.environ.get("GARMIN_COACH_DATA")
    return Path(env).expanduser() if env else DEFAULT_DATA_DIR


def db_path() -> Path:
    return data_dir() / "chat.db"


def _connect() -> sqlite3.Connection:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    conn = sqlite3.connect(path)
    path.chmod(0o600)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(_SCHEMA)
    return conn


def _now() -> str:
    # Microsecond resolution: recency ordering must work within a single second.
    return datetime.now(UTC).isoformat()


def _title_from(text: str) -> str:
    title = " ".join(text.split())
    return title[: TITLE_MAX - 1] + "…" if len(title) > TITLE_MAX else title or "New chat"


def ensure_conversation(conversation_id: str, first_message: str) -> None:
    """Create the conversation if missing; an existing title is never overwritten."""
    now = _now()
    with closing(_connect()) as conn, conn:
        conn.execute(
            "INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at) "
            "VALUES (?, ?, ?, ?)",
            (conversation_id, _title_from(first_message), now, now),
        )


def append_message(
    conversation_id: str, role: str, text: str, tools: list[str] | None = None
) -> None:
    now = _now()
    with closing(_connect()) as conn, conn:
        conn.execute(
            "INSERT INTO messages (conversation_id, role, text, tools, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (conversation_id, role, text, json.dumps(tools or []), now),
        )
        conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conversation_id))


def set_sdk_session_id(conversation_id: str, sdk_session_id: str) -> None:
    with closing(_connect()) as conn, conn:
        conn.execute(
            "UPDATE conversations SET sdk_session_id = ? WHERE id = ?",
            (sdk_session_id, conversation_id),
        )


def get_sdk_session_id(conversation_id: str) -> str | None:
    with closing(_connect()) as conn:
        row = conn.execute(
            "SELECT sdk_session_id FROM conversations WHERE id = ?", (conversation_id,)
        ).fetchone()
    return row["sdk_session_id"] if row else None


def list_conversations() -> list[dict[str, Any]]:
    """All conversations, most recently active first."""
    with closing(_connect()) as conn:
        rows = conn.execute(
            "SELECT c.id, c.title, c.updated_at, COUNT(m.id) AS message_count "
            "FROM conversations c LEFT JOIN messages m ON m.conversation_id = c.id "
            "GROUP BY c.id ORDER BY c.updated_at DESC, c.rowid DESC"
        ).fetchall()
    return [dict(row) for row in rows]


def get_conversation(conversation_id: str) -> dict[str, Any] | None:
    """One conversation with its messages in order, or None if unknown."""
    with closing(_connect()) as conn:
        convo = conn.execute(
            "SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?",
            (conversation_id,),
        ).fetchone()
        if convo is None:
            return None
        rows = conn.execute(
            "SELECT role, text, tools, created_at FROM messages "
            "WHERE conversation_id = ? ORDER BY id",
            (conversation_id,),
        ).fetchall()
    messages = [{**dict(row), "tools": json.loads(row["tools"])} for row in rows]
    return {**dict(convo), "messages": messages}


def delete_conversation(conversation_id: str) -> bool:
    """Delete a conversation and (via cascade) its messages. True if it existed."""
    with closing(_connect()) as conn, conn:
        cursor = conn.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
    return cursor.rowcount > 0
