#!/usr/bin/env python3
"""Reproduce bounded real-data checks for the Karnataka Arabian Sea AOI.

This is a discovery verifier, not a production adapter. It reads official
catalogue metadata and the smallest practical ARCO chunks. It never supplies
fallback values. Output diagnostics are generated only from provider responses.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import subprocess
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import xarray as xr

AOI = {"west": 74.0, "east": 74.7, "south": 12.7, "north": 13.7}
INCOIS_CATALOGUE = (
    "https://erddap.incois.gov.in/erddap/tabledap/allDatasets.csv?"
    "datasetID,title,institution,dataStructure,minLongitude,maxLongitude,"
    "minLatitude,maxLatitude,minTime,maxTime"
)
STAC_ROOT = "https://stac.marine.copernicus.eu/metadata"


@dataclass(frozen=True)
class DatasetCheck:
    key: str
    product_id: str
    dataset_id: str
    variables: tuple[str, ...]
    classification: str
    sample_strategy: str

    @property
    def stac_url(self) -> str:
        return f"{STAC_ROOT}/{self.product_id}/{self.dataset_id}/dataset.stac.json"


DATASETS = (
    DatasetCheck(
        "chlorophyll_a",
        "OCEANCOLOUR_GLO_BGC_L3_NRT_009_101",
        "cmems_obs-oc_glo_bgc-plankton_nrt_l3-multi-4km_P1D_202411",
        ("CHL", "CHL_uncertainty", "flags"),
        "NEAR_REAL_TIME_OBSERVATION",
        "latest AOI time with at least one valid CHL cell",
    ),
    DatasetCheck(
        "sea_surface_temperature",
        "SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001",
        "METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2",
        ("analysed_sst", "analysis_error", "mask"),
        "ANALYSIS",
        "latest AOI time with at least one valid analysed_sst cell",
    ),
    DatasetCheck(
        "waves",
        "GLOBAL_ANALYSISFORECAST_WAV_001_027",
        "cmems_mod_glo_wav_anfc_0.083deg_PT3H-i_202411",
        ("VHM0", "VMDR", "VTPK"),
        "FORECAST",
        "latest available forecast time",
    ),
    DatasetCheck(
        "surface_currents",
        "GLOBAL_ANALYSISFORECAST_PHY_001_024",
        "cmems_mod_glo_phy-cur_anfc_0.083deg_PT6H-i_202406",
        ("uo", "vo"),
        "FORECAST",
        "latest available forecast time at shallowest model level",
    ),
)


def fetch(url: str) -> tuple[bytes, int, dict[str, str]]:
    """Fetch through curl so the host's managed TLS trust configuration is honored."""
    completed = subprocess.run(
        [
            "curl",
            "-fsSL",
            "--max-time",
            "60",
            "--user-agent",
            "BLUEJURY-real-data-verifier/1.0",
            "--write-out",
            "\n%{http_code}",
            url,
        ],
        check=True,
        capture_output=True,
    )
    body, status = completed.stdout.rsplit(b"\n", 1)
    return body, int(status), {}


def finite_diagnostics(array: xr.DataArray) -> dict[str, Any]:
    values = np.asarray(array.values)
    valid = values[np.isfinite(values)]
    result: dict[str, Any] = {
        "valid_cell_count": int(valid.size),
        "total_cell_count": int(values.size),
        "units": array.attrs.get("units"),
    }
    if valid.size:
        result.update(min=float(valid.min()), max=float(valid.max()))
    return result


def subset_at_time(
    dataset: xr.Dataset, check: DatasetCheck, time_index: int
) -> xr.Dataset:
    subset = dataset[sorted(set(check.variables))].isel(time=time_index)
    subset = subset.sel(
        longitude=slice(AOI["west"], AOI["east"]),
        latitude=slice(AOI["south"], AOI["north"]),
    )
    if "elevation" in subset.dims:
        subset = subset.isel(elevation=-1)
    return subset.load()


