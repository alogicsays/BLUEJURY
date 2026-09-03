# BLUEJURY AI V2 — Data Policy

## 1. Non-negotiable rule

BLUEJURY AI shall not create, interpolate into existence, or present synthetic marine observations or forecasts. SST, chlorophyll, wave, wind, PFZ, currents, and comparable environmental values must originate from a verified real public dataset/service and remain traceable to it.

An unavailable value remains unavailable. UI demonstrations must use either live verified data or captured responses from real sources; simulated API envelopes may test transport errors but may not masquerade as scientific evidence.

## 2. Dataset admission workflow

No dataset ID or variable mapping may enter production configuration until a data steward records all steps:

1. Discover the dataset through the provider’s current official catalogue.
2. Save the catalogue and metadata URLs and retrieval timestamp.
3. Inspect dataset title, identifier, provider, processing level, resolution, quality flags, and update cadence.
4. Verify geographic coverage includes the intended operating area.
5. Verify temporal coverage and latency support the proposed use.
6. Verify exact variable names, dimensions, coordinate conventions, units, fill values, scale/offset, and quality flags.
7. Retrieve an actual, minimal sample from the official endpoint.
8. Validate decoding, CRS/grid, range, time coordinates, and coverage.
9. Record licence, attribution, redistribution, caching, and access constraints.
10. Add the verified result and sample manifest to `DATA_SOURCES.md`; approve the dataset registration through review.

Any uncertainty is a `TODO`, not an inferred value.

## 3. Evidence provenance requirements

Each raw response or logical source subset must carry:

- provider and authoritative organization;
- dataset title and exact dataset identifier/version;
- catalogue, metadata, and data endpoint URLs;
- variable names exactly as supplied and canonical semantic mapping;
- source and canonical units, scale/offset, fill/nodata, and quality flags;
- spatial footprint, CRS/grid, spatial resolution, and depth/vertical level where relevant;
- observation time, forecast reference time, forecast valid time, and time range as applicable;
- retrieval time in UTC;
- raw payload checksum, media/format, byte size, and immutable storage reference;
- licence/terms URL, attribution, redistribution/caching restrictions;
- validation status, validator version, warnings, and failure reason;
- cache status and served-at time;
- processing lineage for every normalized/derived artifact.

Evidence references in scorecards must resolve to these records and, where possible, to the source cells/features or clipped subset used.

## 4. Time and freshness

Four concepts shall never be conflated:

- **Observed at:** when an observation represents the environment.
- **Forecast issued at:** model cycle/reference time.
- **Forecast valid at:** time the prediction represents.
- **Retrieved at:** when BLUEJURY downloaded the response.

Freshness is computed deterministically per variable/dataset policy against observation or forecast-valid time, not merely retrieval time:

- `LIVE_OR_CURRENT`: within the approved scientific validity window; the UI should generally say “current” or “forecast valid at,” not imply instantaneous sensing.
- `CACHED_CURRENT`: cached response still within validity window.
- `CACHED_STALE`: cached response beyond the preferred window but within an explicitly permitted stale limit.
- `EXPIRED`: beyond the permitted stale limit and unusable for decisions.
- `UNKNOWN`: required time metadata cannot be established; unusable for critical decisions.

TODO: Establish scientifically defensible preferred/stale limits separately for SST, chlorophyll, waves, wind, currents, boundaries, MPAs/OECMs, and each provider product after dataset verification.

## 5. Validation and quality controls

Deterministic checks include:

- expected schema/dimensions and coordinate monotonicity;
- timestamp parsing and forecast-cycle consistency;
- spatial overlap with the decision area and quantified coverage ratio;
- declared units and safe, explicit conversion to canonical units;
- nodata/fill/quality-mask handling before statistics;
- checksum and completeness;
- provider metadata changes relative to the approved registration;
- plausible ranges based on authoritative metadata, used to reject corruption rather than manufacture replacement values;
- consistency between vector CRS declaration and coordinates;
- geometry validity with original geometry retained.

Failed responses are quarantined and excluded from “latest validated” selection. The system records the failure without overwriting the previous valid cache.

## 6. Missing data and spatial/temporal gaps

- Never substitute a constant, random value, generic climatology, or unverified alternate API.
- Never extrapolate beyond source coverage unless a reviewed scientific method explicitly permits it and labels the result as derived; no such method is currently approved.
- Interpolation within valid source coverage requires a versioned method, preserved mask, uncertainty treatment, and review. TODO: approve methods per data product.
- Exclude candidates whose critical feature support is insufficient.
- If all candidates lack critical evidence, return DATA_UNAVAILABLE.
- Non-critical gaps may reduce confidence only when an explicit confidence rule permits continued evaluation.
- Absence of an MPA/EEZ feature from a failed or incomplete dataset is unknown, not proof of no intersection.

## 7. Caching policy

Cache only authentic provider responses or deterministic derivatives of them. A cache entry must include its provenance and checksum. Dataset-specific terms control whether raw payloads can be retained or redistributed.

- Last-known-good selection includes only successfully validated entries.
- Immutable raw responses are retained according to licence and retention policy.
- Derived artifacts are invalidated by raw checksum, transform version, dataset-registration change, or policy change.
- Cached evidence is always labelled with its times and cache state.
- Offline/local device storage of sensitive decisions is minimized and separated from bulk public environmental tiles.
- Provider responses must not be cached beyond contractual or licensing limits.

## 8. Development fixtures

Scientific fixtures must be small, captured from real official datasets, and accompanied by a sidecar manifest containing all provenance fields, capture command/tool version, checksum, and licence basis. Fixtures are immutable; refreshes create new versions. Tests may construct geometries or numbers solely for unit-testing mathematical mechanics when unmistakably labelled as test-only synthetic inputs, but such values may not power demos, screenshots, user recommendations, or claims about marine conditions.

## 9. Derived information

Features, zones, routes, scores, and confidence values are derived—not observed. They must be labelled and linked to:

- source evidence IDs/checksums;
- algorithm and parameters;
- code/model/policy version;
- computation timestamp;
- CRS and numeric precision;
- exclusions, masks, and quality flags.

An optional LLM-generated explanation is presentation metadata, not evidence.

## 10. Governance and change control

- Dataset registrations require human review.
- Provider metadata drift automatically suspends affected ingestion until reviewed.
- Threshold and unit changes require a decision-policy version change and replay tests.
- Source removal does not erase audit provenance; access is governed by licence and retention requirements.
- Public UI attribution must satisfy every active source licence.

## 11. Failure modes and mandatory responses

| Condition | Required behavior |
|---|---|
| Unknown dataset/variable ID | Do not call it; mark TODO/unavailable |
| Provider unavailable | Use eligible last validated cache with label, or unavailable |
| Licence unclear | Do not ingest/store/display until resolved |
| Missing/ambiguous units | Quarantine |
| Missing critical timestamp | Quarantine for critical use |
| Coverage does not include request | Do not extrapolate; exclude/unavailable |
| Quality flags unusable | Exclude affected cells; assess coverage |
| New schema/version | Quarantine until registration is reverified |
| Cache expired | Do not use for a current decision |
| Conflicting sources | Preserve both; apply predeclared precedence/consensus policy or mark unresolved |

## 12. Privacy distinction

Public environmental data is not personal, but joining it to exact device location, route, time, vessel, or trip history creates sensitive operational information. Precise user location must not be sent to upstream marine-data providers where a coarser server-side area request suffices. Logs and dataset-access telemetry must use coarse or pseudonymous context.

