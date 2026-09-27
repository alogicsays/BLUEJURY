"""Focused tests for WII point-only supplementary ecological context."""

import json
from pathlib import Path

from bluejury.adapters.wii_biodiversity_context import load_mulki_pavanje_context
from bluejury.jurors.ecology import evaluate_ecology

ROOT = Path(__file__).resolve().parents[3]
REFERENCE_DIR = ROOT / "data" / "reference" / "wii-icmba"
ZONE_C_DESTINATION = (74.77084350585938, 13.020831108093262)
ZONE_C_ROUTE = {
    "type": "LineString",
    "coordinates": [[74.771556, 12.918389], [74.77084350585938, 13.020831108093262]],
}
TEST_ZONE = {
    "type": "Polygon",
    "coordinates": [[
        [74.7478, 12.9982], [74.7939, 12.9982], [74.7939, 13.0434],
        [74.7478, 13.0434], [74.7478, 12.9982],
    ]],
}


def incomplete_reference() -> dict:
    return {
        "provider": "TEST_PROVIDER",
        "dataset": "TEST_GEOMETRY",
        "retrieved_at": "2026-09-20T00:00:00Z",
        "geometry_source": "TEST_GEOMETRY",
        "evidence_ref": "TEST_GEOMETRY:ecology",
        "coverage_complete": False,
        "features": [{
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[76, 14], [76.1, 14], [76.1, 14.1], [76, 14.1], [76, 14]]],
            },
            "properties": {"site_id": "DISTANT_TEST_GEOMETRY"},
        }],
    }


def test_official_wii_point_context_loads_with_provenance() -> None:
    context = load_mulki_pavanje_context(REFERENCE_DIR)
    assert context is not None
    assert context["geometry"]["type"] == "Point"
    assert context["geometry"]["coordinates"] == [74.7877833333, 13.09725]
    assert context["geometry_semantics"] == "POINT_CONTEXT_ONLY"
    assert context["publication_year"] == 2013
    assert context["source_pages"] == {"coordinate_table": 143, "site_narrative": 158}
    assert context["fishing_restriction_status"] == "NONE_VERIFIED"
    assert len(context["reference_file_sha256"]) == 64


def test_zone_c_point_distances_are_accurate_and_context_only() -> None:
    context = load_mulki_pavanje_context(REFERENCE_DIR)
    result = evaluate_ecology(
        "ZONE-C", TEST_ZONE, ZONE_C_ROUTE, incomplete_reference(), 5,
        footprint_role="DISCOVERY_FOOTPRINT",
        destination_lonlat=ZONE_C_DESTINATION,
        supplementary_context=context,
    )
    supplementary = result["details"]["supplementary_ecological_context"][0]
    assert supplementary["destination_distance_km"] == 8.652
    assert supplementary["route_distance_km"] == 8.652
    assert supplementary["geometry_semantics"] == "POINT_CONTEXT_ONLY"
    assert supplementary["designation_status"] == "NOTIFICATION_NOT_VERIFIED"
    assert supplementary["legal_effect"] == "NONE_ASSERTED"
    assert result["score"] == 50
    assert result["confidence"] == 0
    assert result["veto"] is False
    assert result["reason_codes"] == ["DATA_UNAVAILABLE", "PUBLIC_REFERENCE_COVERAGE_INCOMPLETE"]
    assert context["evidence_ref"] not in result["evidence_references"]


def test_missing_or_invalid_context_is_omitted_without_changing_decision(tmp_path: Path) -> None:
    baseline = evaluate_ecology(
        "ZONE-C", TEST_ZONE, ZONE_C_ROUTE, incomplete_reference(), 5,
        footprint_role="DISCOVERY_FOOTPRINT", destination_lonlat=ZONE_C_DESTINATION,
    )
    assert load_mulki_pavanje_context(tmp_path) is None
    (tmp_path / "mulki-pavanje-2013.json").write_text(json.dumps({"geometry": None}))
    assert load_mulki_pavanje_context(tmp_path) is None
    evaluated = evaluate_ecology(
        "ZONE-C", TEST_ZONE, ZONE_C_ROUTE, incomplete_reference(), 5,
        footprint_role="DISCOVERY_FOOTPRINT", destination_lonlat=ZONE_C_DESTINATION,
        supplementary_context=None,
    )
    for field in ("score", "confidence", "veto", "reason_codes", "reason", "evidence_references"):
        assert evaluated[field] == baseline[field]
    assert "supplementary_ecological_context" not in evaluated["details"]
