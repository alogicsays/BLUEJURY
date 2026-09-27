"""Deterministic Border Juror over validated Marine Regions geometry."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pyproj import CRS, Transformer
from shapely.geometry import Point, shape
from shapely.ops import transform, unary_union

from bluejury.schemas.mvp import FootprintRole

_PERMITTED_GEOMETRY_CACHE: list[tuple[list[dict[str, Any]], Any]] = []
_METRIC_PERMITTED_CACHE: list[tuple[list[dict[str, Any]], float, float, Any]] = []


def _metric(geometry: Any, lon: float, lat: float) -> Any:
    return transform(_metric_transformer(lon, lat).transform, geometry)


def _metric_transformer(lon: float, lat: float) -> Transformer:
    crs = CRS.from_proj4(f"+proj=aeqd +lat_0={lat} +lon_0={lon} +datum=WGS84 +units=m")
    return Transformer.from_crs("EPSG:4326", crs, always_xy=True)


def _metric_permitted(features: list[dict[str, Any]], permitted: Any, lon: float, lat: float) -> Any:
    for cached_features, cached_lon, cached_lat, geometry in _METRIC_PERMITTED_CACHE:
        if cached_features is features and cached_lon == lon and cached_lat == lat:
            return geometry
    geometry = transform(_metric_transformer(lon, lat).transform, permitted)
    _METRIC_PERMITTED_CACHE.append((features, lon, lat, geometry))
    if len(_METRIC_PERMITTED_CACHE) > 16:
        _METRIC_PERMITTED_CACHE.pop(0)
    return geometry


def evaluate_border(
    zone_id: str,
    zone_geojson: dict[str, Any],
    route_geojson: dict[str, Any],
    reference: dict[str, Any] | None,
    near_distance_km: float,
    footprint_role: FootprintRole | None = None,
    destination_lonlat: tuple[float, float] | None = None,
) -> dict[str, Any]:
    checked_at = datetime.now(UTC).isoformat()
    unavailable = {
        "agent": "border", "zone_id": zone_id, "score": 50, "veto": False,
        "reason_codes": ["DATA_UNAVAILABLE"],
        "reason": "Official maritime reference geometry is unavailable; no boundary clearance is asserted.",
        "evidence_references": [], "confidence": 0.0, "checked_at": checked_at,
    }
    if not reference or not reference.get("features"):
        return unavailable
    try:
        features = reference["features"]
        permitted = next((geometry for cached_features, geometry in _PERMITTED_GEOMETRY_CACHE if cached_features is features), None)
        if permitted is None:
            permitted = unary_union([shape(item["geometry"]) for item in features])
            _PERMITTED_GEOMETRY_CACHE.append((features, permitted))
        zone = shape(zone_geojson)
        route = shape(route_geojson)
        destination = Point(destination_lonlat) if destination_lonlat is not None else None
    except (KeyError, TypeError, ValueError):
        return unavailable
    if any(item.is_empty or not item.is_valid for item in (permitted, zone, route)):
        return unavailable
    if destination is None or destination.is_empty or not destination.is_valid:
        if not permitted.covers(route):
            return {
                **unavailable,
                "score": 0, "veto": True,
                "reason_codes": ["OUTSIDE_PERMITTED_MARITIME_REFERENCE"],
                "reason": "The verified complete route exits the configured maritime reference; Border applies a hard veto. Destination geometry is unavailable.",
                "evidence_references": [reference["evidence_ref"]],
                "confidence": 0.88,
            }
        return unavailable

    centre = destination
    project = _metric_transformer(centre.x, centre.y).transform
    permitted_m = _metric_permitted(features, permitted, centre.x, centre.y)
    zone_m = transform(project, zone)
    route_m = transform(project, route)
    destination_m = transform(project, destination)
    destination_inside = permitted.covers(destination)
    zone_inside = permitted.covers(zone)
    route_inside = permitted.covers(route)
    outside_area_km2 = zone_m.difference(permitted_m).area / 1_000_000
    outside_percent = min(100.0, 100 * outside_area_km2 / (zone_m.area / 1_000_000)) if zone_m.area else 0.0
    scoped_geometries = [destination_m, route_m]
    if footprint_role == "FISHING_ACTIVITY_AREA":
        scoped_geometries.append(zone_m)
    boundary_distance_km = min(item.distance(permitted_m.boundary) for item in scoped_geometries) / 1000
    details = {
        "provider": reference["provider"], "dataset": reference["dataset"],
        "version": reference["version"], "retrieved_at": reference["retrieved_at"],
        "geometry_source": reference.get("geometry_source"),
        "source_file_sha256": reference.get("source_file_sha256"),
        "crs": reference.get("crs"), "licence": reference.get("licence"),
        "containing_reference_region": reference.get("region_name", "India maritime reference"),
        "evaluated_scope": "DESTINATION_AND_ROUTE" if footprint_role == "DISCOVERY_FOOTPRINT" else "DESTINATION_ROUTE_AND_ACTIVITY_AREA" if footprint_role == "FISHING_ACTIVITY_AREA" else "UNRESOLVED_FOOTPRINT_ROLE",
        "footprint_role": footprint_role,
        "destination_inside": destination_inside, "zone_inside": zone_inside,
        "route_inside": route_inside, "crossing_status": "REMAINS_INSIDE" if route_inside else "EXITS_REFERENCE",
        "footprint_outside_km2": round(outside_area_km2, 3),
        "footprint_outside_percent": round(outside_percent, 3),
        "nearest_boundary_distance_km": round(boundary_distance_km, 3),
        "notice": (
            "Discovery circle is not a cleared fishing area. "
            if footprint_role == "DISCOVERY_FOOTPRINT" else ""
        ) + "Maritime geographic reference check; not legal fishing advice.",
    }
    common = {
        "agent": "border", "zone_id": zone_id, "checked_at": checked_at,
        "evidence_references": [reference["evidence_ref"]], "details": details,
    }
    if not destination_inside or not route_inside:
        return {**common, "score": 0, "veto": True,
                "reason_codes": ["OUTSIDE_PERMITTED_MARITIME_REFERENCE"],
                "reason": "Verified destination or complete route exits the configured maritime reference; Border applies a hard feasibility veto. The discovery circle does not define the proposed fishing activity.",
                "confidence": 0.94}
    if footprint_role == "FISHING_ACTIVITY_AREA" and not zone_inside:
        return {**common, "score": 0, "veto": True,
                "reason_codes": ["FISHING_ACTIVITY_AREA_OUTSIDE_REFERENCE"],
                "reason": "The explicitly proposed fishing-activity area extends outside the configured maritime reference; Border applies a hard feasibility veto.",
                "confidence": 0.94}
    if footprint_role not in ("DISCOVERY_FOOTPRINT", "FISHING_ACTIVITY_AREA"):
        return {**common, "score": 50, "veto": False,
                "reason_codes": ["FOOTPRINT_ROLE_UNSPECIFIED"],
                "reason": "Destination and route were checked, but the polygon's activity role is unspecified; Border cannot assert clearance for a possible fishing area.",
                "confidence": 0.0}
    if footprint_role == "DISCOVERY_FOOTPRINT" and not zone_inside:
        return {**common, "score": 65, "veto": False,
                "reason_codes": ["DISCOVERY_FOOTPRINT_OUTSIDE_REFERENCE"],
                "reason": f"Destination and complete route remain inside the maritime reference. The surrounding discovery circle extends {outside_area_km2:.3f} km² ({outside_percent:.2f}%) outside; it is not a cleared fishing area. Caution applied, not a hard veto.",
                "confidence": 0.88}
    scope = (
        "Destination, complete route, and proposed fishing-activity area"
        if footprint_role == "FISHING_ACTIVITY_AREA"
        else "Destination and complete route"
    )
    qualifier = (
        ""
        if footprint_role == "FISHING_ACTIVITY_AREA"
        else " The surrounding discovery circle is not a cleared fishing area."
    )
    if boundary_distance_km <= near_distance_km:
        return {**common, "score": 65, "veto": False,
                "reason_codes": ["NEAR_MARITIME_REFERENCE_BOUNDARY"],
                "reason": f"{scope} remain inside but within {near_distance_km:.1f} km of the configured maritime reference boundary; caution applied.{qualifier}",
                "confidence": 0.88}
    return {**common, "score": 90, "veto": False,
            "reason_codes": ["WITHIN_PERMITTED_MARITIME_REFERENCE"],
            "reason": f"{scope} remain within the configured maritime reference.{qualifier}",
            "confidence": 0.94}
