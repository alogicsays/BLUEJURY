from datetime import UTC, datetime
from pathlib import Path

import pytest

from bluejury.adapters.protected_planet import load_protected_areas
from bluejury.adapters.protected_planet_local import load_india_protected_areas
from bluejury.schemas.mvp import AnalyzeRequest, MvpBoat, StartPoint
from bluejury.services.mvp import analyze, negotiate_score, negotiation_confidence, scorecards


def request(fuel: float = 100) -> AnalyzeRequest:
    return AnalyzeRequest(
        start=StartPoint(latitude=12.9, longitude=74.8),
        boat=MvpBoat(vessel_class="small_scale", fuel_available_l=fuel, burn_rate_l_per_km=0.35, reserve_fraction=0.2),
        departure_at=datetime.now(UTC),
    )


def candidate() -> dict:
    return {
        "zone_id": "ZONE-A", "catch_suitability": 84.4, "chl_percentile": 91,
        "centroid": {"latitude": 12.05, "longitude": 74.05},
        "geometry_role": "DISCOVERY_FOOTPRINT",
        "evidence_refs": ["chl", "sst"],
        "geometry": {"type": "Polygon", "coordinates": [[[74.0, 12.0], [74.1, 12.0], [74.1, 12.1], [74.0, 12.1], [74.0, 12.0]]]},
        "route": {"distance_km": 50.0, "geometry": {"type": "LineString", "coordinates": [[74.8, 12.9], [74.05, 12.05]]}},
    }


def marine() -> dict:
    return {"wave_time": "2026-09-04T00:00:00Z", "wave": {"lat": [12.0, 12.9], "lon": [74.0, 74.8], "height": [[1.0, 1.0], [1.0, 1.0]]}}


def test_existing_catch_safety_fuel_results_are_unchanged_and_unavailable_is_not_clear() -> None:
    cards = scorecards(candidate(), request(), marine(), False, None, None)
    catch, safety, fuel, ecology, border = cards
    assert (catch["score"], catch["veto"], catch["reason_codes"]) == (84, False, ["RELATIVE_CHL_SST_SUITABILITY"])
    assert (safety["score"], safety["veto"], safety["reason_codes"]) == (75, False, ["WAVE_WITHIN_MVP_POLICY"])
    assert (fuel["score"], fuel["veto"], fuel["reason_codes"]) == (79, False, ["FUEL_RESERVE_MET"])
    assert ecology["confidence"] == border["confidence"] == 0
    assert ecology["reason_codes"] == border["reason_codes"] == ["DATA_UNAVAILABLE"]


def test_existing_low_fuel_veto_survives() -> None:
    cards = scorecards(candidate(), request(20), marine(), False, None, None)
    assert cards[2]["veto"] is True
    assert cards[2]["reason_codes"] == ["FUEL_INSUFFICIENT"]


def test_insufficient_ecology_is_excluded_and_remaining_weights_are_renormalized() -> None:
    cards = scorecards(candidate(), request(), marine(), False, None, None)
    weights = request().priorities
    score, excluded = negotiate_score(cards, weights)
    eligible = [card for card in cards if card["agent"] != "ecology"]
    expected = sum(weights[card["agent"]] * card["score"] for card in eligible) / sum(
        weights[card["agent"]] for card in eligible
    )
    assert score == pytest.approx(expected)
    assert excluded == ["ecology"]
    expected_confidence = sum(weights[card["agent"]] * card["confidence"] for card in eligible) / sum(
        weights[card["agent"]] for card in eligible
    )
    assert negotiation_confidence(cards, weights) == pytest.approx(expected_confidence)
    changed = [{**card, "score": 75} if card["agent"] == "ecology" else card for card in cards]
    assert negotiate_score(changed, weights)[0] == pytest.approx(score)


def test_verified_ecology_veto_remains_visible_to_the_hard_gate() -> None:
    cards = scorecards(candidate(), request(), marine(), False, None, None)
    cards[3] = {**cards[3], "score": 0, "veto": True, "confidence": 0.9,
                "reason_codes": ["CONFIRMED_NO_TAKE_FISHING_LOCATION"]}
    assert any(card["agent"] == "ecology" and card["veto"] for card in cards)


