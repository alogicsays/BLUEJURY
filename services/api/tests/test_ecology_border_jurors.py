"""Pure TEST_GEOMETRY mathematics and official-file import tests."""

import shutil
from pathlib import Path

import pytest
from shapely.geometry import shape

from bluejury.adapters.marine_regions import load_india_eez
from bluejury.adapters.protected_planet_local import load_india_protected_areas
from bluejury.jurors.border import evaluate_border
from bluejury.jurors.ecology import evaluate_ecology

TEST_ZONE = {"type": "Polygon", "coordinates": [[[74.0, 12.0], [74.1, 12.0], [74.1, 12.1], [74.0, 12.1], [74.0, 12.0]]]}
TEST_ROUTE = {"type": "LineString", "coordinates": [[74.02, 12.02], [74.08, 12.08]]}
TEST_REFERENCE_AREA = {"type": "Polygon", "coordinates": [[[73, 11], [75, 11], [75, 13], [73, 13], [73, 11]]]}
TEST_DISCOVERY_CIRCLE = {"type": "Polygon", "coordinates": [[[74.9, 11.9], [75.1, 11.9], [75.1, 12.1], [74.9, 12.1], [74.9, 11.9]]]}
TEST_DESTINATION_ROUTE = {"type": "LineString", "coordinates": [[74, 12], [74.95, 12]]}


def ecology_reference(geometry: dict, no_take: str = "None", *, complete: bool = True) -> dict:
    return {
        "provider": "TEST_PROVIDER", "api_version": "v4", "retrieved_at": "2026-09-04T00:00:00Z",
        "geometry_source": "TEST_GEOMETRY", "evidence_ref": "TEST_GEOMETRY:ecology",
        "coverage_complete": complete,
        "features": [{"type": "Feature", "geometry": geometry, "properties": {
            "site_id": "TEST_SITE", "name": "TEST_GEOMETRY", "designation": "test",
            "jurisdiction": "test", "governance": "test", "no_take_status": no_take,
            "legal_status": "Designated", "site_type": "PA",
        }}],
    }


def border_reference(geometry: dict) -> dict:
    return {
        "provider": "TEST_PROVIDER", "dataset": "TEST_GEOMETRY", "version": "TEST",
        "retrieved_at": "2026-09-04T00:00:00Z", "evidence_ref": "TEST_GEOMETRY:border",
        "region_name": "TEST_REGION",
        "features": [{"type": "Feature", "geometry": geometry, "properties": {}}],
    }


def test_ecology_without_source_is_unavailable() -> None:
    result = evaluate_ecology("ZONE-A", TEST_ZONE, TEST_ROUTE, None, 5)
    assert result["reason_codes"] == ["DATA_UNAVAILABLE"]
    assert result["confidence"] == 0
    assert result["veto"] is False


def test_ecology_clear_caution_veto_route_and_provenance() -> None:
    distant = {"type": "Polygon", "coordinates": [[[75, 13], [75.1, 13], [75.1, 13.1], [75, 13.1], [75, 13]]]}
    options = {"footprint_role": "FISHING_ACTIVITY_AREA", "destination_lonlat": (74.08, 12.08)}
    clear = evaluate_ecology("ZONE-A", TEST_ZONE, TEST_ROUTE, ecology_reference(distant), 5, **options)
    assert clear["reason_codes"] == ["NO_PROTECTED_AREA_INTERSECTION"]

    overlap = evaluate_ecology("ZONE-A", TEST_ZONE, TEST_ROUTE, ecology_reference(TEST_ZONE), 5, **options)
    assert overlap["reason_codes"] == ["PROTECTED_AREA_OVERLAP_RESTRICTION_UNVERIFIED"]
    assert overlap["veto"] is False
    assert overlap["details"]["route_intersection"] is True
    assert "TEST_GEOMETRY:ecology:site:TEST_SITE" in overlap["evidence_references"]

    veto = evaluate_ecology("ZONE-A", TEST_ZONE, TEST_ROUTE, ecology_reference(TEST_ZONE, "All"), 5, **options)
    assert veto["veto"] is True
    assert veto["reason_codes"] == ["CONFIRMED_NO_TAKE_FISHING_LOCATION"]


