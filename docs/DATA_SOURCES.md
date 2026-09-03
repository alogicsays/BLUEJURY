# BLUEJURY AI V2 — Verified Data Source Register

Verification: 2026-09-03T12:54:02.615342Z. Test AOI: 74.0–74.7°E, 12.7–13.7°N, offshore of Mangaluru–Udupi. Machine record: `data/verification/2026-09-03/verification-results.json`.

`VERIFIED` means official metadata and a bounded real subset were retrieved and inspected. It does not approve scientific thresholds or juror use.

## Selected sources

### Chlorophyll-a — VERIFIED

- Provider: Copernicus Marine Service; ACRI-ST.
- Product: `OCEANCOLOUR_GLO_BGC_L3_NRT_009_101`, *Global Ocean Colour (Copernicus-GlobColour), Bio-Geo-Chemical, L3 (daily) from Satellite Observations (Near Real Time)*.
- Dataset: `cmems_obs-oc_glo_bgc-plankton_nrt_l3-multi-4km_P1D_202411`, *cmems_obs-oc_glo_bgc-plankton_nrt_l3-multi-4km_P1D*.
- Type: `NEAR_REAL_TIME_OBSERVATION`; Level-3 daily multi-sensor satellite observation, not instantaneous.
- Variables present: `CHL`, `CHL_uncertainty`, `DIATO`, `DIATO_uncertainty`, `DINO`, `DINO_uncertainty`, `GREEN`, `GREEN_uncertainty`, `HAPTO`, `HAPTO_uncertainty`, `MICRO`, `MICRO_uncertainty`, `NANO`, `NANO_uncertainty`, `PICO`, `PICO_uncertainty`, `PROCHLO`, `PROCHLO_uncertainty`, `PROKAR`, `PROKAR_uncertainty`, `flags`.
- Selected: `CHL` (`milligram m-3`, CF `mass_concentration_of_chlorophyll_a_in_sea_water`), `CHL_uncertainty` (`%`), `flags` (unitless).
- Grid: longitude −179.9791717529..179.9791717529°, ascending; latitude −89.9791717529..89.9791641235°, ascending; 0.04166667° (nominal 4 km); dataset STAC says EPSG:4326. The product page calls Plate Carrée EPSG:32662; this discrepancy remains a TODO.
- Coverage/time: global including Karnataka; 2024-09-30..2026-09-01, daily. Latest verified: **2026-09-01T00:00:00Z**.
- Fill: `CHL=-999`; `CHL_uncertainty=-32768` with scale 0.01; `flags` has no missing sentinel in STAC. Decoding masks fill values.
- Retrieval/auth: official STAC + public HTTP ARCO Zarr, no credentials used. Toolbox workflows may require a free account.
- Terms: [Copernicus Marine licence](https://marine.copernicus.eu/user-corner/service-commitments-and-licence); metadata requires CMEMS/ACRI-ST credit.

### Sea-surface temperature — VERIFIED

- Provider: Copernicus Marine Service; UK Met Office.
- Product: `SST_GLO_SST_L4_NRT_OBSERVATIONS_010_001`, *Global Ocean OSTIA Sea Surface Temperature and Sea Ice Analysis*.
- Dataset: `METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2`, *Global SST & Sea Ice Analysis, L4 OSTIA, 0.05 deg daily*.
- Type: `ANALYSIS`; Level-4 foundation-SST analysis combining satellite and in-situ inputs, not a raw satellite pixel product.
- Variables: `analysed_sst`, `analysis_error`, `mask`, `sea_ice_fraction`. Selected first three; SST/error units `kelvin`; SST standard name `sea_surface_foundation_temperature`.
- Grid: longitude −179.9750061035..179.9750061035°, ascending; latitude −89.9749984741..89.9749984741°, ascending; EPSG:4326; 0.05° (~6 km).
- Coverage/time: global including Karnataka; dataset coordinate coverage 2007-01-01..2026-09-02, daily. Latest verified: **2026-09-02T00:00:00Z**.
- Fill: SST/error `-32768` with scale 0.01 (SST offset 273.15); mask `-128`.
- Retrieval/auth: official STAC + public HTTP ARCO Zarr, no credentials used.
- Terms: [licence](https://marine.copernicus.eu/user-corner/service-commitments-and-licence); [DOI 10.48670/moi-00165](https://doi.org/10.48670/moi-00165).

### Waves — VERIFIED

- Provider: Copernicus Marine Service; Météo-France/Global Monitoring and Forecasting Centre.
- Product: `GLOBAL_ANALYSISFORECAST_WAV_001_027`, *Global Ocean Waves Analysis and Forecast*.
- Dataset: `cmems_mod_glo_wav_anfc_0.083deg_PT3H-i_202411`, 3-hourly instantaneous fields.
- Type: `FORECAST`; future valid times are not observations.
- Variables present: `VCMX`, `VHM0`, `VHM0_SW1`, `VHM0_SW2`, `VHM0_WW`, `VMDR`, `VMDR_SW1`, `VMDR_SW2`, `VMDR_WW`, `VMXL`, `VPED`, `VSDX`, `VSDY`, `VTM01_SW1`, `VTM01_SW2`, `VTM01_WW`, `VTM02`, `VTM10`, `VTPK`.
- Selected: `VHM0` significant wave height (`m`), `VMDR` mean wave direction **from** (`degree`), `VTPK` peak period (`s`).
- Grid: longitude −180..179.9166667°, ascending; latitude −80..90°, ascending; EPSG:4326; 0.0833333° (~9 km).
- Coverage/time: global including Karnataka; 2022-11-01T03:00Z..2026-09-13T00:00Z, 3-hourly; product updated 00:00/12:00 UTC with ~10-day horizon. Latest verified **2026-09-13T00:00:00Z forecast-valid**, not current conditions.
- Fill: selected variables raw sentinel `-32767`, with scale/offset metadata.
- Retrieval/auth: official STAC + public HTTP ARCO Zarr, no credentials used.
- Terms: [licence](https://marine.copernicus.eu/user-corner/service-commitments-and-licence); [DOI 10.48670/moi-00017](https://doi.org/10.48670/moi-00017).

### Ocean surface currents — VERIFIED

- Provider: Copernicus Marine Service; Mercator Ocean International.
- Product: `GLOBAL_ANALYSISFORECAST_PHY_001_024`, *Global Ocean Physics Analysis and Forecast*.
- Dataset: `cmems_mod_glo_phy-cur_anfc_0.083deg_PT6H-i_202406`, *Instantaneous fields for product GLOBAL_ANALYSISFORECAST_PHY_001_024*.
- Type: `FORECAST`.
- Variables: `uo` eastward and `vo` northward velocity, both `m s-1`.
- Grid: longitude −180..179.9166870°, ascending; latitude −80..90°, ascending; EPSG:4326; 0.0833333°; 50 depths, shallowest −0.494025 m (used for sample).
- Coverage/time: global including Karnataka; 2022-06-01..2026-09-13, 6-hourly; operational product updated daily. Latest verified **2026-09-13T00:00:00Z forecast-valid**.
- Fill: `9.969209968386869e+36`, decoded to missing.
- Retrieval/auth: official STAC + public HTTP ARCO Zarr, no credentials used.
- Terms: [licence](https://marine.copernicus.eu/user-corner/service-commitments-and-licence); [DOI 10.48670/moi-00016](https://doi.org/10.48670/moi-00016).
- Scope: technically verified, but optional until a reviewed Safety/fuel use exists.

## INCOIS result

The official INCOIS ERDDAP `allDatasets` request returned HTTP 200 and 17 rows without authentication. Relevant products are historical: `IRS_chlorophyll_datasets` (2003–2006), `incois_oceansat2_datasets` (2011–2020), `NOAA_AVHRR_AMSR_datasets` SST (2002–2011), `incois_tmi_3day_datasets` SST (1997–2014), and `ascat_daily_datasets` wind (ends 2023). No current wave forecast or PFZ dataset appears in this catalogue. They are rejected for operational use.

## Official PFZ

INCOIS official material confirms PFZ advisories and mentions REST/third-party dissemination. No official public endpoint documentation, catalogue entry, schema, access procedure, licence, or retrievable Karnataka sample was found without scraping.

**OFFICIAL_PFZ_PROGRAMMATIC_ACCESS_NOT_VERIFIED**

No PFZ endpoint, polygon, coordinate, or fixture was created.

## Phase 2B eligibility

Only the four Copernicus datasets above are technically eligible for evidence ingestion/validation. This does not approve zones, scoring, veto thresholds, or juror logic.
