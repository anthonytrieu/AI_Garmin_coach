import httpx
import pytest
from fastapi.testclient import TestClient

from garmin_coach.web import nutrition
from garmin_coach.web.app import create_app


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("GARMIN_COACH_ENV", "local")
    monkeypatch.setenv("GARMIN_COACH_DATA", str(tmp_path))
    nutrition._cache.clear()
    nutrition._estimate_times.clear()
    monkeypatch.setattr(nutrition, "_last_search", 0)
    return TestClient(create_app())


def test_normalize_food_without_inventing_serving_or_protein():
    item = nutrition.product_match(
        {"code": "12345678", "product_name": "Synthetic cereal", "nutriments":
         {"energy-kcal_100g": "350"}}
    )
    assert item and item["calories"] == 350 and item["protein"] is None
    assert "100 g" in item["portion"]
    assert item["url"] == "https://world.openfoodfacts.org/product/12345678"
    assert nutrition.product_match({"code": "https://invalid.test", "product_name": "Bad"}) is None
    assert nutrition.product_match(
        {"code": "12345678", "product_name": "Bad", "nutriments": {"energy-kcal_100g": "NaN"}}
    ) is None


def test_search_is_bounded_cached_and_read_only(client, monkeypatch):
    calls = []

    async def get(self, url, **kwargs):
        calls.append((url, kwargs))
        return httpx.Response(200, request=httpx.Request("GET", url), json={"hits": [
            {"code": "12345678", "product_name": "Synthetic cereal", "brands": "Example",
             "nutriments": {"energy-kcal_100g": 350, "proteins_100g": 10}},
            {"code": "invalid", "product_name": "Skip"},
        ]})

    monkeypatch.setattr(httpx.AsyncClient, "get", get)
    result = client.get("/api/nutrition/search", params={"q": "Synthetic cereal"})
    assert result.status_code == 200
    assert len(result.json()["items"]) == 1
    assert client.get("/api/nutrition/search?q=Synthetic%20cereal").json() == result.json()
    assert len(calls) == 1
    assert calls[0][0] == "https://search.openfoodfacts.org/search"
    assert calls[0][1]["params"]["q"] == 'synthetic cereal countries_tags:"en:canada"'
    assert "GarminCoach" in calls[0][1]["headers"]["User-Agent"]
    assert client.get("/api/nutrition/search?q=Another").status_code == 429
    assert client.get("/api/tracking").json()["records"] == []


def test_upstream_error_is_actionable_and_does_not_leak(client, monkeypatch):
    async def get(self, url, **kwargs):
        raise httpx.ConnectError("private upstream debug detail")

    monkeypatch.setattr(httpx.AsyncClient, "get", get)
    response = client.get("/api/nutrition/search?q=Synthetic")
    assert response.status_code == 503
    assert "package label" in response.json()["detail"]
    assert "private upstream" not in response.text
    assert client.get("/api/nutrition/search?q=x").status_code == 422
    assert client.get("/api/nutrition/search?q=!!!").status_code == 422


def test_nutrition_search_requires_owner_auth(monkeypatch, tmp_path):
    monkeypatch.setenv("GARMIN_COACH_ENV", "production")
    monkeypatch.setenv("GARMIN_COACH_DATA", str(tmp_path))
    monkeypatch.setenv("COACH_ORIGIN", "https://owner.example")
    client = TestClient(create_app())
    assert client.get("/api/nutrition/search?q=Synthetic").status_code == 401
    assert client.post("/api/nutrition/estimate", json={"description": "food"},
                       headers={"Origin": "https://owner.example"}).status_code == 401


def test_restaurant_estimate_uses_full_meal_and_never_writes(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "synthetic-test-key")
    calls = []

    async def post(self, url, **kwargs):
        calls.append(kwargs["json"])
        return httpx.Response(200, request=httpx.Request("POST", url), json={"choices": [
            {"message": {"content": '{"name":"2 drumsticks + 2 thighs", "calories":1093, '
             '"protein":63.7, "assumptions":"Original fried chicken; approximate portions"}'}}
        ]})

    monkeypatch.setattr(httpx.AsyncClient, "post", post)
    text = "I ate 2 drumsticks and 2 thighs from Churchs Chicken"
    response = client.post("/api/nutrition/estimate", json={"description": text})
    assert response.status_code == 200
    item = response.json()["item"]
    assert item["calories"] == 1090 and item["protein"] == 64
    assert item["source"].startswith("AI estimate")
    assert calls[0]["messages"][1]["content"] == text
    assert calls[0]["tools"] == [{"type": "browser_search"}]
    assert client.get("/api/tracking").json()["records"] == []
    assert client.post("/api/nutrition/estimate", json={"description": text}).status_code == 429


def test_estimate_falls_back_without_fabricating_search(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "synthetic-test-key")
    calls = []

    async def post(self, url, **kwargs):
        body = kwargs["json"]
        calls.append("tools" in body)
        if "tools" in body:
            return httpx.Response(400, request=httpx.Request("POST", url))
        assert "Web search is unavailable" in body["messages"][0]["content"]
        return httpx.Response(200, request=httpx.Request("POST", url), json={"choices": [
            {"message": {"content": '{"name":"meal", "calories":500, '
             '"protein":30, "assumptions":"Search unavailable; approximate portion"}'}}
        ]})

    monkeypatch.setattr(httpx.AsyncClient, "post", post)
    assert client.post("/api/nutrition/estimate", json={"description": "chicken"}).status_code == 200
    assert calls == [True, False]


def test_estimate_rejects_bad_photos_and_invalid_macros(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "synthetic-test-key")
    response = client.post("/api/nutrition/estimate", json={
        "description": "food", "image": "https://private.invalid/image.jpg"})
    assert response.status_code == 422

    async def post(self, url, **kwargs):
        return httpx.Response(200, request=httpx.Request("POST", url), json={"choices": [
            {"message": {"content": '{"name":"meal", "calories":-20, '
             '"protein":30, "assumptions":"bad"}'}}
        ]})

    monkeypatch.setattr(httpx.AsyncClient, "post", post)
    response = client.post("/api/nutrition/estimate", json={"description": "food"})
    assert response.status_code == 503
    assert "synthetic-test-key" not in response.text


def test_photo_estimate_uses_vision_without_search(client, monkeypatch):
    import base64

    monkeypatch.setenv("GROQ_API_KEY", "synthetic-test-key")

    async def post(self, url, **kwargs):
        body = kwargs["json"]
        assert body["model"] == "qwen/qwen3.8-27b"
        assert "tools" not in body
        assert body["messages"][1]["content"][1]["type"] == "image_url"
        return httpx.Response(200, request=httpx.Request("POST", url), json={"choices": [
            {"message": {"content": '{"name":"meal", "calories":500, '
             '"protein":30, "assumptions":"Approximate portion from photo"}'}}
        ]})

    monkeypatch.setattr(httpx.AsyncClient, "post", post)
    image = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xffsynthetic").decode()
    assert client.post("/api/nutrition/estimate", json={"description": "food", "image": image}).status_code == 200
