# BLUEJURY AI V2 — Real-Data Discovery Report

## Method

Official INCOIS and Copernicus services were queried for the bounded 74.0–74.7°E, 12.7–13.7°N AOI. Xarray selected only required AOI/time chunks from public Copernicus ARCO Zarr assets; no global scientific array was downloaded. Run time: **2026-09-03T12:54:02.615342Z**.

Reproduce:

```bash
services/api/.venv/bin/pip install -r scripts/data_verification/requirements.txt
services/api/.venv/bin/python scripts/data_verification/verify_marine_sources.py \
  --output data/verification/latest/verification-results.json
```

The verifier uses no credentials. It records official requests, HTTP results, checksums, timestamps, grid metadata, valid-cell counts, and min/max diagnostics derived from responses. Diagnostics are not defaults, thresholds, or demo data.

## Actual results

- **INCOIS catalogue:** HTTP 200, 17 rows, SHA-256 `d357d27aa697606eb3f5792a429e095a7323ddf86a9ad50c0375d635b35b6d47`. Relevant remote-sensing datasets are stale; no wave/PFZ dataset was listed.
- **Chlorophyll:** STAC 200, Zarr metadata 200; 2026-09-01; `CHL` 103/408 valid AOI cells, diagnostic 2.0344457626–8.5613832474 `milligram m-3`; uncertainty 103 valid, 14.2199996822–57.9099987056 `%`.
- **OSTIA SST:** STAC 200, Zarr metadata 200; 2026-09-02; `analysed_sst` 279/280 valid, 300.1599932928–301.8099932559 `kelvin`; `analysis_error` 279 valid, 0.2199999951–0.5199999884 `kelvin`.
- **Waves:** STAC 200, Zarr metadata 200; latest 2026-09-13 forecast-valid; `VHM0` 105/108 valid, 1.0199999772–1.5899999645 `m`; `VMDR` 107 valid, 220.0199991055–240.3899986502° from; `VTPK` 105 valid, 15.8399996459–16.1999996379 `s`.
- **Currents:** STAC 200, Zarr metadata 200; latest 2026-09-13 forecast-valid at −0.494 m; `uo` 108/108 valid, −0.0496944226–0.0719555542 `m s-1`; `vo` 108/108 valid, −0.1770120710–0.0424469449 `m s-1`.

## Provider errors encountered

1. Python `urllib` could not validate the environment-managed TLS issuer for INCOIS. System `curl` validated the same HTTPS endpoint. The script therefore calls `curl` without disabling TLS verification.
2. The first Zarr run received a Copernicus `ServerDisconnectedError` during a coordinate chunk read. An unchanged retry succeeded. Production needs bounded retries and last-validated caching.
3. No Copernicus credentials were present. Public STAC and HTTP ARCO Zarr nevertheless returned metadata and data. Official Toolbox/subsetter workflows may require a free account.

## Final selection table

| BLUEJURY VARIABLE | SELECTED PROVIDER | EXACT PRODUCT/DATASET | EXACT VARIABLE | UNITS | DATA TYPE | SPATIAL RESOLUTION | UPDATE/TEMPORAL FREQUENCY | LATEST VERIFIED DATA TIME | ACCESS METHOD | AUTH REQUIRED | VERIFICATION STATUS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Chlorophyll-a | Copernicus Marine | `OCEANCOLOUR_GLO_BGC_L3_NRT_009_101` / `cmems_obs-oc_glo_bgc-plankton_nrt_l3-multi-4km_P1D_202411` | `CHL`, plus uncertainty/flags | `milligram m-3`, `%` | NEAR_REAL_TIME_OBSERVATION | 0.04166667° (~4 km) | Daily; update 22:00 | 2026-09-01T00:00Z | STAC + HTTP Zarr | No, tested path | VERIFIED |
| Foundation SST | Copernicus Marine | `SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001` / `METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2` | `analysed_sst`, error/mask | `kelvin` | ANALYSIS | 0.05° (~6 km) | Daily; update 12:00 | 2026-09-02T00:00Z | STAC + HTTP Zarr | No, tested path | VERIFIED |
| Significant wave height | Copernicus Marine | `GLOBAL_ANALYSISFORECAST_WAV_001_027` / `cmems_mod_glo_wav_anfc_0.083deg_PT3H-i_202411` | `VHM0` | `m` | FORECAST | 0.0833333° (~9 km) | 3-hourly; updates 00/12 UTC | 2026-09-13T00:00Z forecast-valid | STAC + HTTP Zarr | No, tested path | VERIFIED |
| Wave direction | Copernicus Marine | same | `VMDR` | `degree` from | FORECAST | 0.0833333° | 3-hourly; twice daily | 2026-09-13T00:00Z forecast-valid | STAC + HTTP Zarr | No, tested path | VERIFIED |
| Peak period | Copernicus Marine | same | `VTPK` | `s` | FORECAST | 0.0833333° | 3-hourly; twice daily | 2026-09-13T00:00Z forecast-valid | STAC + HTTP Zarr | No, tested path | VERIFIED |
| Surface currents | Copernicus Marine | `GLOBAL_ANALYSISFORECAST_PHY_001_024` / `cmems_mod_glo_phy-cur_anfc_0.083deg_PT6H-i_202406` | `uo`, `vo` | `m s-1` | FORECAST | 0.0833333°, 50 depths | 6-hourly; daily update | 2026-09-13T00:00Z forecast-valid | STAC + HTTP Zarr | No, tested path | VERIFIED |
| Official PFZ | None | No endpoint/dataset verified | — | — | official advisory | — | — | — | — | Unknown | NOT_VERIFIED |

## Rejected datasets / sources

- INCOIS `IRS_chlorophyll_datasets`, `incois_oceansat2_datasets`, `NOAA_AVHRR_AMSR_datasets`, `incois_tmi_3day_datasets`, `ascat_daily_datasets`: official but too old for current decisions.
- Copernicus `OCEANCOLOUR_GLO_BGC_L4_NRT_009_102`: initial selection rejected because its gap-filling/interpolation adds assumptions; Level-3 preserves observable missingness/uncertainty.
- Copernicus 300 m OLCI chlorophyll: not selected initially because of larger operating cost and single-sensor/coverage trade-offs; 4 km multi-sensor fits this AOI and hackathon scope.
- `WAVE_GLO_PHY_SWH_L4_NRT_014_003`: too coarse and not forward-looking; the 1/12° forecast supports trip-time checks.
- Reprocessed OSTIA SST: historical rather than the current analysis stream.
- Any inferred PFZ URL: no documented endpoint/schema/sample; scraping was not attempted.

## Phase 2B recommendation

Implement evidence adapters for verified Copernicus chlorophyll, OSTIA SST, and wave forecasts. Add currents only if reviewed policy consumes vectors; it should not delay primary inputs. Keep PFZ unavailable. Adapters must validate STAC metadata, retrieve only AOI/time subsets, preserve missingness/uncertainty, and retain timestamped last-known-good real responses.
