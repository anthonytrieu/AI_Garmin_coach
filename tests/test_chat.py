import asyncio
import json

import httpx

from garmin_coach.web import chat, store


def test_tools_reject_unknown_extra_and_out_of_bounds(monkeypatch):
    called = []
    monkeypatch.setattr(chat.server, "get_recent_activities", lambda limit=5: called.append(limit))
    assert "not allowed" in asyncio.run(chat.execute_tool("Bash", "{}"))
    # Use real typed function for schema validation, no live calls.
    monkeypatch.undo()
    assert "Invalid" in asyncio.run(chat.execute_tool("get_recent_activities", '{"limit":999}'))
    assert "Invalid" in asyncio.run(chat.execute_tool("get_recent_activities", '{"shell":"cat"}'))
    assert called == []


def test_groq_stream_tool_history_and_quota(monkeypatch, tmp_path):
    monkeypatch.setenv("GARMIN_COACH_DATA", str(tmp_path))
    monkeypatch.setenv("GROQ_API_KEY", "test-not-a-real-key")
    chat._cache.clear()
    requests = []

    def fake_recent(limit: int = 5):
        return [{"activity_id": 1, "distance_km": 25}]

    monkeypatch.setattr(chat.server, "get_recent_activities", fake_recent)

    def response(request):
        body = json.loads(request.content)
        requests.append(body)
        if len(requests) == 1:
            delta = {
                "tool_calls": [
                    {
                        "index": 0,
                        "id": "t1",
                        "function": {"name": "get_recent_activities", "arguments": '{"limit":1}'},
                    }
                ]
            }
        elif len(requests) == 2:
            assert body["messages"][-1]["role"] == "tool"
            delta = {"content": "Your ride covered 25 km."}
        else:
            assert any(m.get("content") == "Your ride covered 25 km." for m in body["messages"])
            return httpx.Response(429)
        return httpx.Response(
            200,
            text="data: " + json.dumps({"choices": [{"delta": delta}]}) + "\n\ndata: [DONE]\n\n",
        )

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        chat.httpx,
        "AsyncClient",
        lambda **kw: real_client(transport=httpx.MockTransport(response), **kw),
    )

    async def run():
        first = [
            x async for x in chat._events(chat.ChatRequest(message="My ride?", session_id="test"))
        ]
        assert any("25 km" in x for x in first)
        second = [
            x async for x in chat._events(chat.ChatRequest(message="And today?", session_id="test"))
        ]
        assert any("rate limit" in x for x in second)

    asyncio.run(run())
    saved = store.get_conversation("test")
    assert saved is not None and len(saved["messages"]) == 4
    assert saved["messages"][1]["tools"] == ["Recent activities"]


def test_quota_errors_distinguish_size_daily_and_retry():
    async def check():
        message, retry = await chat._quota_error(httpx.Response(
            429, json={"error": {"message": "Request too large for account private-id on TPM"}},
            headers={"retry-after": "1"},
        ))
        assert "waiting will not fix" in message and retry is None
        assert "private-id" not in message
        message, retry = await chat._quota_error(httpx.Response(
            429, json={"error": {"message": "Rate limit reached on tokens per day (TPD)"}},
            headers={"retry-after": "86400"},
        ))
        assert "daily quota" in message and retry is None
        message, retry = await chat._quota_error(httpx.Response(
            429, headers={"retry-after": "2.5"}, text="not json",
        ))
        assert "3 seconds" in message and retry == 2.5
        for invalid in ["nan", "inf", "-1", "unknown"]:
            _, retry = await chat._quota_error(httpx.Response(
                429, headers={"retry-after": invalid},
            ))
            assert retry is None
    asyncio.run(check())


def test_transient_quota_retries_once_without_duplicate_history(monkeypatch, tmp_path):
    monkeypatch.setenv("GARMIN_COACH_DATA", str(tmp_path))
    monkeypatch.setenv("GROQ_API_KEY", "test")
    calls = []
    sleeps = []

    def respond(request):
        calls.append(json.loads(request.content))
        return httpx.Response(429, headers={"retry-after": "2"})

    async def sleep(seconds):
        sleeps.append(seconds)

    real_client = httpx.AsyncClient
    monkeypatch.setattr(chat.asyncio, "sleep", sleep)
    monkeypatch.setattr(chat.httpx, "AsyncClient", lambda **kw: real_client(
        transport=httpx.MockTransport(respond), **kw,
    ))

    async def run():
        return [x async for x in chat._events(chat.ChatRequest(message="Hi", session_id="retry"))]

    events = asyncio.run(run())
    assert len(calls) == 2 and calls[0] == calls[1]
    assert sleeps == [2]
    assert any("2 seconds" in event for event in events)
    assert len(store.get_conversation("retry")["messages"]) == 2


def test_oversized_context_stops_before_provider_call(monkeypatch, tmp_path):
    monkeypatch.setenv("GARMIN_COACH_DATA", str(tmp_path))
    monkeypatch.setenv("GROQ_API_KEY", "test")
    monkeypatch.setattr(chat, "_system_prompt", lambda: "x" * 21000)

    def unexpected_request(request):
        raise AssertionError("Oversized request reached the provider")

    real_client = httpx.AsyncClient
    monkeypatch.setattr(chat.httpx, "AsyncClient", lambda **kw: real_client(
        transport=httpx.MockTransport(unexpected_request), **kw,
    ))

    async def run():
        return [x async for x in chat._events(chat.ChatRequest(message="Hi"))]

    assert any("fewer rides" in event for event in asyncio.run(run()))
