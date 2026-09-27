"""Loader for a manually downloaded official Marine Regions World EEZ v12 file."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import shapefile  # type: ignore[import-untyped]
from pyproj import CRS
from shapely.geometry import shape

EXPECTED_STEM = "World_EEZ_v12_20231025"


def _india_record(properties: dict[str, Any]) -> bool:
    return (
        properties.get("ISO_SOV1") == "IND"
        and properties.get("SOVEREIGN1") == "India"
        and properties.get("POL_TYPE") == "200NM"
    )


def load_india_eez(reference_dir: Path) -> dict[str, Any] | None:
    """Validate and isolate Indian records from the official extracted shapefile."""
    shp_path = reference_dir / EXPECTED_STEM / "eez_v12.shp"
    required_sidecars = [shp_path.with_suffix(ext) for ext in (".dbf", ".shx", ".prj")]
    licence_path = shp_path.parent / "LICENSE_EEZ_v12.txt"
    if not shp_path.exists() or not all(item.exists() for item in required_sidecars) or not licence_path.exists():
        return None
    try:
        if CRS.from_wkt(shp_path.with_suffix(".prj").read_text(encoding="utf-8")).to_epsg() != 4326:
            return None
        reader = shapefile.Reader(str(shp_path))
        if reader.shapeTypeName != "POLYGON":
            return None
        field_names = [field[0] for field in reader.fields[1:]]
        if not {"MRGID", "MRGID_EEZ", "GEONAME", "POL_TYPE", "ISO_SOV1", "SOVEREIGN1"}.issubset(field_names):
            return None
        features = []
        names: set[str] = set()
        for shape_record in reader.iterShapeRecords():
            properties = dict(zip(field_names, shape_record.record, strict=True))
            if not _india_record(properties):
                continue
            geometry = shape_record.shape.__geo_interface__
            parsed = shape(geometry)
            if parsed.is_empty or not parsed.is_valid:
                return None
            features.append({"type": "Feature", "geometry": geometry, "properties": properties})
            names.add(str(properties.get("GEONAME") or properties.get("TERRITORY1") or "India"))
    except (OSError, ValueError, shapefile.ShapefileException):
        return None
    if not features:
        return None
    modified_at = datetime.fromtimestamp(shp_path.stat().st_mtime, UTC).isoformat()
    digest = hashlib.sha256()
    with shp_path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return {
        "provider": "Marine Regions / Flanders Marine Institute",
        "dataset": "World EEZ v12 (2023-10-25)", "version": "12",
        "retrieved_at": modified_at, "geometry_source": str(shp_path),
        "source_file_sha256": digest.hexdigest(), "crs": "EPSG:4326",
        "licence": "CC BY 4.0", "licence_source": str(licence_path),
        "evidence_ref": "marine-regions:World_EEZ_v12_20231025:IND",
        "validation_status": "VALIDATED_OFFICIAL_FILE", "region_name": ", ".join(sorted(names)),
        "citation": "Flanders Marine Institute (2023), Maritime Boundaries Geodatabase, version 12. DOI 10.14284/632",
        "features": features,
    }
