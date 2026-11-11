import json
import sqlite3
from contextlib import closing
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from garmin_coach.web import access, store, tracking
from garmin_coach.web.app import create_app


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("GARMIN_COACH_ENV", "local")
    monkeypatch.setenv("GARMIN_COACH_DATA", str(tmp_path))
    monkeypatch.delenv("GARMIN_COACH_TEMPLATES", raising=False)
    return TestClient(create_app())


def workout(template="upper-a", position=0, status="draft"):
    return {
        "name": "Synthetic workout",
        "templateId": template,
        "rotationPosition": position,
        "date": "2026-06-17",
        "status": status,
        "exercises": [
            {
                "id": "press",
                "name": "Synthetic press",
                "sets": [
                    {"id": "one", "weight": 20, "reps": 12, "done": True},
                    {"id": "two", "weight": 25, "reps": 8, "done": False},
                ],
            }
        ],
    }


def put(client, kind, rid, data, revision=0, mutation=None):
    return client.put(
        f"/api/tracking/{kind}/{rid}",
        json={
            "revision": revision,
            "mutationId": mutation or str(uuid4()),
            "data": data,
        },
    )


def test_tracking_idempotency_and_revision_conflict(client):
    mutation = str(uuid4())
    first = put(client, "workout", "session", workout(), mutation=mutation)
    assert first.status_code == 200
    assert put(client, "workout", "session", workout(), mutation=mutation).json() == first.json()
    assert put(client, "workout", "session", workout(), revision=0).status_code == 409
    assert (
        put(
            client, "workout", "session", workout(status="completed"), revision=1, mutation=mutation
        ).status_code
        == 409
    )
    assert len(client.get("/api/tracking").json()["records"]) == 1


def test_rotation_legs_positions_and_custom_sessions(client):
    for index, template in enumerate(tracking.ROTATION):
        mutation = str(uuid4())
        result = put(
            client, "workout", str(index), workout(template, index, "completed"), mutation=mutation
        )
        assert result.status_code == 200
        assert result.json()["position"] == (index + 1) % 6
        assert (
            put(
                client,
                "workout",
                str(index),
                workout(template, index, "completed"),
                mutation=mutation,
            ).json()["position"]
            == (index + 1) % 6
        )
    assert (
        put(client, "workout", "custom", workout(None, None, "completed")).json()["position"] == 0
    )
    assert (
        put(client, "workout", "outoforder", workout("legs", None, "completed")).json()["position"]
        == 0
    )


def test_one_draft_and_finish_once(client):
    assert put(client, "workout", "one", workout()).status_code == 200
    assert put(client, "workout", "two", workout()).status_code == 409
    result = put(client, "workout", "one", workout(status="completed"), 1)
    assert result.json()["position"] == 1
    assert put(client, "workout", "one", workout(status="completed"), 2).json()["position"] == 1
    assert put(client, "workout", "one", workout(), 3).status_code == 409


def test_validation_and_daily_uniqueness(client):
    meal = {
        "name": "Synthetic meal",
        "date": "2026-06-17",
        "calories": 640,
        "protein": None,
        "servings": 0.5,
    }
    saved = put(client, "meal", "meal", meal)
    assert saved.status_code == 200
    assert saved.json()["record"]["data"]["protein"] is None
    assert put(client, "meal", "invalid", {**meal, "servings": 0}).status_code == 422
    assert put(client, "ride", "ride", {"date": "2026-02-30", "minutes": 40}).status_code == 422
    weight = {"date": "2026-06-17", "pounds": 175.5}
    assert put(client, "weight", "random", weight).status_code == 422
    assert put(client, "weight", "2026-06-17", weight).status_code == 200
    assert put(client, "weight", "2026-06-17", weight).status_code == 409
    assert put(client, "weight", "2026-06-17", {**weight, "pounds": 175}, 1).status_code == 200
    assert put(client, "weight", "2026-06-17", None, 2).status_code == 200
    assert put(client, "weight", "2026-06-17", weight, 3).status_code == 200
    invalid = workout(status="completed")
    invalid["exercises"][0]["sets"][0]["weight"] = None
    assert put(client, "workout", "invalid", invalid).status_code == 422


def test_backup_restore_and_restart_preserves_chat(client, tmp_path, monkeypatch):
    store.ensure_conversation("chat", "Synthetic chat")
    store.append_message("chat", "user", "Keep this history")
    put(client, "ride", "ride", {"date": "2026-06-17", "minutes": 40})
    assert (tmp_path / "tracking-before-v1.db").exists()
    with closing(sqlite3.connect(tmp_path / "tracking-before-v1.db")) as db:
        assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    restored_dir = tmp_path / "restored"
    restored_dir.mkdir()
    backup = restored_dir / "tracking.db"
    with closing(sqlite3.connect(tmp_path / "tracking.db")) as source:
        with closing(sqlite3.connect(backup)) as dest:
            source.backup(dest)
    with closing(sqlite3.connect(backup)) as restored:
        assert restored.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        assert (
            json.loads(restored.execute("SELECT data FROM records").fetchone()[0])["minutes"] == 40
        )
    assert TestClient(create_app()).get("/api/tracking").json()["records"][0]["id"] == "ride"
    assert store.get_conversation("chat")["messages"][0]["text"] == "Keep this history"
    assert client.get("/api/tracking/export").json()["schemaVersion"] == 1
    monkeypatch.setenv("GARMIN_COACH_DATA", str(restored_dir))
    restored_app = TestClient(create_app())
    assert restored_app.get("/api/tracking").json()["records"][0]["data"]["minutes"] == 40


def test_private_seed_can_be_added_after_database_creation(client, monkeypatch, tmp_path):
    assert client.get("/api/tracking").json()["records"] == []
    seed = tmp_path / "templates.json"
    seed.write_text(
        json.dumps(
            [
                {
                    "id": "synthetic",
                    "data": {
                        "name": "Synthetic",
                        "group": "Custom",
                        "exercises": workout()["exercises"],
                    },
                }
            ]
        )
    )
    monkeypatch.setenv("GARMIN_COACH_TEMPLATES", str(seed))
    first = client.get("/api/tracking").json()
    assert len(first["records"]) == 1
    assert client.get("/api/tracking").json() == first


def test_tracking_auth_and_origin(monkeypatch, tmp_path):
    monkeypatch.delenv("GARMIN_COACH_ENV", raising=False)
    monkeypatch.setenv("GARMIN_COACH_DATA", str(tmp_path))
    monkeypatch.setenv("COACH_ORIGIN", "https://owner.example")
    with TestClient(create_app(), base_url="https://owner.example") as c:
        assert c.get("/api/tracking").status_code == 401
        assert c.get("/api/tracking/export").status_code == 401
        c.post(
            "/api/auth/setup",
            headers={"Origin": "https://owner.example"},
            json={"token": access.issue_setup_link()},
        )
        assert c.get("/api/tracking").status_code == 200
        assert put(c, "ride", "x", {"date": "2026-06-17", "minutes": 40}).status_code == 403


def test_manual_rotation_override_does_not_change_history(client):
    put(client, "workout", "completed", workout(status="completed"))
    assert put(client, "rotation", "current", {"position": 5}).json()["position"] == 5
    records = client.get("/api/tracking").json()["records"]
    assert next(r for r in records if r["id"] == "completed")["data"]["rotationPosition"] == 0
    assert put(client, "rotation", "current", {"position": 6}, 1).status_code == 422
    assert put(client, "rotation", "current", None, 1).status_code == 422
