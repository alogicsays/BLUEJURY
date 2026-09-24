"""Load the provenance-controlled WII Mulki-Pavanje point-context record."""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any

from shapely.geometry import shape

LOGGER = logging.getLogger(__name__)

EXPECTED_RECORD_ID = "wii-icmba-2013-mulki-pavanje"
EXPECTED_EVIDENCE_REF = "wii:icmba:2013:mulki-pavanje"
EXPECTED_COORDINATES = (74.7877833333, 13.09725)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_mulki_pavanje_context(reference_dir: Path) -> dict[str, Any] | None:
    """Validate and load the WII record without deriving an area from its point."""
    path = reference_dir / "mulki-pavanje-2013.json"
    if not path.is_file():
        LOGGER.warning("WII supplementary context omitted: reference file is missing at %s", path)
        return None
    try:
        raw: Any = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            raise ValueError("record must be a JSON object")
        geometry = raw.get("geometry")
        if not isinstance(geometry, dict):
            raise ValueError("geometry must be a GeoJSON object")
        parsed = shape(geometry)
        source_pages = raw.get("source_pages")
        limitations = raw.get("source_limitations")
        coordinates = tuple(parsed.coords[0]) if parsed.geom_type == "Point" else ()
        valid = (
            raw.get("schema_version") == 1
            and raw.get("record_id") == EXPECTED_RECORD_ID
            and raw.get("provider") == "Wildlife Institute of India"
            and raw.get("publication_year") == 2013
            and raw.get("geometry_semantics") == "POINT_CONTEXT_ONLY"
            and raw.get("designation_status") == "NOTIFICATION_NOT_VERIFIED"
            and raw.get("fishing_restriction_status") == "NONE_VERIFIED"
            and raw.get("legal_effect") == "NONE_ASSERTED"
            and raw.get("evidence_ref") == EXPECTED_EVIDENCE_REF
            and coordinates == EXPECTED_COORDINATES
            and isinstance(source_pages, dict)
            and source_pages.get("coordinate_table") == 143
            and source_pages.get("site_narrative") == 158
            and isinstance(limitations, list)
            and bool(limitations)
            and parsed.is_valid
            and not parsed.is_empty
        )
        if not valid:
            raise ValueError("record failed WII point-context validation")
    except (
        OSError,
        UnicodeError,
        json.JSONDecodeError,
        AttributeError,
        TypeError,
        ValueError,
        KeyError,
    ) as exc:
        LOGGER.warning("WII supplementary context omitted: %s", exc)
        return None

    return {**raw, "reference_file": str(path), "reference_file_sha256": _sha256(path)}
