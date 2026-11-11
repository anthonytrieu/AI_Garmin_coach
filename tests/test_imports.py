import json
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from garmin_coach.web import tracking
from garmin_coach.web.app import create_app


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("GARMIN_COACH_ENV", "local")
    monkeypatch.setenv("GARMIN_COACH_DATA", str(tmp_path))
    monkeypatch.delenv("GARMIN_COACH_TEMPLATES", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    return TestClient(create_app())


def preview(client, text, mode="notes"):
    return client.post(
        "/api/tracking-import/preview", json={"text": text, "mode": mode, "year": 2026}
    )


def test_csv_blank_header_notes_and_year(client):
    result = preview(
        client, ",,,\nWeight,,,\n180,October 8,Example note,extra\n179.5,Nov 9,,\n", "csv"
    )
    assert result.status_code == 200
    items = result.json()["items"]
    assert len(items) == 2
    assert items[0]["data"] == {"date": "2026-10-08", "pounds": 180, "note": "Example note · extra"}
    assert client.get("/api/tracking").json()["records"] == []
    assert preview(client, "unknown,October 9\n181,February 30", "csv").json()["unresolved"]


def test_notes_mixed_loads_future_suggestions_and_undated_blocks(client):
    text = """Arms
Synthetic press 20 for 10 8

Upper
Synthetic row 40 for 10, then 45 for 7

Oct 22
Arms B
Synthetic curl 15 for 10, 8 (do 20 next time)
Synthetic extension 30 (forgot)
Synthetic raise 10 for 71
Synthetic pull 40 for 8.5, 6?
"""
    result = preview(client, text).json()["items"]
    assert len(result) == 3
    assert result[0]["data"]["date"] is None
    assert result[1]["data"]["date"] is None
    loads = [s["weight"] for s in result[1]["data"]["exercises"][0]["sets"]]
    assert loads == [40, 45]
    last = result[2]["data"]
    assert last["date"] == "2026-10-22"
    assert last["rotationPosition"] is None
    curl = last["exercises"][0]
    assert [s["weight"] for s in curl["sets"]] == [15, 15]
    assert all(
        not s["done"] and s["reps"] is None for e in last["exercises"][1:] for s in e["sets"]
    )
    assert "do 20 next time" in curl["notes"]


def test_historical_excluded_movements_are_retained(client):
    result = preview(
        client, "Oct 23\nLegs\nBulgarian split squat 20 for 8\nSingle leg squat 10 for 9"
    ).json()
    names = [e["name"] for e in result["items"][0]["data"]["exercises"]]
    assert names == ["Bulgarian split squat", "Single leg squat"]


def test_batch_atomicity_duplicate_retry_and_live_rotation(client):
    items = preview(client, "Oct 22\nUpper A\nSynthetic press 20 for 10 8").json()["items"]
    items += preview(client, "180,Oct 22,example", "csv").json()["items"]
    body = {"mutationId": str(uuid4()), "items": items}
    first = client.post("/api/tracking-import/commit", json=body)
    assert first.status_code == 200
    assert len(first.json()["saved"]) == 2
    assert client.post("/api/tracking-import/commit", json=body).json() == first.json()
    body["mutationId"] = str(uuid4())
    assert len(client.post("/api/tracking-import/commit", json=body).json()["skipped"]) == 2
    assert client.get("/api/tracking").json()["position"] == 0
    # Every record validates before the transaction: invalid later data must not partly save.
    fresh = preview(client, "178,Oct 24", "csv").json()["items"]
    bad = {"kind": "weight", "data": {"date": None, "pounds": 177}, "source": "", "warnings": []}
    result = client.post(
        "/api/tracking-import/commit", json={"mutationId": str(uuid4()), "items": fresh + [bad]}
    )
    assert result.status_code == 422
    assert not any(r["id"] == "2026-10-24" for r in client.get("/api/tracking").json()["records"])
    conflict = preview(client, "175,Oct 22,changed value", "csv").json()["items"]
    assert (
        client.post(
            "/api/tracking-import/commit", json={"mutationId": str(uuid4()), "items": conflict}
        ).json()["saved"]
        == []
    )


def test_ai_error_and_mocked_output_no_automatic_write(client, monkeypatch):
    assert preview(client, "notes", "ai").status_code == 503
    monkeypatch.setenv("GROQ_API_KEY", "synthetic-test-key")

    async def post(self, url, **kwargs):
        assert "synthetic-test-key" in kwargs["headers"]["Authorization"]
        payload = {
            "items": [
                {
                    "kind": "weight",
                    "data": {"date": "2026-10-10", "pounds": 180},
                    "source": "October 10: 180 lb",
                    "warnings": [],
                }
            ],
            "unresolved": [],
        }
        return httpx.Response(
            200, json={"choices": [{"message": {"content": json.dumps(payload)}}]}
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", post)
    assert preview(client, "October 10: 180 lb", "ai").json()["items"][0]["data"]["pounds"] == 180
    assert tracking.read_all()["records"] == []

    async def quota(self, url, **kwargs):
        return httpx.Response(429)

    monkeypatch.setattr(httpx.AsyncClient, "post", quota)
    assert preview(client, "notes", "ai").status_code == 429


def test_schedule_does_not_advance_and_history_survives_removal(client):
    slot = {"date": "2026-10-22", "templateId": "upper-a", "name": "Upper A", "rotationPosition": 0}
    response = client.put(
        "/api/tracking/schedule/slot",
        json={"revision": 0, "mutationId": str(uuid4()), "data": slot},
    )
    assert response.json()["position"] == 0
    assert (
        client.put(
            "/api/tracking/schedule/slot",
            json={"revision": 1, "mutationId": str(uuid4()), "data": None},
        ).json()["position"]
        == 0
    )


def test_import_auth(client, monkeypatch):
    monkeypatch.delenv("GARMIN_COACH_ENV")
    monkeypatch.setenv("COACH_ORIGIN", "https://owner.example")
    secured = TestClient(create_app(), base_url="https://owner.example")
    assert (
        secured.post(
            "/api/tracking-import/preview",
            headers={"Origin": "https://owner.example"},
            json={"text": "example", "mode": "notes", "year": 2026},
        ).status_code
        == 401
    )