def test_ecology_discovery_circle_does_not_define_fishing_activity() -> None:
    result = evaluate_ecology(
        "ZONE-A", TEST_DISCOVERY_CIRCLE, TEST_DESTINATION_ROUTE,
        ecology_reference({"type": "Polygon", "coordinates": [[[75.02, 11.95], [75.08, 11.95],
                           [75.08, 12.05], [75.02, 12.05], [75.02, 11.95]]]}, "All", complete=False),
        5, footprint_role="DISCOVERY_FOOTPRINT", destination_lonlat=(74.95, 12),
    )
    assert result["veto"] is False
    assert result["details"]["zone_overlap_percent"] > 0
    assert result["details"]["evaluated_scope"] == "DESTINATION_AND_ROUTE"
    assert result["reason_codes"][0] == "DATA_UNAVAILABLE"


def test_ecology_route_transit_is_not_prohibited_fishing() -> None:
    site = {"type": "Polygon", "coordinates": [[[74.2, 11.9], [74.3, 11.9],
            [74.3, 12.1], [74.2, 12.1], [74.2, 11.9]]]}
    route = {"type": "LineString", "coordinates": [[74, 12], [74.5, 12]]}
    result = evaluate_ecology("ZONE-A", TEST_ZONE, route, ecology_reference(site, "All"), 5,
                              footprint_role="DISCOVERY_FOOTPRINT", destination_lonlat=(74.08, 12.08))
    assert result["reason_codes"] == ["PROTECTED_AREA_ROUTE_TRANSIT"]
    assert result["veto"] is False
    assert result["details"]["route_intersection"] is True


def test_ecology_explicit_fishing_area_intersection_can_veto() -> None:
    site = {"type": "Polygon", "coordinates": [[[74.02, 12.02], [74.04, 12.02],
            [74.04, 12.04], [74.02, 12.04], [74.02, 12.02]]]}
    result = evaluate_ecology("ZONE-A", TEST_ZONE, TEST_ROUTE, ecology_reference(site, "All"), 5,
                              footprint_role="FISHING_ACTIVITY_AREA", destination_lonlat=(74.08, 12.08))
    assert result["veto"] is True
    assert result["details"]["protected_areas"][0]["fishing_area_intersection"] is True


def test_ecology_unverified_no_take_status_never_vetoes() -> None:
    reference = ecology_reference(TEST_ZONE, "All")
    reference["features"][0]["properties"]["legal_status"] = "Proposed"
    result = evaluate_ecology("ZONE-A", TEST_ZONE, TEST_ROUTE, reference, 5,
                              footprint_role="FISHING_ACTIVITY_AREA", destination_lonlat=(74.08, 12.08))
    assert result["veto"] is False
    assert result["reason_codes"] == ["PROTECTED_AREA_OVERLAP_RESTRICTION_UNVERIFIED"]


def test_ecology_public_coverage_and_point_only_do_not_clear() -> None:
    distant = {"type": "Polygon", "coordinates": [[[75, 13], [75.1, 13], [75.1, 13.1], [75, 13.1], [75, 13]]]}
    reference = ecology_reference(distant, complete=False)
    reference["point_records"] = [{"geometry": {"type": "Point", "coordinates": [74.05, 12.05]},
                                   "properties": {"site_id": "TEST_POINT", "name": "TEST_GEOMETRY_POINT"}}]
    result = evaluate_ecology("ZONE-A", TEST_ZONE, TEST_ROUTE, reference, 5,
                              footprint_role="DISCOVERY_FOOTPRINT", destination_lonlat=(74.08, 12.08))
    assert result["reason_codes"] == ["DATA_UNAVAILABLE", "POINT_ONLY_PROTECTED_AREA_NEARBY"]
    assert result["details"]["point_only_record_count"] == 1
    reference["point_records"] = []
    result = evaluate_ecology("ZONE-A", TEST_ZONE, TEST_ROUTE, reference, 5,
                              footprint_role="DISCOVERY_FOOTPRINT", destination_lonlat=(74.08, 12.08))
    assert result["reason_codes"] == ["DATA_UNAVAILABLE", "PUBLIC_REFERENCE_COVERAGE_INCOMPLETE"]


