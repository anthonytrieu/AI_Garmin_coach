"""Authenticated, read-only packaged-food search; no AI estimates or automatic writes."""

from __future__ import annotations

import math
import re
import time
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/nutrition")
_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}
_last_search = 0.0


def _number(value: Any, maximum: float) -> float | None:
    try:
        number = float(value)
    except (ValueError, TypeError):
        return None
    return number if math.isfinite(number) and 0 <= number <= maximum else None


def product_match(product: dict[str, Any]) -> dict[str, Any] | None:
    code = str(product.get("code", ""))
    name = str(product.get("product_name", "")).strip()
    nutrients = product.get("nutriments")
    if not re.fullmatch(r"\d{8,14}", code) or not name or not isinstance(nutrients, dict):
        return None
    # Always normalize to 100 g/ml. Product serving strings are not reliably structured.
    calories = _number(nutrients.get("energy-kcal_100g"), 1000)
    if calories is None:
        return None
    protein = _number(nutrients.get("proteins_100g"), 100)
    brands = product.get("brands", "")
    brand = (
        ", ".join(str(b) for b in brands[:3])
        if isinstance(brands, list)
        else str(brands).strip()
    )
    return {
        "id": f"off-{code}",
        "name": (f"{name} · {brand}" if brand else name)[:120],
        "calories": calories,
        "protein": protein,
        "portion": "100 g / 100 ml — check the product label",
        "source": "Open Food Facts · community-contributed · Canada search",
        "url": f"https://world.openfoodfacts.org/product/{code}",
    }


@router.get("/search")
async def search(q: str = Query(min_length=2, max_length=120)) -> dict[str, Any]:
    global _last_search
    query = " ".join(q.split())
    if len(query) < 2:
        raise HTTPException(422, "Enter at least two characters")
    words = " ".join(re.findall(r"[^\W_]+", query)).casefold()
    if not words:
        raise HTTPException(422, "Enter a food name")
    key = query.casefold()
    cached = _cache.get(key)
    now = time.monotonic()
    if cached and cached[0] > now:
        return {"items": cached[1]}
    # Single-owner app: stay below the upstream search limit, including failed requests.
    if now - _last_search < 7:
        raise HTTPException(429, "Please wait a few seconds before searching again")
    _last_search = now
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
            response = await client.get(
                "https://search.openfoodfacts.org/search",
                params={
                    # Strip query syntax and lowercase operators before adding our filter.
                    "q": words + ' countries_tags:"en:canada"',
                    "page_size": 8,
                    "fields": "code,product_name,brands,nutriments",
                },
                headers={
                    "User-Agent": "GarminCoach/1.0 (https://github.com/anthonytrieu/AI_Garmin_coach)"
                },
            )
            response.raise_for_status()
            payload = response.json()
            if payload.get("errors") or payload.get("timed_out"):
                raise ValueError("Food search incomplete")
            products = payload.get("hits", [])
            if not isinstance(products, list):
                raise ValueError("Invalid food search")
            items = [
                match
                for p in products[:8]
                if isinstance(p, dict) and (match := product_match(p)) is not None
            ]
    except (httpx.HTTPError, ValueError, AttributeError):
        raise HTTPException(
            503, "Food search unavailable. Use the package label or a saved meal."
        ) from None
    if len(_cache) >= 64:
        _cache.clear()
    _cache[key] = (now + 3600, items)
    return {"items": items}
