from __future__ import annotations

import json
import math
import time
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any
from uuid import uuid4

import numpy as np
import xarray as xr

from bluejury.adapters.marine_regions import load_india_eez
from bluejury.adapters.protected_planet import load_protected_areas
from bluejury.adapters.protected_planet_local import load_india_protected_areas
from bluejury.adapters.wii_biodiversity_context import load_mulki_pavanje_context
from bluejury.config.settings import get_settings
from bluejury.jurors.border import evaluate_border
from bluejury.jurors.ecology import evaluate_ecology
from bluejury.schemas.mvp import AnalyzeRequest, AnalyzeResponse

ROOT = Path(__file__).resolve().parents[5]
CACHE = ROOT / "data" / "cache" / "copernicus"
POLICY = json.loads((ROOT / "config" / "mvp_policy.json").read_text())
SOURCES = {
    "chl": (
        "OCEANCOLOUR_GLO_BGC_L3_NRT_009_101",
        "cmems_obs-oc_glo_bgc-plankton_nrt_l3-multi-4km_P1D_202411",
        "https://s3.waw3-1.cloudferro.com/mdl-arco-time-043/arco/OCEANCOLOUR_GLO_BGC_L3_NRT_009_101/cmems_obs-oc_glo_bgc-plankton_nrt_l3-multi-4km_P1D_202411/timeChunked.zarr",
    ),
    "sst": (
        "SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001",
        "METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2",
        "https://s3.waw3-1.cloudferro.com/mdl-arco-time-045/arco/SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001/METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2/timeChunked.zarr",
    ),
    "wave": (
        "GLOBAL_ANALYSISFORECAST_WAV_001_027",
        "cmems_mod_glo_wav_anfc_0.083deg_PT3H-i_202411",
        "https://s3.waw3-1.cloudferro.com/mdl-arco-time-015/arco/GLOBAL_ANALYSISFORECAST_WAV_001_027/cmems_mod_glo_wav_anfc_0.083deg_PT3H-i_202411/timeChunked.zarr",
    ),
}
MARINE_MEMORY_TTL_SECONDS = 300.0
MARINE_CACHED_FALLBACK_TTL_SECONDS = 60.0
_marine_memory: dict[tuple[float, float, str], tuple[dict[str, Any], bool, float]] = {}
_marine_memory_lock = Lock()
_reference_memory: dict[tuple[object, object, object, object, str | None], tuple[dict[str, Any] | None, dict[str, Any] | None, dict[str, Any] | None]] = {}
_reference_memory_lock = Lock()