def test_ecology_nearby_polygon_is_caution_without_veto() -> None:
    near = {"type": "Polygon", "coordinates": [[[74.12, 12.0], [74.14, 12.0],
            [74.14, 12.1], [74.12, 12.1], [74.12, 12.0]]]}
    result = evaluate_ecology("ZONE-A", TEST_ZONE, TEST_ROUTE, ecology_reference(near, complete=False), 5,
                              footprint_role="DISCOVERY_FOOTPRINT", destination_lonlat=(74.08, 12.08))
    assert result["reason_codes"] == ["NEAR_PROTECTED_AREA"]
    assert result["veto"] is False
    assert result["details"]["nearest_distance_km"] < 5


def test_ecology_ambiguous_footprint_is_unavailable() -> None:
    result = evaluate_ecology("ZONE-A", TEST_ZONE, TEST_ROUTE, ecology_reference(TEST_ZONE), 5)
    assert result["reason_codes"] == ["FOOTPRINT_ROLE_UNSPECIFIED"]
    assert result["veto"] is False


def test_official_india_wdpca_split_import_when_installed() -> None:
    root = Path(__file__).resolve().parents[3] / "data/reference/protected-planet"
    if not (root / "india-wdpca-2026-09/WDPA_WDOECM_Sep2026_Public_IND_shp_0.zip").exists():
        pytest.skip("Official Protected Planet India files are not installed")
    loaded = load_india_protected_areas(root)
    assert loaded is not None
    assert loaded["validation_status"] == "VALIDATED_OFFICIAL_FILE"
    assert loaded["version"] == "September 2026"
    assert loaded["coverage_complete"] is False
    assert len(loaded["features"]) == 63
    assert len(loaded["point_records"]) == 27
    assert len({(f["properties"]["site_id"], f["properties"]["site_pid"]) for f in loaded["features"]}) == 63
    assert len(loaded["source_file_sha256"]) == 5
    assert all(f["properties"]["source_title"] for f in loaded["features"])
    assert {f["properties"]["no_take_status"] for f in loaded["features"]} == {"Not Applicable", "Not Reported"}
    assert loaded["retrieved_at"] is None
    assert loaded["imported_at"]
    assert loaded["release_month"] == "2026-09"


def test_real_marine_polygon_produces_verified_concern_without_invented_veto() -> None:
    root = Path(__file__).resolve().parents[3] / "data/reference/protected-planet"
    reference = load_india_protected_areas(root)
    if reference is None:
        pytest.skip("Official Protected Planet India files are not installed")
    feature = next(f for f in reference["features"] if f["properties"]["site_id"] == "555795353")
    polygon = shape(feature["geometry"])
    assert polygon.is_valid
    assert feature["properties"]["realm"] == "Marine"
    assert feature["properties"]["no_take_status"] == "Not Reported"
    destination = polygon.representative_point()
    route = {"type": "LineString", "coordinates": [[destination.x - 0.001, destination.y],
                                                   [destination.x, destination.y]]}
    result = evaluate_ecology("VALIDATION_ONLY", feature["geometry"], route, reference, 5,
                              footprint_role="DISCOVERY_FOOTPRINT",
                              destination_lonlat=(destination.x, destination.y))
    assert result["reason_codes"] == ["PROTECTED_AREA_OVERLAP_RESTRICTION_UNVERIFIED"]
    assert result["veto"] is False
    assert result["details"]["destination_containment"] is True
    assert result["details"]["nearest_distance_km"] == 0
    assert any(ref.endswith(":site:555795353") for ref in result["evidence_references"])


