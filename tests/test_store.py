from pathlib import Path

import pytest

from garmin_coach.web import store


@pytest.fixture(autouse=True)
def isolated_db(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    monkeypatch.setenv("GARMIN_COACH_DATA", str(tmp_path))
    yield


def test_round_trip_conversation_and_messages() -> None:
    store.ensure_conversation("abc", "How was my last ride?")
    store.append_message("abc", "user", "How was my last ride?")
    store.append_message("abc", "assistant", "Strong ride!", ["Looking up recent rides"])

    conversations = store.list_conversations()
    assert len(conversations) == 1
    assert conversations[0]["id"] == "abc"
    assert conversations[0]["title"] == "How was my last ride?"
    assert conversations[0]["message_count"] == 2

    conversation = store.get_conversation("abc")
    assert conversation is not None
    roles = [m["role"] for m in conversation["messages"]]
    assert roles == ["user", "assistant"]
    assert conversation["messages"][1]["tools"] == ["Looking up recent rides"]


def test_title_is_normalized_and_truncated() -> None:
    store.ensure_conversation("t", "  a  " + "very " * 30 + "long question  ")
    title = store.list_conversations()[0]["title"]
    assert len(title) <= store.TITLE_MAX
    assert title.endswith("…")
    assert "  " not in title


def test_ensure_is_idempotent_and_keeps_first_title() -> None:
    store.ensure_conversation("abc", "first question")
    store.ensure_conversation("abc", "second question")
    conversations = store.list_conversations()
    assert len(conversations) == 1
    assert conversations[0]["title"] == "first question"


def test_sdk_session_id_round_trip() -> None:
    store.ensure_conversation("abc", "hi")
    assert store.get_sdk_session_id("abc") is None
    store.set_sdk_session_id("abc", "sdk-123")
    assert store.get_sdk_session_id("abc") == "sdk-123"
    assert store.get_sdk_session_id("unknown") is None


def test_delete_cascades_to_messages() -> None:
    store.ensure_conversation("abc", "hi")
    store.append_message("abc", "user", "hi")
    assert store.delete_conversation("abc") is True
    assert store.get_conversation("abc") is None
    assert store.list_conversations() == []
    assert store.delete_conversation("abc") is False  # already gone


def test_most_recently_active_conversation_listed_first() -> None:
    store.ensure_conversation("old", "first chat")
    store.ensure_conversation("new", "second chat")
    assert [c["id"] for c in store.list_conversations()] == ["new", "old"]

    # activity on the older conversation bumps it back to the top
    store.append_message("old", "user", "follow-up")
    assert [c["id"] for c in store.list_conversations()][0] == "old"


def test_get_unknown_conversation_returns_none() -> None:
    assert store.get_conversation("nope") is None
