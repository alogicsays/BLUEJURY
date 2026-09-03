# BLUEJURY AI V2 — Data Sources Register

Status: discovery register only. No dataset below is approved or integrated yet. Exact dataset identifiers are intentionally absent until verified through the current official catalogue and sampled.

## 1. Rule for this register

A row becomes `VERIFIED` only after catalogue discovery, metadata inspection, geographic and temporal coverage checks, exact variable/unit verification, successful sample retrieval, licence review, and provenance capture. Provider names are leads, not evidence that a usable product exists.

## 2. Candidate source register

| Need | Preferred provider lead | Intended use | Status | Required verification |
|---|---|---|---|---|
| Potential Fishing Zone advisory | INCOIS official services | Catch evidence or advisory comparison | TODO — unverified | Discover current machine-accessible service; verify terms, spatial encoding, validity time, coverage, and whether operational reuse is permitted |
| Chlorophyll-a | INCOIS ERDDAP/official catalogue; Copernicus Marine catalogue | Catch features and map layer | TODO — unverified | Discover product; inspect sensor/model, variable name, units, quality flags, depth, resolution, latency, India coverage; retrieve sample |
| Sea-surface temperature | INCOIS ERDDAP/official catalogue; Copernicus Marine catalogue | Catch/safety context and map layer | TODO — unverified | Discover product; verify foundation/skin/bulk meaning, variable, units, quality flags, resolution, latency, coverage; retrieve sample |
| Significant wave height/direction/period | INCOIS official catalogue; Copernicus Marine catalogue | Safety evidence and risk layer | TODO — unverified | Discover forecast/observation product; verify variables, units, model cycle/valid time, horizon, grid, coastal coverage; retrieve sample |
| Surface wind speed/direction | INCOIS official catalogue; Copernicus Marine catalogue | Safety evidence and risk layer | TODO — unverified | Discover product; verify reference height, vector components, units, forecast validity, grid; retrieve sample |
| Surface currents | INCOIS official catalogue; Copernicus Marine catalogue | Route/safety/fuel context | TODO — unverified | Discover product; verify depth, vector convention, units, valid time, coastal resolution; retrieve sample |
| Marine warnings | INCOIS official warning service | Trip-wide and spatial safety constraints | TODO — unverified | Identify authoritative structured feed, warning geometry, categories/severity, issued/expiry time, usage terms; retrieve sample |
| Marine Protected Areas | Protected Planet official data/service | Ecology intersection | TODO — unverified | Confirm downloadable/API product, geometry completeness for launch geography, WDPA status/category fields, update/version, licence and redistribution |
| OECMs | Protected Planet official data/service | Ecology intersection | TODO — unverified | Confirm OECM availability, geometry/status fields, update/version, licence and redistribution |
| EEZ/reference maritime boundaries | Marine Regions official dataset/service | Border intersection/reference display | TODO — unverified | Identify current EEZ product/version, disputed/overlapping claims representation, geometry precision, licence, attribution; retrieve sample |
| Coastline/land mask | TODO: authoritative open source | Route navigability and map context | TODO — source not selected | Assess resolution, topology, licence, update cadence, small-island coverage, and suitability for navigation constraints |
| Bathymetry/navigation constraints | TODO: authoritative open source | Candidate feasibility/routing if needed | TODO — source not selected | Define need; verify resolution, vertical datum, hazards, licence; do not imply nautical-chart authority |

## 3. Important limitations

- A reference EEZ dataset is not a legal determination, especially in disputed or overlapping areas. The UI and Border Juror must name the source/version and use cautious wording.
- Protected Planet records do not by themselves encode every fishing regulation. Designation, status, governance, and applicable regulations may require separate authoritative sources.
- Satellite chlorophyll/SST can have cloud, coastal, quality, spatial-resolution, and latency limitations. These must be obtained from actual product metadata.
- Forecast model values and observations are different evidence types; their times and confidence rules cannot be merged casually.
- PFZ advisory access, format, scope, and reuse are unresolved. No endpoint or dataset ID may be guessed.

## 4. Per-dataset verification record template

Create one subsection per admitted dataset:

```text
Dataset status: DISCOVERED | SAMPLED | VERIFIED | SUSPENDED | RETIRED
Provider / authority:
Catalogue URL:
Metadata URL:
Data endpoint URL:
Dataset title:
Exact identifier and version:
Discovery and verification timestamps (UTC):
Variables and dimensions:
Units / scale / offset / nodata / quality flags:
Observation or forecast semantics:
Temporal coverage / update cadence / latency:
Geographic coverage / CRS / grid / resolution / depth:
Sample request and response reference:
Raw checksum:
Validation result and validator version:
Licence / terms URL / attribution:
Caching and redistribution constraints:
Known limitations:
Approved BLUEJURY uses:
Reviewer and review date:
```

## 5. Evidence-source selection rules

When more than one verified product can supply a variable, selection must be deterministic and configured by geography, time validity, quality, resolution appropriate to the use, provider authority, and licence—not by whichever endpoint responds first. Fallbacks must be verified separately and surfaced in provenance.

TODO: Define source precedence only after products are sampled and quantitatively compared over the launch geography.

## 6. Discovery work queue

1. TODO: Confirm launch coastline/operating envelope; source coverage cannot be verified without it.
2. TODO: Inspect the current INCOIS catalogue/ERDDAP and document exact discoverable products.
3. TODO: Inspect the current Copernicus Marine catalogue and authentication/licensing requirements.
4. TODO: Verify Protected Planet MPA/OECM access, licence, versioning, and geometry completeness.
5. TODO: Verify Marine Regions EEZ/reference-boundary product, disputed-area semantics, licence, and attribution.
6. TODO: Retrieve minimal real samples for each approved variable and record manifests/checksums.
7. TODO: Establish product-specific freshness windows with domain justification.
8. TODO: Decide authoritative marine warning, coastline, and routing-constraint sources.