def test_missing_or_incomplete_official_india_wdpca_is_unavailable(tmp_path: Path) -> None:
    assert load_india_protected_areas(tmp_path) is None
    directory = tmp_path / "india-wdpca-2026-09"
    directory.mkdir()
    (directory / "WDPA_WDOECM_Sep2026_Public_IND_shp_0.zip").write_bytes(b"not a zip")
    assert load_india_protected_areas(tmp_path) is None


def test_corrupt_official_split_is_rejected(tmp_path: Path) -> None:
    source = Path(__file__).resolve().parents[3] / "data/reference/protected-planet/india-wdpca-2026-09"
    if not source.exists():
        pytest.skip("Official Protected Planet India files are not installed")
    target = tmp_path / "india-wdpca-2026-09"
    target.mkdir()
    for file in source.glob("*.zip"):
        shutil.copyfile(file, target / file.name)
    for name in ("WDPA_sources_Sep2026.csv", "Shapefile_splitting_README.txt"):
        shutil.copyfile(source / name, target / name)
    (target / "WDPA_WDOECM_Sep2026_Public_IND_shp_1.zip").write_bytes(b"corrupt")
    assert load_india_protected_areas(tmp_path) is None


def test_border_unavailable_clear_near_and_veto_with_provenance() -> None:
    unavailable = evaluate_border("ZONE-A", TEST_ZONE, TEST_ROUTE, None, 10)
    assert unavailable["reason_codes"] == ["DATA_UNAVAILABLE"]

    large = {"type": "Polygon", "coordinates": [[[73, 11], [75, 11], [75, 13], [73, 13], [73, 11]]]}
    clear = evaluate_border("ZONE-A", TEST_ZONE, TEST_ROUTE, border_reference(large), 10,
                            footprint_role="FISHING_ACTIVITY_AREA", destination_lonlat=(74.08, 12.08))
    assert clear["reason_codes"] == ["WITHIN_PERMITTED_MARITIME_REFERENCE"]
    assert clear["details"]["route_inside"] is True
    assert clear["evidence_references"] == ["TEST_GEOMETRY:border"]

    tight = {"type": "Polygon", "coordinates": [[[73.99, 11.99], [74.11, 11.99], [74.11, 12.11], [73.99, 12.11], [73.99, 11.99]]]}
    near = evaluate_border("ZONE-A", TEST_ZONE, TEST_ROUTE, border_reference(tight), 10,
                           footprint_role="FISHING_ACTIVITY_AREA", destination_lonlat=(74.08, 12.08))
    assert near["reason_codes"] == ["NEAR_MARITIME_REFERENCE_BOUNDARY"]
    assert near["veto"] is False

    outside_route = {"type": "LineString", "coordinates": [[74.02, 12.02], [75.5, 12.5]]}
    veto = evaluate_border("ZONE-A", TEST_ZONE, outside_route, border_reference(large), 10,
                           footprint_role="FISHING_ACTIVITY_AREA", destination_lonlat=(74.08, 12.08))
    assert veto["veto"] is True
    assert veto["reason_codes"] == ["OUTSIDE_PERMITTED_MARITIME_REFERENCE"]


def test_destination_route_inside_discovery_footprint_partly_outside() -> None:
    result = evaluate_border(
        "ZONE-A", TEST_DISCOVERY_CIRCLE, TEST_DESTINATION_ROUTE,
        border_reference(TEST_REFERENCE_AREA), 10,
        footprint_role="DISCOVERY_FOOTPRINT", destination_lonlat=(74.95, 12),
    )
    assert result["veto"] is False
    assert result["reason_codes"] == ["DISCOVERY_FOOTPRINT_OUTSIDE_REFERENCE"]
    assert result["details"]["evaluated_scope"] == "DESTINATION_AND_ROUTE"
    assert result["details"]["destination_inside"] is True
    assert result["details"]["route_inside"] is True
    assert result["details"]["zone_inside"] is False
    assert result["details"]["footprint_outside_km2"] > 0
    assert result["details"]["footprint_outside_percent"] > 0
    assert "not a cleared fishing area" in result["reason"]