def haversine(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371.0088 * 2 * math.asin(math.sqrt(h))


def route(start: tuple[float, float], end: tuple[float, float]) -> dict[str, Any]:
    coords = [
        [start[1] + (end[1] - start[1]) * i / 8, start[0] + (end[0] - start[0]) * i / 8]
        for i in range(9)
    ]
    return {
        "route_id": str(uuid4()),
        "distance_km": haversine(start, end),
        "geometry": {"type": "LineString", "coordinates": coords},
        "segments": [{"start": coords[i], "end": coords[i + 1]} for i in range(8)],
        "notice": "Decision-support route — not navigational guidance",
    }


def evidence(
    name: str,
    variable: str,
    valid_time: str,
    unit: str,
    cached: bool,
    retrieved_at: str,
) -> dict[str, Any]:
    product, dataset, _ = SOURCES[name]
    return {
        "evidence_ref": f"{name}:{variable}:{valid_time}",
        "provider": "Copernicus Marine Service",
        "product_id": product,
        "dataset_id": dataset,
        "variable": variable,
        "unit": unit,
        "valid_time": valid_time,
        "retrieved_at": retrieved_at,
        "classification": {
            "chl": "RECENT_SATELLITE_OBSERVATION",
            "sst": "ANALYSIS",
            "wave": "FORECAST",
        }[name],
        "freshness": "CACHED" if cached else "CURRENT",
        "quality_information": "Provider fill values decoded and excluded",
    }


def load_real(request: AnalyzeRequest) -> tuple[dict[str, Any], bool]:
    key = (request.start.latitude, request.start.longitude, request.departure_at.isoformat())
    now = time.monotonic()
    with _marine_memory_lock:
        remembered = _marine_memory.get(key)
    if remembered is not None:
        payload, cached, loaded_at = remembered
        ttl = MARINE_CACHED_FALLBACK_TTL_SECONDS if cached else MARINE_MEMORY_TTL_SECONDS
        if now - loaded_at < ttl:
            return payload, cached
    CACHE.mkdir(parents=True, exist_ok=True)
    cache_file = CACHE / "latest.json"
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            west, east = request.start.longitude - 0.75, request.start.longitude + 0.15
            south, north = request.start.latitude - 0.5, request.start.latitude + 0.5
            chl_ds = xr.open_zarr(SOURCES["chl"][2], consolidated=True)
            chl = (
                chl_ds[["CHL", "CHL_uncertainty", "flags"]]
                .isel(time=-1)
                .sel(longitude=slice(west, east), latitude=slice(south, north))
                .load()
            )
            sst_ds = xr.open_zarr(SOURCES["sst"][2], consolidated=True)
            sst = (
                sst_ds[["analysed_sst", "analysis_error", "mask"]]
                .sel(time=chl.time, method="nearest")
                .sel(longitude=slice(west, east), latitude=slice(south, north))
                .load()
            )
            wav_ds = xr.open_zarr(SOURCES["wave"][2], consolidated=True)
            wave = (
                wav_ds[["VHM0", "VMDR", "VTPK"]]
                .sel(
                    time=np.datetime64(request.departure_at.replace(tzinfo=None)), method="nearest"
                )
                .sel(longitude=slice(west, east), latitude=slice(south, north))
                .load()
            )
            payload = {
                "retrieved_at": datetime.now(UTC).isoformat(),
                "provider": "Copernicus Marine Service",
                "chl_time": str(chl.time.values),
                "sst_time": str(sst.time.values),
                "wave_time": str(wave.time.values),
                "chl": {
                    "lat": chl.latitude.values.tolist(),
                    "lon": chl.longitude.values.tolist(),
                    "value": np.nan_to_num(chl.CHL.values, nan=-999).tolist(),
                    "uncertainty": np.nan_to_num(chl.CHL_uncertainty.values, nan=-999).tolist(),
                },
                "sst": {
                    "lat": sst.latitude.values.tolist(),
                    "lon": sst.longitude.values.tolist(),
                    "value": np.nan_to_num(sst.analysed_sst.values, nan=-999).tolist(),
                },
                "wave": {
                    "lat": wave.latitude.values.tolist(),
                    "lon": wave.longitude.values.tolist(),
                    "height": np.nan_to_num(wave.VHM0.values, nan=-999).tolist(),
                    "direction": np.nan_to_num(wave.VMDR.values, nan=-999).tolist(),
                    "period": np.nan_to_num(wave.VTPK.values, nan=-999).tolist(),
                },
            }
            cache_file.write_text(json.dumps(payload))
            with _marine_memory_lock:
                _marine_memory[key] = (payload, False, time.monotonic())
            return payload, False
        except Exception as exc:
            last_error = exc
            if attempt == 0:
                time.sleep(0.5)
    if cache_file.exists():
        payload = json.loads(cache_file.read_text())
        with _marine_memory_lock:
            _marine_memory[key] = (payload, True, time.monotonic())
        return payload, True
    raise RuntimeError("Marine evidence unavailable and no validated cache exists") from last_error


def circle(lon: float, lat: float, radius_km: float) -> dict[str, Any]:
    pts = []
    for i in range(25):
        angle = 2 * math.pi * i / 24
        pts.append(
            [
                lon + radius_km * math.cos(angle) / (111.32 * math.cos(math.radians(lat))),
                lat + radius_km * math.sin(angle) / 110.57,
            ]
        )
    return {"type": "Polygon", "coordinates": [pts]}


def nearest(grid: dict[str, Any], key: str, lat: float, lon: float) -> float:
    yi = int(np.abs(np.asarray(grid["lat"]) - lat).argmin())
    xi = int(np.abs(np.asarray(grid["lon"]) - lon).argmin())
    return float(grid[key][yi][xi])


def scorecards(
    candidate: dict[str, Any],
    request: AnalyzeRequest,
    real: dict[str, Any],
    cached: bool,
    ecology_reference: dict[str, Any] | None,
    border_reference: dict[str, Any] | None,
    ecology_context: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    distance = candidate["route"]["distance_km"]
    base = 2 * distance * request.boat.burn_rate_l_per_km
    required = base * (1 + request.boat.reserve_fraction)
    margin = request.boat.fuel_available_l - required
    max_wave = max(
        nearest(real["wave"], "height", p[1], p[0])
        for p in candidate["route"]["geometry"]["coordinates"]
    )
    threshold = POLICY["max_significant_wave_height_m"][request.boat.vessel_class]
    common = {
        "zone_id": candidate["zone_id"],
        "checked_at": datetime.now(UTC).isoformat(),
        "confidence": 0.72 if cached else 0.86,
    }
    return [
        {
            **common,
            "agent": "catch",
            "score": round(candidate["catch_suitability"]),
            "veto": False,
            "reason_codes": ["RELATIVE_CHL_SST_SUITABILITY"],
            "reason": f"CHL is at the {candidate['chl_percentile']:.0f}th percentile of this AOI; SST context and uncertainty are included.",
            "evidence_references": candidate["evidence_refs"],
        },
        {
            **common,
            "agent": "safety",
            "score": max(0, round(100 - 50 * max_wave / threshold)),
            "veto": max_wave > threshold,
            "reason_codes": [
                "WAVE_LIMIT_EXCEEDED" if max_wave > threshold else "WAVE_WITHIN_MVP_POLICY"
            ],
            "reason": f"Maximum route-segment significant wave height is {max_wave:.2f} m versus {threshold:.2f} m MVP policy threshold.",
            "evidence_references": [f"wave:VHM0:{real['wave_time']}"],
            "details": {
                "max_wave_m": max_wave,
                "threshold_m": threshold,
                "notice": POLICY["notice"],
            },
        },
        {
            **common,
            "agent": "fuel",
            "score": max(0, min(100, round(50 + 50 * margin / request.boat.fuel_available_l))),
            "veto": margin < 0,
            "reason_codes": ["FUEL_INSUFFICIENT" if margin < 0 else "FUEL_RESERVE_MET"],
            "reason": f"Round-trip requirement {required:.1f} L; fuel margin {margin:.1f} L after reserve.",
            "evidence_references": [],
            "details": {
                "round_trip_distance_km": 2 * distance,
                "base_fuel_l": base,
                "required_fuel_l": required,
                "margin_l": margin,
            },
        },
        evaluate_ecology(
            candidate["zone_id"], candidate["geometry"], candidate["route"]["geometry"],
            ecology_reference, POLICY["ecology_near_distance_km"],
            footprint_role=candidate.get("geometry_role"),
            destination_lonlat=(candidate["centroid"]["longitude"], candidate["centroid"]["latitude"]),
            supplementary_context=ecology_context,
        ),
        evaluate_border(
            candidate["zone_id"], candidate["geometry"], candidate["route"]["geometry"],
            border_reference, POLICY["border_near_distance_km"],
            footprint_role=candidate.get("geometry_role"),
            destination_lonlat=(candidate["centroid"]["longitude"], candidate["centroid"]["latitude"]),
        ),
    ]


def load_references() -> tuple[dict[str, Any] | None, dict[str, Any] | None, dict[str, Any] | None]:
    """Reuse validated static reference data for the lifetime of this backend process."""
    settings = get_settings()
    key = (
        load_india_protected_areas, load_protected_areas, load_mulki_pavanje_context,
        load_india_eez, settings.protected_planet_api_token,
    )
    with _reference_memory_lock:
        remembered = _reference_memory.get(key)
        if remembered is not None:
            return remembered
        ecology_reference = load_india_protected_areas(ROOT / "data" / "reference" / "protected-planet")
        if ecology_reference is None:
            ecology_reference = load_protected_areas(
                settings.protected_planet_api_token,
                ROOT / "data" / "cache" / "protected-planet" / "india-marine-v4.json",
            )
        references = (
            ecology_reference,
            load_mulki_pavanje_context(ROOT / "data" / "reference" / "wii-icmba"),
            load_india_eez(ROOT / "data" / "reference" / "marine-regions"),
        )
        _reference_memory[key] = references
        return references


def scorecard_is_eligible(card: dict[str, Any]) -> bool:
    """Exclude only unsupported Ecology assessment scores; hard vetoes remain separate."""
    if card.get("agent") != "ecology":
        return True
    return bool(card.get("confidence", 0) > 0 and "DATA_UNAVAILABLE" not in card.get("reason_codes", []))


def negotiate_score(cards: list[dict[str, Any]], weights: dict[str, float]) -> tuple[float, list[str]]:
    eligible = [card for card in cards if scorecard_is_eligible(card)]
    eligible_weight = sum(weights.get(card["agent"], 0) for card in eligible)
    excluded = [card["agent"] for card in cards if not scorecard_is_eligible(card)]
    if eligible_weight <= 0:
        return 0.0, excluded
    score = float(sum(weights.get(card["agent"], 0) * card["score"] for card in eligible) / eligible_weight)
    return score, excluded


def negotiation_confidence(cards: list[dict[str, Any]], weights: dict[str, float]) -> float:
    eligible = [card for card in cards if scorecard_is_eligible(card)]
    eligible_weight = sum(weights.get(card["agent"], 0) for card in eligible)
    if eligible_weight <= 0:
        return 0.0
    return float(
        sum(weights.get(card["agent"], 0) * card["confidence"] for card in eligible)
        / eligible_weight
    )


def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    real, cached = load_real(request)
    ecology_reference, ecology_context, border_reference = load_references()
    chl = np.asarray(real["chl"]["value"], dtype=float)
    valid = chl != -999
    values = chl[valid]
    if not values.size:
        raise RuntimeError("No valid chlorophyll cells in AOI")
    ranked = np.argsort(chl.ravel())[::-1]
    chosen: list[tuple[float, float, float]] = []
    for flat in ranked:
        y, x = np.unravel_index(flat, chl.shape)
        if not valid[y, x]:
            continue
        lat = float(real["chl"]["lat"][y])
        lon = float(real["chl"]["lon"][x])
        value = float(chl[y, x])
        if all(
            haversine((lat, lon), (p[0], p[1])) >= POLICY["candidate_min_separation_km"]
            for p in chosen
        ):
            chosen.append((lat, lon, value))
        if len(chosen) == 3:
            break
    if request.selected_area:
        chosen.insert(
            0,
            (
                request.selected_area.latitude,
                request.selected_area.longitude,
                nearest(
                    real["chl"],
                    "value",
                    request.selected_area.latitude,
                    request.selected_area.longitude,
                ),
            ),
        )
    candidates: list[dict[str, Any]] = []
    start = (request.start.latitude, request.start.longitude)
    for index, (lat, lon, chl_value) in enumerate(chosen):
        percentile = 100 * float((values <= chl_value).mean()) if chl_value != -999 else 0
        sst = nearest(real["sst"], "value", lat, lon)
        suitability = 0.8 * percentile + 0.2 * (80 if sst != -999 else 0)
        item: dict[str, Any] = {
            "zone_id": f"ZONE-{chr(65 + index)}",
            "user_selected": bool(request.selected_area and index == 0),
            "centroid": {"latitude": lat, "longitude": lon},
            "geometry": circle(lon, lat, POLICY["candidate_radius_km"]),
            "geometry_role": "DISCOVERY_FOOTPRINT",
            "chl": None if chl_value == -999 else chl_value,
            "chl_percentile": percentile,
            "sst_kelvin": None if sst == -999 else sst,
            "coverage": float(valid.mean()),
            "confidence": 0.72 if cached else 0.86,
            "catch_suitability": suitability,
            "evidence_refs": [
                f"chl:CHL:{real['chl_time']}",
                f"sst:analysed_sst:{real['sst_time']}",
            ],
            "route": route(start, (lat, lon)),
        }
        item["juror_scorecards"] = scorecards(
            item, request, real, cached, ecology_reference, border_reference, ecology_context
        )
        item["vetoes"] = [s for s in item["juror_scorecards"] if s["veto"]]
        candidates.append(item)
    feasible = [c for c in candidates if not c["vetoes"]]
    weights = request.priorities
    for c in feasible:
        c["negotiated_score"], excluded = negotiate_score(c["juror_scorecards"], weights)
        c["negotiation_details"] = {
            "excluded_agents": excluded,
            "eligible_agents": [
                card["agent"] for card in c["juror_scorecards"] if scorecard_is_eligible(card)
            ],
            "weights_renormalized": bool(excluded),
        }
    feasible.sort(
        key=lambda c: (
            c["negotiated_score"],
            c["juror_scorecards"][1]["score"],
            -c["route"]["distance_km"],
        ),
        reverse=True,
    )
    winner = feasible[0] if feasible else None
    verdict = "NO_GO" if not winner else "CAUTIOUS_GO"
    why: list[str] = []
    if winner:
        why = [
            "Strong relative chlorophyll signal in the analysed AOI",
            "Route survives configured MVP wave and fuel feasibility checks",
        ]
        ecology = next(card for card in winner["juror_scorecards"] if card["agent"] == "ecology")
        border = next(card for card in winner["juror_scorecards"] if card["agent"] == "border")
        if scorecard_is_eligible(ecology):
            why.append(ecology["reason"])
        else:
            why.append("Ecology was excluded from weighted negotiation because coverage was insufficient; no ecological clearance is asserted.")
        why.append(border["reason"])
    ev = [
        evidence("chl", "CHL", real["chl_time"], "milligram m-3", cached, real["retrieved_at"]),
        evidence("sst", "analysed_sst", real["sst_time"], "kelvin", cached, real["retrieved_at"]),
        evidence(
            "wave",
            "VHM0, VMDR, VTPK",
            real["wave_time"],
            "m, degree, s",
            cached,
            real["retrieved_at"],
        ),
    ]
    return AnalyzeResponse(
        verdict=verdict,
        recommended_zone=winner,
        candidates=candidates,
        evidence=ev,
        hard_veto_trace=[
            {"zone_id": c["zone_id"], "vetoes": c["vetoes"]} for c in candidates if c["vetoes"]
        ],
        why_winner_won=why,
        overall_confidence=negotiation_confidence(winner["juror_scorecards"], weights)
        if winner
        else 0.7,
        freshness_summary="CACHED real provider response"
        if cached
        else "Three verified Copernicus sources",
        generated_at=datetime.now(UTC),
        policy_version=POLICY["version"],
    )
