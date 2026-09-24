"""Protected Planet API v4 retrieval and validated real-response caching."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import urlopen

API_URL = "https://api.protectedplanet.net/v4/protected_areas/search"


def _normalise(item: dict[str, Any]) -> dict[str, Any] | None:
    feature = item.get("geojson")
    if not isinstance(feature, dict) or not isinstance(feature.get("geometry"), dict):
        return None
    designation = item.get("designation") or {}
    governance = item.get("governance") or {}
    no_take = item.get("no_take_status") or {}
    legal_status = item.get("legal_status") or {}
    return {
        "type": "Feature",
        "geometry": feature["geometry"],
        "properties": {
            "site_id": item.get("site_id"), "site_pid": item.get("site_pid"),
            "site_type": item.get("site_type"),
            "name": item.get("name_english") or item.get("name"),
            "designation": designation.get("name") if isinstance(designation, dict) else designation,
            "jurisdiction": designation.get("jurisdiction") if isinstance(designation, dict) else None,
            "governance": governance.get("name") if isinstance(governance, dict) else governance,
            "no_take_status": no_take.get("name") if isinstance(no_take, dict) else no_take,
            "legal_status": legal_status.get("name") if isinstance(legal_status, dict) else legal_status,
        },
    }


def _valid_cache(payload: Any) -> bool:
    return bool(
        isinstance(payload, dict)
        and payload.get("provider") == "Protected Planet / UNEP-WCMC"
        and payload.get("api_version") == "v4"
        and payload.get("validation_status") == "VALIDATED_REAL_RESPONSE"
        and payload.get("complete") is True
        and isinstance(payload.get("features"), list)
        and payload["features"]
        and all(
            isinstance(feature, dict)
            and isinstance(feature.get("geometry"), dict)
            and isinstance(feature.get("properties"), dict)
            for feature in payload["features"]
        )
        and all(payload.get(field) for field in ("retrieved_at", "geometry_source", "evidence_ref"))
    )


def load_protected_areas(token: str | None, cache_file: Path) -> dict[str, Any] | None:
    """Fetch all Indian marine records when authorised, else use only a validated cache."""
    if token:
        features: list[dict[str, Any]] = []
        page = 1
        try:
            while True:
                query = urlencode({
                    "country": "IND", "marine": "true", "with_geometry": "true",
                    "page": page, "per_page": 50, "token": token,
                })
                with urlopen(f"{API_URL}?{query}", timeout=30) as response:  # noqa: S310
                    if response.status != 200:
                        raise RuntimeError(f"Protected Planet returned HTTP {response.status}")
                    body = json.load(response)
                records = body.get("protected_areas") or body.get("results") or []
                if not isinstance(records, list):
                    raise ValueError("Protected Planet response has no protected-area list")
                features.extend(feature for item in records if (feature := _normalise(item)))
                metadata = body.get("meta") or {}
                pagination = body.get("pagination") or metadata.get("pagination") or {}
                if not pagination and len(records) == 50:
                    raise ValueError("Protected Planet pagination metadata is missing")
                total_pages = int(pagination.get("total_pages") or pagination.get("pages") or page)
                if page >= total_pages:
                    break
                page += 1
            if not features:
                raise ValueError("Protected Planet returned no usable marine geometry")
            retrieved_at = datetime.now(UTC).isoformat()
            payload = {
                "provider": "Protected Planet / UNEP-WCMC", "api_version": "v4",
                "endpoint": API_URL, "query_scope": "country=IND;marine=true;with_geometry=true",
                "retrieved_at": retrieved_at, "geometry_source": "Protected Planet API v4 geojson",
                "evidence_ref": f"protected-planet:v4:IND-marine:{retrieved_at}",
                "validation_status": "VALIDATED_REAL_RESPONSE", "complete": True,
                "coverage_complete": False,
                "coverage_note": "Public India records are restricted; absence of an API match cannot establish complete ecological clearance.",
                "features": features,
            }
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            cache_file.write_text(json.dumps(payload), encoding="utf-8")
            return payload
        except (
            AttributeError,
            OSError,
            TimeoutError,
            TypeError,
            ValueError,
            RuntimeError,
            json.JSONDecodeError,
        ):
            pass
    if cache_file.exists():
        try:
            cached = json.loads(cache_file.read_text(encoding="utf-8"))
            return cached if _valid_cache(cached) else None
        except (OSError, json.JSONDecodeError):
            return None
    return None