def test_destination_exit_remains_hard_veto() -> None:
    route = {"type": "LineString", "coordinates": [[74, 12], [75.2, 12]]}
    result = evaluate_border(
        "ZONE-A", TEST_DISCOVERY_CIRCLE, route, border_reference(TEST_REFERENCE_AREA), 10,
        footprint_role="DISCOVERY_FOOTPRINT", destination_lonlat=(75.2, 12),
    )
    assert result["veto"] is True
    assert result["details"]["destination_inside"] is False


def test_complete_route_exit_remains_hard_veto_when_destination_inside() -> None:
    route = {"type": "LineString", "coordinates": [[74, 12], [75.2, 12], [74.95, 12]]}
    result = evaluate_border(
        "ZONE-A", TEST_DISCOVERY_CIRCLE, route, border_reference(TEST_REFERENCE_AREA), 10,
        footprint_role="DISCOVERY_FOOTPRINT", destination_lonlat=(74.95, 12),
    )
    assert result["veto"] is True
    assert result["details"]["destination_inside"] is True
    assert result["details"]["route_inside"] is False


def test_verified_route_exit_vetoes_even_if_destination_is_missing() -> None:
    route = {"type": "LineString", "coordinates": [[74, 12], [75.2, 12]]}
    result = evaluate_border(
        "ZONE-A", TEST_DISCOVERY_CIRCLE, route, border_reference(TEST_REFERENCE_AREA), 10,
        footprint_role="DISCOVERY_FOOTPRINT",
    )
    assert result["veto"] is True
    assert result["evidence_references"] == ["TEST_GEOMETRY:border"]


def test_explicit_activity_polygon_exit_remains_hard_veto() -> None:
    result = evaluate_border(
        "ZONE-A", TEST_DISCOVERY_CIRCLE, TEST_DESTINATION_ROUTE,
        border_reference(TEST_REFERENCE_AREA), 10,
        footprint_role="FISHING_ACTIVITY_AREA", destination_lonlat=(74.95, 12),
    )
    assert result["veto"] is True
    assert result["reason_codes"] == ["FISHING_ACTIVITY_AREA_OUTSIDE_REFERENCE"]


def test_ambiguous_footprint_role_cannot_be_cleared() -> None:
    result = evaluate_border(
        "ZONE-A", TEST_DISCOVERY_CIRCLE, TEST_DESTINATION_ROUTE,
        border_reference(TEST_REFERENCE_AREA), 10,
        destination_lonlat=(74.95, 12),
    )
    assert result["veto"] is False
    assert result["confidence"] == 0
    assert result["reason_codes"] == ["FOOTPRINT_ROLE_UNSPECIFIED"]


def test_official_eez_v12_import_when_installed() -> None:
    reference_dir = Path(__file__).resolve().parents[3] / "data/reference/marine-regions"
    if not (reference_dir / "World_EEZ_v12_20231025/eez_v12.shp").exists():
        pytest.skip("Official Marine Regions file is not installed")
    loaded = load_india_eez(reference_dir)
    assert loaded is not None
    assert loaded["validation_status"] == "VALIDATED_OFFICIAL_FILE"
    assert loaded["version"] == "12"
    assert loaded["crs"] == "EPSG:4326"
    assert len(loaded["source_file_sha256"]) == 64
    assert {feature["properties"]["MRGID"] for feature in loaded["features"]} == {8333, 8480}
    assert all(feature["properties"]["ISO_SOV1"] == "IND" for feature in loaded["features"])


def test_missing_official_eez_file_is_unavailable(tmp_path: Path) -> None:
    assert load_india_eez(tmp_path) is None
