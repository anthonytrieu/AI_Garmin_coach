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
