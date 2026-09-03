# BLUEJURY AI V2 — Data Limitations

## General

- Endpoint availability does not make evidence current. Observation, analysis, forecast issue, forecast-valid, retrieval, and cache times are separate.
- The latest coordinate can be the end of a forecast horizon. The 2026-09-13 fields are forecasts, not conditions observed on 2026-09-03.
- Catalogue visualization min/max fields are not scientific validity thresholds and did not bound every AOI sample.
- Public unauthenticated ARCO access worked during verification but may change. Only last validated real responses may be fallback data.
- Product IDs/version suffixes can change; metadata drift must quarantine ingestion.
- Verification establishes access/structure, not fish abundance, causality, or vessel safety.

## Chlorophyll

- Cloud/quality gaps are real: only 103/408 AOI cells were valid on 2026-09-01.
- Coastal suspended matter, atmospheric correction, sensor footprints, and algorithms can affect values.
- `CHL` is inferred concentration, not fish observation or PFZ. Uncertainty and flags must accompany it.
- Daily frequency does not imply complete daily coverage.

## SST

- OSTIA is a gap-free Level-4 foundation-temperature analysis, not an instantaneous measurement.
- The 0.05° grid smooths near-shore/sub-grid structure; one AOI cell was land/invalid.
- Kelvin-to-Celsius conversion must be deterministic and provenance-recorded.
- `analysis_error` is uncertainty information, not a safety margin.

## Waves

- ~1/12° model fields may not resolve shoaling, harbour bars, squalls, or coastal bathymetry.
- Uncertainty grows with lead; query the trip-valid time, never simply the latest coordinate.
- `VMDR` is direction **from**. `VTPK` is peak period and is not interchangeable with mean periods.
- The product supplies no vessel-specific safe limit and cannot alone establish hard veto thresholds.

## Currents

- These are model forecasts. “Surface” sampling used the shallowest level, ~0.494 m depth.
- `uo`/`vo` require tested vector derivation and convention handling.
- The model may not resolve tides, harbour flows, or small-scale hazards. Currents remain optional evidence.

## INCOIS/PFZ

- INCOIS ERDDAP was reachable but offered no current selected remote-sensing/wave product.
- Operational channels outside ERDDAP may exist but remain unusable without documented access and terms.
- PFZ REST dissemination is mentioned officially, but public programmatic access was not verified. Do not scrape maps, infer URLs, or manufacture PFZ geometry.

## Licence and TODOs

- Copernicus attribution is required; Phase 2B must recheck raw-subset redistribution, client exposure, and retention terms.
- TODO: define variable-specific freshness and forecast-lead limits.
- TODO: establish valid-cell/uncertainty thresholds for chlorophyll.
- TODO: validate coastal wave skill and vessel-class applicability around Mangaluru–Udupi.
- TODO: select an authoritative marine-warning source and vessel limits; model fields alone are insufficient.
- TODO: decide whether currents justify operational complexity.
- TODO: resolve the chlorophyll product-page CRS label versus dataset-level EPSG:4326 metadata.
- TODO: obtain documented INCOIS PFZ access directly from INCOIS if partnership access is available.