def verify_dataset(check: DatasetCheck) -> dict[str, Any]:
    stac_bytes, stac_status, _ = fetch(check.stac_url)
    stac = json.loads(stac_bytes)
    assets = stac["assets"]
    zarr_url = assets["timeChunked"]["href"]
    metadata_url = f"{zarr_url}/.zmetadata"
    zmetadata_bytes, zmetadata_status, zmetadata_headers = fetch(metadata_url)

    dataset = xr.open_zarr(zarr_url, consolidated=True)
    missing_variables = sorted(set(check.variables) - set(dataset.variables))
    if missing_variables:
        raise RuntimeError(f"{check.dataset_id} is missing {missing_variables}")

    latest_index = dataset.sizes["time"] - 1
    sample_index = latest_index
    primary = check.variables[0]
    if check.classification in {"ANALYSIS", "NEAR_REAL_TIME_OBSERVATION"}:
        for candidate in range(latest_index, max(-1, latest_index - 15), -1):
            sample = subset_at_time(dataset, check, candidate)
            if finite_diagnostics(sample[primary])["valid_cell_count"] > 0:
                sample_index = candidate
                break
        else:
            raise RuntimeError(f"no valid {primary} cells in latest 15 time steps")
    sample = subset_at_time(dataset, check, sample_index)

    dimensions = stac["properties"]["cube:dimensions"]
    variables = stac["properties"]["cube:variables"]
    return {
        "provider": "Copernicus Marine Service",
        "product_id": check.product_id,
        "dataset_id": check.dataset_id,
        "title": stac["properties"].get("title", check.dataset_id),
        "classification": check.classification,
        "aoi": AOI,
        "catalogue_request": check.stac_url,
        "catalogue_http_status": stac_status,
        "data_request": zarr_url,
        "data_metadata_request": metadata_url,
        "data_metadata_http_status": zmetadata_status,
        "data_last_modified": zmetadata_headers.get("Last-Modified"),
        "authentication_used": False,
        "dataset_latest_time": str(dataset.time.values[-1]),
        "sample_time": str(dataset.time.values[sample_index]),
        "sample_strategy": check.sample_strategy,
        "longitude": dimensions["longitude"],
        "latitude": dimensions["latitude"],
        "spatial_coverage": stac["bbox"],
        "temporal_coverage": dimensions["time"],
        "variables": {
            name: {
                "metadata": variables[name],
                "sample": finite_diagnostics(sample[name]),
            }
            for name in check.variables
        },
        "stac_sha256": hashlib.sha256(stac_bytes).hexdigest(),
        "zmetadata_sha256": hashlib.sha256(zmetadata_bytes).hexdigest(),
        "verification_status": "VERIFIED",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    retrieved_at = datetime.now(UTC).isoformat()
    results: dict[str, Any] = {
        "schema_version": 1,
        "retrieved_at_utc": retrieved_at,
        "aoi": AOI,
        "incois": {},
        "copernicus": {},
    }
    catalogue, status, headers = fetch(INCOIS_CATALOGUE)
    results["incois"] = {
        "catalogue_request": INCOIS_CATALOGUE,
        "http_status": status,
        "last_modified": headers.get("Last-Modified"),
        "sha256": hashlib.sha256(catalogue).hexdigest(),
        "row_count_excluding_headers": max(0, len(catalogue.decode().splitlines()) - 2),
    }
    for check in DATASETS:
        results["copernicus"][check.key] = verify_dataset(check)

    # Reject non-finite JSON values rather than silently serializing NaN/Infinity.
    encoded = json.dumps(results, indent=2, sort_keys=True, allow_nan=False)
    if not all(
        math.isfinite(value)
        for item in results["copernicus"].values()
        for var in item["variables"].values()
        for value in (var["sample"].get("min", 0), var["sample"].get("max", 0))
    ):
        raise RuntimeError("non-finite diagnostic escaped validation")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(encoded + "\n", encoding="utf-8")
    print(encoded)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
