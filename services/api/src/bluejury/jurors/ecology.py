"""Deterministic Ecology Juror over validated protected-area reference geometry."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pyproj import CRS, Transformer
from shapely.geometry import Point, shape
from shapely.ops import transform


def _metric(geometry: Any, lon: float, lat: float) -> Any:
    return transform(_metric_transformer(lon, lat).transform, geometry)


def _metric_transformer(lon: float, lat: float) -> Transformer:
    crs = CRS.from_proj4(f"+proj=aeqd +lat_0={lat} +lon_0={lon} +datum=WGS84 +units=m")
    return Transformer.from_crs("EPSG:4326", crs, always_xy=True)


def _attach_supplementary_context(
    result: dict[str, Any],
    context: dict[str, Any] | None,
    route_geojson: dict[str, Any],
    destination_lonlat: tuple[float, float] | None,
) -> dict[str, Any]:
    """Attach point-only context without changing the protected-area decision."""
    if context is None or destination_lonlat is None:
        return result
    try:
        point = shape(context["geometry"])
        route = shape(route_geojson)
        destination = Point(*destination_lonlat)
        if (
            point.geom_type != "Point"
            or context.get("geometry_semantics") != "POINT_CONTEXT_ONLY"
            or point.is_empty
            or not point.is_valid
            or route.is_empty
            or not route.is_valid
            or not (-180 <= destination.x <= 180 and -90 <= destination.y <= 90)
        ):
            return result
        project = _metric_transformer(destination.x, destination.y).transform
        point_m = transform(project, point)
        route_m = transform(project, route)
        destination_m = transform(project, destination)
    except (KeyError, TypeError, ValueError):
        return result

    details = dict(result.get("details", {}))
    details["supplementary_ecological_context"] = [{
        "record_id": context.get("record_id"),
        "site_name": context.get("site_name"),
        "provider": context.get("provider"),
        "publication": context.get("publication"),
        "publication_year": context.get("publication_year"),
        "official_source_url": context.get("official_source_url"),
        "source_pages": context.get("source_pages"),
        "habitat": context.get("habitat"),
        "geometry_semantics": "POINT_CONTEXT_ONLY",
        "classification": context.get("classification"),
        "context_status": context.get("context_status"),
        "designation_status": context.get("designation_status"),
        "fishing_restriction_status": context.get("fishing_restriction_status"),
        "legal_effect": context.get("legal_effect"),
        "destination_distance_km": round(destination_m.distance(point_m) / 1000, 3),
        "route_distance_km": round(route_m.distance(point_m) / 1000, 3),
        "source_limitations": context.get("source_limitations"),
        "evidence_ref": context.get("evidence_ref"),
        "reference_file_sha256": context.get("reference_file_sha256"),
        "display_notice": "Historical biodiversity context only; not a protected-area boundary, fishing restriction, or ecological clearance.",
    }]
    return {**result, "details": details}


def evaluate_ecology(
    zone_id: str,
    zone_geojson: dict[str, Any],
    route_geojson: dict[str, Any],
    reference: dict[str, Any] | None,
    near_distance_km: float,
    *,
    footprint_role: str | None = None,
    destination_lonlat: tuple[float, float] | None = None,
    supplementary_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    checked_at = datetime.now(UTC).isoformat()
    unavailable = {
        "agent": "ecology", "zone_id": zone_id, "score": 50, "veto": False,
        "reason_codes": ["DATA_UNAVAILABLE"],
        "reason": "Authoritative protected-area geometry is unavailable; no ecological clearance is asserted.",
        "evidence_references": [], "confidence": 0.0, "checked_at": checked_at,
    }
    if not reference or not reference.get("features"):
        return _attach_supplementary_context(
            unavailable, supplementary_context, route_geojson, destination_lonlat
        )

    zone = shape(zone_geojson)
    route = shape(route_geojson)
    if zone.is_empty or route.is_empty or not zone.is_valid or not route.is_valid:
        return _attach_supplementary_context(
            unavailable, supplementary_context, route_geojson, destination_lonlat
        )
    if footprint_role not in ("DISCOVERY_FOOTPRINT", "FISHING_ACTIVITY_AREA") or destination_lonlat is None:
        result = {**unavailable, "reason_codes": ["FOOTPRINT_ROLE_UNSPECIFIED"],
                  "reason": "Proposed fishing footprint or destination is ambiguous; Ecology cannot assert clearance."}
        return _attach_supplementary_context(
            result, supplementary_context, route_geojson, destination_lonlat
        )
    destination = Point(*destination_lonlat)
    if not (-180 <= destination.x <= 180 and -90 <= destination.y <= 90):
        return _attach_supplementary_context(
            unavailable, supplementary_context, route_geojson, destination_lonlat
        )
    project = _metric_transformer(destination.x, destination.y).transform
    zone_m = transform(project, zone)
    route_m = transform(project, route)
    destination_m = transform(project, destination)
    matches: list[dict[str, Any]] = []
    nearest_m = float("inf")
    route_intersection = False
    destination_containment = False
    overlap_area_m2 = 0.0
    confirmed_no_take = False
    refs: list[str] = []
    for feature in reference["features"]:
        try:
            protected = shape(feature["geometry"])
        except (KeyError, TypeError, ValueError):
            continue
        if protected.is_empty or not protected.is_valid:
            continue
        protected_m = transform(project, protected)
        nearest_m = min(nearest_m, destination_m.distance(protected_m), route_m.distance(protected_m))
        if footprint_role == "FISHING_ACTIVITY_AREA":
            nearest_m = min(nearest_m, zone_m.distance(protected_m))
        zone_intersects = zone.intersects(protected)
        route_hits = route.intersects(protected)
        destination_hits = protected.covers(destination)
        activity_hits = zone_intersects and footprint_role == "FISHING_ACTIVITY_AREA"
        if not (zone_intersects or route_hits or destination_hits):
            continue
        properties = feature.get("properties", {})
        no_take = (
            str(properties.get("no_take_status", "")).casefold() == "all"
            and str(properties.get("legal_status", "")).casefold() in {"designated", "established"}
            and str(properties.get("site_type", "")).casefold() in {"pa", "protected area"}
        )
        confirmed_no_take = confirmed_no_take or (no_take and (destination_hits or activity_hits))
        route_intersection = route_intersection or route_hits
        destination_containment = destination_containment or destination_hits
        overlap_area_m2 += zone_m.intersection(protected_m).area
        site_id = str(properties.get("site_id") or properties.get("site_pid") or "unknown")
        refs.append(f"{reference['evidence_ref']}:site:{site_id}")
        matches.append({
            "site_id": site_id,
            "site_pid": properties.get("site_pid"),
            "name": properties.get("name"),
            "designation": properties.get("designation"),
            "jurisdiction": properties.get("jurisdiction"),
            "governance": properties.get("governance"),
            "no_take_status": properties.get("no_take_status"),
            "legal_status": properties.get("legal_status"),
            "metadata_id": properties.get("metadata_id"),
            "source_title": properties.get("source_title"),
            "source_responsible_party": properties.get("source_responsible_party"),
            "source_update_year": properties.get("source_update_year"),
            "destination_intersection": destination_hits,
            "route_intersection": route_hits,
            "fishing_area_intersection": activity_hits,
            "discovery_footprint_intersection": zone_intersects if footprint_role == "DISCOVERY_FOOTPRINT" else None,
        })

    overlap_percent = min(100.0, 100 * overlap_area_m2 / zone_m.area) if zone_m.area else 0.0
    nearby_points: list[dict[str, Any]] = []
    for feature in reference.get("point_records", []):
        point = shape(feature["geometry"])
        point_m = transform(project, point)
        distance_m = min(destination_m.distance(point_m), route_m.distance(point_m))
        if distance_m <= near_distance_km * 1000:
            properties = feature["properties"]
            nearby_points.append({"site_id": properties.get("site_id"),
                                  "name": properties.get("name"),
                                  "distance_km": round(distance_m / 1000, 3)})
    common = {
        "agent": "ecology", "zone_id": zone_id, "checked_at": checked_at,
        "evidence_references": sorted(set([reference["evidence_ref"], *refs])),
        "details": {
            "provider": reference["provider"], "dataset": reference.get("dataset"),
            "classification": reference.get("classification", "STATIC_REFERENCE"),
            "version": reference.get("version"), "api_version": reference.get("api_version"),
            "retrieved_at": reference["retrieved_at"], "imported_at": reference.get("imported_at"),
            "release_month": reference.get("release_month"),
            "geometry_source": reference["geometry_source"],
            "source_file_sha256": reference.get("source_file_sha256"),
            "original_filenames": reference.get("original_filenames"),
            "licence_url": reference.get("licence_url"), "citation": reference.get("citation"),
            "coverage_complete": reference.get("coverage_complete", not reference["provider"].startswith("Protected Planet")),
            "coverage_note": reference.get("coverage_note"),
            "point_only_record_count": len(reference.get("point_records", [])),
            "nearby_point_only_sites": nearby_points,
            "evaluated_scope": "DESTINATION_ROUTE_AND_FISHING_ACTIVITY_AREA" if footprint_role == "FISHING_ACTIVITY_AREA" else "DESTINATION_AND_ROUTE",
            "footprint_role": footprint_role,
            "protected_areas": matches, "zone_overlap_percent": round(overlap_percent, 3),
            "route_intersection": route_intersection,
            "destination_containment": destination_containment,
            "nearest_distance_km": None if nearest_m == float("inf") else round(nearest_m / 1000, 3),
        },
    }
    if confirmed_no_take:
        result = {**common, "score": 0, "veto": True,
                "reason_codes": ["CONFIRMED_NO_TAKE_FISHING_LOCATION"],
                "reason": "The proposed fishing destination or explicit fishing-activity area intersects a designated protected site reported as entirely no-take; Ecology applies a hard veto to fishing there, not to transit alone.",
                "confidence": 0.9}
        return _attach_supplementary_context(
            result, supplementary_context, route_geojson, destination_lonlat
        )
    activity_matches = [match for match in matches if match["destination_intersection"] or match["fishing_area_intersection"]]
    if activity_matches:
        result = {**common, "score": 55, "veto": False,
                "reason_codes": ["PROTECTED_AREA_OVERLAP_RESTRICTION_UNVERIFIED"],
                "reason": "Proposed fishing location intersects a recorded protected area, but fishing prohibition is not verified. Ecological caution applied; no legal hard veto inferred. Public India coverage is incomplete.",
                "confidence": 0.7}
        return _attach_supplementary_context(
            result, supplementary_context, route_geojson, destination_lonlat
        )
    if route_intersection:
        result = {**common, "score": 65, "veto": False,
                "reason_codes": ["PROTECTED_AREA_ROUTE_TRANSIT"],
                "reason": "The route intersects a recorded protected area. Transit is disclosed as ecological caution; fishing at the destination is not inferred from route passage.",
                "confidence": 0.7}
        return _attach_supplementary_context(
            result, supplementary_context, route_geojson, destination_lonlat
        )
    if nearby_points:
        result = {**common, "score": 50, "veto": False,
                "reason_codes": ["DATA_UNAVAILABLE", "POINT_ONLY_PROTECTED_AREA_NEARBY"],
                "reason": "A protected area is represented only by a nearby point; its boundary and overlap cannot be established. No ecological clearance is asserted.",
                "confidence": 0.0}
        return _attach_supplementary_context(
            result, supplementary_context, route_geojson, destination_lonlat
        )
    if nearest_m <= near_distance_km * 1000:
        result = {**common, "score": 70, "veto": False,
                "reason_codes": ["NEAR_PROTECTED_AREA"],
                "reason": f"Destination or route is within {near_distance_km:.1f} km of a recorded protected area; ecological caution applied. Public India coverage is incomplete.",
                "confidence": 0.7}
        return _attach_supplementary_context(
            result, supplementary_context, route_geojson, destination_lonlat
        )
    if not reference.get("coverage_complete", not reference["provider"].startswith("Protected Planet")):
        result = {**common, "score": 50, "veto": False,
                "reason_codes": ["DATA_UNAVAILABLE", "PUBLIC_REFERENCE_COVERAGE_INCOMPLETE"],
                "reason": "No conflict was found in public polygon records, but India withholds protected-area records and point-only sites have no area boundary. Comprehensive ecological clearance is unavailable.",
                "confidence": 0.0}
        return _attach_supplementary_context(
            result, supplementary_context, route_geojson, destination_lonlat
        )
    result = {**common, "score": 90, "veto": False,
            "reason_codes": ["NO_PROTECTED_AREA_INTERSECTION"],
            "reason": "No intersection or configured proximity concern was found in the validated, complete protected-area reference geometry for the evaluated fishing scope.",
            "confidence": 0.9}
    return _attach_supplementary_context(
        result, supplementary_context, route_geojson, destination_lonlat
    )
