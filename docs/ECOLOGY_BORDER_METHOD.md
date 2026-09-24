# Ecology and Border Jurors

## Scope and safety statement

BLUEJURY evaluates authoritative reference geometry with deterministic Shapely/PyProj operations. It does not ask an LLM to infer intersections, legal restrictions, scores, or vetoes. BLUEJURY is a decision-support system and not an authoritative navigation or legal-compliance service.

## Ecology — Protected Planet / UNEP-WCMC and IUCN

The preferred trip-time source is the official **September 2026 public India WDPCA Shapefile download** from [Protected Planet's India page](https://www.protectedplanet.net/country/IND), installed unmodified in `data/reference/protected-planet/india-wdpca-2026-09/`. The loader reads all three `WDPA_WDOECM_Sep2026_Public_IND_shp_[0-2].zip` parts, the splitting README and `WDPA_sources_Sep2026.csv`. Each ZIP contains a polygon and a point layer with the same internal basename, so the parts must be read separately and combined by `SITE_ID`/`SITE_PID`, not extracted over one another. The installed release has **63 polygon parcels and 27 point-only records** (90 distinct sites); all three ZIPs, sidecars, EPSG:4326 CRS, schemas, geometries, parcel identifiers and source metadata are validated. Point-only sites are retained as uncertainty evidence, **not buffered into invented protected-area boundaries**. Original filenames, SHA-256 checksums, metadata-source IDs, release month and import time are preserved. The original download time is unknown and is not represented by the import time.

The existing [Protected Planet API v4](https://api.protectedplanet.net/documentation) adapter remains an optional fallback if the local files are invalid/missing. Its endpoint is `GET https://api.protectedplanet.net/v4/protected_areas/search` with `country=IND`, `marine=true`, `with_geometry=true` and a token read from `PROTECTED_PLANET_API_TOKEN`; API v3 is not used. No API request is made during trip analysis while the local dataset validates. A successful API response may be cached with its original provenance; neither path treats public India coverage as complete.

The generated 2.5 km `DISCOVERY_FOOTPRINT` is a search/display circle, **not** the proposed fishing area. Ecology measures and discloses its overlap, but evaluates proposed fishing at the destination point. An explicitly supplied `FISHING_ACTIVITY_AREA` is evaluated as an actual fishing polygon. Missing/unknown footprint role cannot receive clearance. Route intersections are evaluated and reported separately as transit; they do not alone establish prohibited fishing.

For an evaluated fishing location, an overlap without verified fishing-prohibition evidence yields **CAUTION**, not a veto. A designated/established PA parcel authoritatively reported as entirely no-take may hard-veto a proposed fishing destination or explicitly proposed fishing area inside it; route transit alone does not. Point-only records close to the route/destination have no usable area boundary and yield `DATA_UNAVAILABLE`. Proximity within the unchanged 5 km policy threshold yields CAUTION. Public India records are incomplete: Protected Planet reports that India withholds approximately 900 records from public view/download, so no intersection in the available polygons yields `DATA_UNAVAILABLE`, not comprehensive ecological CLEAR. A genuinely complete validated reference could still produce CLEAR under the existing numerical rubric, but this public extract is not one.

The juror retains the provider/dataset/release, site and parcel IDs, original files/checksums, source metadata, overlap percentage, route intersection, destination containment, nearest distance, coverage caveat, point-only count, import time and evidence references. A protected-area designation alone is **not** proof that fishing is prohibited. These spatial checks are research decision support, not legal clearance.

The MVP scorecard has no separate `statusReason` field. The UI derives Ecology wording from existing `reason_codes` without changing scores, vetoes, or the decision contract: `DATA_UNAVAILABLE` without a validated reference means **SOURCE UNAVAILABLE**; `PUBLIC_REFERENCE_COVERAGE_INCOMPLETE` or `POINT_ONLY_PROTECTED_AREA_NEARBY` means **CHECKED · INSUFFICIENT COVERAGE**; a measured overlap, proximity, or route transit means **VERIFIED CONCERN**; `CONFIRMED_NO_TAKE_FISHING_LOCATION` with `veto=true` means **VERIFIED RESTRICTION**. These labels describe evidence state, not an additional legal determination. No-overlap in the installed India extract remains evidence-limited.

### WII Mulki–Pavanje supplementary context

The provenance-controlled record at `data/reference/wii-icmba/mulki-pavanje-2013.json` captures the Wildlife Institute of India report's published point (`13.097250 N, 74.787783 E`), source pages, publication details, habitat, proposed conservation category, and source limitations. It is classified as `HISTORICAL_BIODIVERSITY_CONTEXT` with `POINT_CONTEXT_ONLY` geometry. Notification and fishing restriction are not verified.

The separate read-only loader validates the record identity, exact published coordinate, page references, point semantics, and non-legal status before use. Ecology calculates distance from that point to the destination and complete route and displays it as supplementary context. The point is never buffered; the report's stated 3.5 km² is not converted into geometry. This context does not enter protected-area intersection/proximity calculations, primary evidence references, scoring, confidence, reason codes, or veto logic. If the record is missing or invalid, a diagnostic is logged and the existing WDPCA evaluation proceeds unchanged.

[Protected Planet terms](https://www.protectedplanet.net/en/legal) restrict commercial use and redistribution; do not commit the downloaded archive or expose raw records through a public download. Attribution, release month/year, and a link to Protected Planet are required for published use. Confirm terms before any production/public deployment.

## Border — Marine Regions / VLIZ

The loader supports the official **World EEZ v12 (2023-10-25)** dataset published by Marine Regions / Flanders Marine Institute. Citation: *Flanders Marine Institute (2023), Maritime Boundaries Geodatabase: Maritime Boundaries and Exclusive Economic Zones (200NM), version 12*, DOI `10.14284/632`. The download is distributed under CC BY 4.0 and currently requires completing the provider's download form.

Manual import:

1. Open the official Marine Regions download page and select `World_EEZ_v12_20231025.zip` (World EEZ v12, 2023-10-25).
2. Complete the provider's registration/purpose form and accept its terms.
3. Extract the unmodified archive into `data/reference/marine-regions/World_EEZ_v12_20231025/`.
4. Keep `eez_v12.shp`, `.dbf`, `.shx`, `.prj`, and `LICENSE_EEZ_v12.txt` together. The separate `eez_boundaries_v12` line files are not the polygon source used by the juror. Do not rename or edit their contents.
5. Restart the API and run the backend tests. The loader validates the expected version path, required sidecars, a Marine Regions identifier field, and an Indian territory/sovereignty record before returning evidence.

Runtime never downloads or substitutes boundary geometry. It isolates India records, preserves official attributes, and unions their geometry for evaluation.

The installed file was inspected on 2026-09-20: the polygon shapefile contains 285 records, including two Indian-sovereignty EEZ records (`MRGID` 8333 and 8480). Selection uses official `ISO_SOV1=IND`, `SOVEREIGN1=India`, and `POL_TYPE=200NM` fields, not a name substring; this excludes the French *Bassas da India* EEZ. The `.prj` validates as EPSG:4326. The loader records the file checksum and local modification time; the original download time was not supplied.

The candidate geometry now carries an explicit role. The MVP generator marks its nominal 2.5 km circle `DISCOVERY_FOOTPRINT`: it is a search/display region, **not** a proposed fishing-activity area. The proposed activity in this destination-based workflow is the destination point and travel along the complete route. The juror still measures the entire circle's outside area and percentage, records its containment status, and applies caution when it crosses the reference; it does not call the entire circle cleared. An explicitly supplied `FISHING_ACTIVITY_AREA` instead requires **full area containment**. An absent or unrecognised role never defaults to discovery and cannot receive CLEAR.

Evaluation is:

- official file or destination geometry absent/invalid: `DATA_UNAVAILABLE`, confidence 0, no clearance, unless a complete route exit can independently be verified and vetoed;
- verified destination or complete route exits the configured India maritime reference: hard veto, score 0, regardless of footprint role;
- explicitly proposed fishing-activity area exits: hard veto, score 0;
- footprint role unknown while destination and route remain inside: `FOOTPRINT_ROLE_UNSPECIFIED`, confidence 0, no clearance;
- discovery circle partly outside while destination and route remain inside: `CAUTION`, score 65, with outside area/percentage disclosed;
- evaluated scope covered but within the existing versioned 10 km boundary threshold: `CAUTION`, score 65;
- evaluated scope covered and farther than that threshold: `CLEAR`, score 90 **only for the stated destination/route or explicit fishing-activity-area scope**.

Results preserve dataset/version, containing reference name, destination/zone/route containment, circle-outside area/percentage, crossing status, nearest-boundary distance, file timestamp, checksum, and evidence reference. The discovery circle is never represented as a permitted fishing area. This is a geographic maritime-boundary reference check—not a guarantee of fishing rights, navigational safety, or legal compliance. The bundled Marine Regions licence expressly limits intended use to scientific, educational, and research purposes and says the data has no legal value. Shared/disputed geometry and rules beyond the selected reference require separate authoritative legal evidence.

## Offline behavior

The offline subsystem is unchanged. It stores the full existing DecisionBundle, so a scorecard already computed from validated Ecology/Border evidence persists naturally with its reason, veto, confidence, evidence reference, details, and timestamp. Offline mode never contacts Protected Planet or Marine Regions and never recomputes these jurors.

## Test geometry

Unit tests use small values named `TEST_GEOMETRY` solely to verify mathematical containment/intersection branches. They are not authoritative fixtures, never enter runtime loading, and cannot power a recommendation.