def real_grid() -> dict:
    return {
        "retrieved_at": "2026-09-04T00:00:00Z", "chl_time": "2026-09-01T00:00:00Z",
        "sst_time": "2026-09-02T00:00:00Z", "wave_time": "2026-09-04T00:00:00Z",
        "chl": {"lat": [12.8, 12.9, 13.0], "lon": [74.0, 74.2, 74.4],
                "value": [[1, 2, 3], [4, 5, 6], [7, 8, 9]], "uncertainty": [[1] * 3] * 3},
        "sst": {"lat": [12.8, 12.9, 13.0], "lon": [74.0, 74.2, 74.4],
                "value": [[300] * 3] * 3},
        "wave": {"lat": [12.8, 12.9, 13.0], "lon": [74.0, 74.2, 74.4],
                 "height": [[1] * 3] * 3, "direction": [[270] * 3] * 3, "period": [[8] * 3] * 3},
    }


def test_ecology_and_border_vetoes_feed_existing_hard_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    whole_aoi = {"type": "Polygon", "coordinates": [[[73.5, 12.0], [75, 12.0], [75, 14], [73.5, 14], [73.5, 12.0]]]}
    ecology = {"provider": "TEST_PROVIDER", "api_version": "v4", "retrieved_at": "2026-09-04T00:00:00Z",
               "geometry_source": "TEST_GEOMETRY", "evidence_ref": "TEST_GEOMETRY:ecology",
               "features": [{"geometry": whole_aoi, "properties": {"site_id": "TEST", "no_take_status": "All",
                                                             "legal_status": "Designated", "site_type": "PA"}}]}
    border = {"provider": "TEST_PROVIDER", "dataset": "TEST_GEOMETRY", "version": "TEST",
              "retrieved_at": "2026-09-04T00:00:00Z", "evidence_ref": "TEST_GEOMETRY:border",
              "features": [{"geometry": whole_aoi, "properties": {}}]}
    monkeypatch.setattr("bluejury.services.mvp.load_real", lambda _: (real_grid(), False))
    monkeypatch.setattr("bluejury.services.mvp.load_india_protected_areas", lambda *_: None)
    monkeypatch.setattr("bluejury.services.mvp.load_protected_areas", lambda *_: ecology)
    monkeypatch.setattr("bluejury.services.mvp.load_india_eez", lambda *_: border)
    result = analyze(request())
    assert result.verdict == "NO_GO"
    assert result.recommended_zone is None
    assert all(any(veto["agent"] == "ecology" for veto in item["vetoes"]) for item in result.hard_veto_trace)

    monkeypatch.setattr("bluejury.services.mvp.load_protected_areas", lambda *_: None)
    outside = {**border, "features": [{"geometry": {"type": "Polygon", "coordinates": [[[70, 8], [71, 8], [71, 9], [70, 9], [70, 8]]]}, "properties": {}}]}
    monkeypatch.setattr("bluejury.services.mvp.load_india_eez", lambda *_: outside)
    result = analyze(request())
    assert result.verdict == "NO_GO"
    assert all(any(veto["agent"] == "border" for veto in item["vetoes"]) for item in result.hard_veto_trace)


def test_no_token_and_no_cache_makes_no_external_request(tmp_path: Path) -> None:
    assert load_protected_areas(None, tmp_path / "missing.json") is None


def test_valid_local_ecology_preempts_optional_api(monkeypatch: pytest.MonkeyPatch) -> None:
    root = Path(__file__).resolve().parents[3] / "data/reference/protected-planet"
    local = load_india_protected_areas(root)
    if local is None:
        pytest.skip("Official Protected Planet India files are not installed")
    monkeypatch.setattr("bluejury.services.mvp.load_real", lambda _: (real_grid(), False))
    monkeypatch.setattr("bluejury.services.mvp.load_india_protected_areas", lambda *_: local)
    monkeypatch.setattr("bluejury.services.mvp.load_protected_areas",
                        lambda *_: pytest.fail("API adapter must not be called when local reference validates"))
    monkeypatch.setattr("bluejury.services.mvp.load_india_eez", lambda *_: None)
    result = analyze(request())
    assert result.candidates
    assert all(card["reason_codes"][0] == "DATA_UNAVAILABLE" for candidate in result.candidates
               for card in candidate["juror_scorecards"] if card["agent"] == "ecology")
