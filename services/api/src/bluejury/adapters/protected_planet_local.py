"""Validate the official, manually downloaded September 2026 India WDPCA extract."""

from __future__ import annotations

import csv
import hashlib
import io
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import shapefile  # type: ignore[import-untyped]
from pyproj import CRS
from shapely.geometry import shape

RELEASE = "Sep2026"
ARCHIVE_PREFIX = f"WDPA_WDOECM_{RELEASE}_Public_IND_shp"
REQUIRED_FIELDS = {
    "SITE_ID", "SITE_PID", "SITE_TYPE", "NAME", "REALM", "NO_TAKE",
    "NO_TK_AREA", "STATUS", "METADATAID", "ISO3", "PRNT_ISO3",
    "DESIG", "GOV_TYPE",
}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_india_protected_areas(reference_dir: Path) -> dict[str, Any] | None:
    """Read all three official ZIP parts; never infer missing polygons from points."""
    directory = reference_dir / "india-wdpca-2026-09"
    archives = [directory / f"{ARCHIVE_PREFIX}_{part}.zip" for part in range(3)]
    sources_path = directory / f"WDPA_sources_{RELEASE}.csv"
    readme_path = directory / "Shapefile_splitting_README.txt"
    if not all(path.is_file() for path in [*archives, sources_path, readme_path]):
        return None

    features: list[dict[str, Any]] = []
    point_records: list[dict[str, Any]] = []
    seen_parcels: set[tuple[str, str, str]] = set()
    metadata_ids: set[str] = set()
    try:
        if "three" not in readme_path.read_text(encoding="utf-8").casefold():
            return None
        with sources_path.open(encoding="utf-8-sig", newline="") as source:
            source_rows = {row["METADATAID"]: row for row in csv.DictReader(source)}
        if not source_rows:
            return None
        for archive in archives:
            with zipfile.ZipFile(archive) as contents:
                if contents.testzip() is not None:
                    return None
                for kind in ("polygons", "points"):
                    stem = f"{ARCHIVE_PREFIX}-{kind}"
                    names = {f"{stem}{suffix}" for suffix in (".shp", ".shx", ".dbf", ".prj", ".cpg")}
                    if not names.issubset(contents.namelist()):
                        return None
                    if CRS.from_wkt(contents.read(f"{stem}.prj").decode("utf-8")).to_epsg() != 4326:
                        return None
                    reader = shapefile.Reader(
                        shp=io.BytesIO(contents.read(f"{stem}.shp")),
                        shx=io.BytesIO(contents.read(f"{stem}.shx")),
                        dbf=io.BytesIO(contents.read(f"{stem}.dbf")),
                        encoding=contents.read(f"{stem}.cpg").decode("ascii").strip(),
                    )
                    if reader.shapeTypeName != ("POLYGON" if kind == "polygons" else "MULTIPOINT"):
                        return None
                    fields = [field[0] for field in reader.fields[1:]]
                    if not REQUIRED_FIELDS.issubset(fields):
                        return None
                    for record in reader.iterShapeRecords():
                        attributes = record.record.as_dict()
                        site_id = str(attributes["SITE_ID"])
                        parcel_id = str(attributes["SITE_PID"])
                        key = (kind, site_id, parcel_id)
                        if key in seen_parcels or attributes["ISO3"] != "IND":
                            return None
                        seen_parcels.add(key)
                        metadata_id = str(attributes["METADATAID"])
                        if metadata_id not in source_rows:
                            return None
                        metadata_ids.add(metadata_id)
                        geometry = record.shape.__geo_interface__
                        parsed = shape(geometry)
                        if parsed.is_empty or not parsed.is_valid:
                            return None
                        properties = {
                            "site_id": site_id, "site_pid": parcel_id,
                            "site_type": attributes["SITE_TYPE"], "realm": attributes["REALM"],
                            "name": attributes.get("NAME_ENG") or attributes["NAME"],
                            "designation": attributes.get("DESIG_ENG") or attributes.get("DESIG"),
                            "governance": attributes.get("GOV_TYPE"),
                            "no_take_status": attributes["NO_TAKE"],
                            "no_take_area_km2": attributes.get("NO_TK_AREA"),
                            "legal_status": attributes["STATUS"],
                            "metadata_id": metadata_id,
                            "source_title": source_rows[metadata_id]["DATA_TITLE"],
                            "source_responsible_party": source_rows[metadata_id]["RESP_PARTY"],
                            "source_update_year": source_rows[metadata_id]["UPDATE_YR"],
                        }
                        feature = {"type": "Feature", "geometry": geometry, "properties": properties}
                        if kind == "polygons":
                            features.append(feature)
                        else:
                            point_records.append(feature)
        if len(features) != 63 or len(point_records) != 27:
            return None
    except (OSError, ValueError, KeyError, UnicodeError, zipfile.BadZipFile, shapefile.ShapefileException):
        return None

    imported_at = datetime.now(UTC).isoformat()
    checksums = {path.name: _sha256(path) for path in [*archives, sources_path, readme_path]}
    return {
        "provider": "Protected Planet / UNEP-WCMC and IUCN",
        "dataset": "World Database on Protected and Conserved Areas, public India extract",
        "classification": "STATIC_REFERENCE",
        "version": "September 2026", "release_month": "2026-09",
        "retrieved_at": None, "imported_at": imported_at,
        "geometry_source": str(directory), "crs": "EPSG:4326",
        "original_filenames": [path.name for path in archives],
        "source_file_sha256": checksums,
        "source_metadata_ids": sorted(metadata_ids),
        "evidence_ref": "protected-planet:WDPCA:2026-09:IND-public",
        "validation_status": "VALIDATED_OFFICIAL_FILE",
        "coverage_complete": False,
        "coverage_note": "India withholds protected-area records from the public extract; point-only sites have no evaluable area boundary.",
        "licence": "Protected Planet non-commercial terms; no redistribution",
        "licence_url": "https://www.protectedplanet.net/en/legal",
        "download_url": "https://www.protectedplanet.net/country/IND",
        "citation": "UNEP-WCMC and IUCN (2026), Protected Planet: World Database on Protected and Conserved Areas, September 2026, Cambridge, UK.",
        "features": features, "point_records": point_records,
    }
