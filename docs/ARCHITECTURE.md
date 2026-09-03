# BLUEJURY AI V2 — Architecture

Status: proposed architecture; no application code has been implemented.

## 1. Architectural style

Use a typed modular monolith with two deployable applications: a Next.js PWA and a FastAPI API/worker process backed by PostgreSQL/PostGIS. Provider ingestion may run as scheduled jobs in the same backend codebase. This keeps the operational footprint small while enforcing module boundaries that can be separated later if proven necessary.

No Redis, Kafka, LangChain, LangGraph, vector database, or microservice topology is currently justified.

## 2. System context

```text
Fisher browser/PWA
  ├─ browser Geolocation API (explicit foreground consent)
  ├─ MapLibre map and local UI cache
  └─ HTTPS typed API
          |
FastAPI modular backend
  ├─ decision orchestrator
  ├─ evidence catalogue/validation/adapters
  ├─ feature, zone, route, fuel, geometry engines
  ├─ five isolated juror evaluators
  ├─ hard-feasibility and negotiation policy
  └─ audit/provenance service
          |
PostgreSQL + PostGIS + controlled object/file cache
          |
Verified public marine/geospatial providers
```

## 3. Backend modules and ownership

### API

Validates requests, authorizes access, applies rate limits, exposes recommendation/job/evidence endpoints, and serializes immutable response contracts. It contains no scoring logic.

### Evidence catalogue and adapters

Each provider adapter discovers or uses a steward-approved dataset registration, fetches source metadata/payloads, and emits a raw evidence envelope. Dataset IDs and variable mappings are configuration created only after the verification workflow in `DATA_SOURCES.md`.

### Evidence validator

Fail-closed deterministic checks cover media/schema shape, geographic and temporal coverage, coordinate conventions, units, nodata/fill values, plausible provider-declared ranges, timestamps, checksum, and provenance completeness. It never repairs missing scientific values by invention.

### Normalization and feature engine

Converts validated data into explicit canonical units/CRS, clips it to the area/time of interest, and computes inspectable spatial/statistical features. Every transform has a version and retains lineage to source cells/features.

### Candidate-zone engine

Generates bounded geometries from verified features using versioned numerical rules. It does not create zones when required source features are unavailable. Candidate IDs are content-derived or otherwise stable within a decision run.

### Route engine

Builds route alternatives from departure position to candidate entry/target points, avoiding or flagging configured obstacles. Geodesic distances use an appropriate geodesic/locally projected computation. Route assumptions, resolution, CRS, and geometry-engine versions are recorded.

TODO: Select and verify a navigable marine routing dataset/algorithm; straight-line sea routes must not be assumed navigable without coastline/obstacle validation.

### Jurors

All five receive the same immutable evaluation context but use separate, versioned policies:

- Catch: evaluates opportunity evidence and uncertainty.
- Safety: evaluates marine hazards and operational limits.
- Fuel: evaluates route fuel feasibility and reserve.
- Ecology: evaluates protected/conservation intersections and ecological constraints.
- Border: evaluates maritime reference-boundary intersection and applicable configured constraints.

Jurors cannot call one another or change candidate geometry, evidence, or another scorecard. They return schema-validated `JurorScorecard` values.

### Feasibility gate and negotiation

The gate rejects any candidate with a hard system-rule failure or juror veto. Negotiation sees only feasible candidates and applies the versioned policy in `DECISION_POLICY.md`. It cannot clear or offset vetoes.

### Explanation renderer

The canonical explanation is template-based and deterministic. An optional LLM may improve language using only a frozen DecisionBundle and a constrained output schema; its output is checked to ensure it does not introduce or alter facts. The deterministic explanation remains available if the LLM fails.

### Audit and provenance

Stores requests (with privacy controls), normalized input snapshots/fingerprints, scorecards, rule traces, selected/rejected candidates, dataset metadata, evidence references, freshness classifications, and version identifiers.

## 4. Principal data contracts

- `DatasetRegistration`: provider, catalogue URL, dataset ID, variables, units, licence, coverage, steward status, and verification record.
- `EvidenceEnvelope`: source/dataset/variable, spatial footprint, observed/forecast-valid/retrieved times, raw checksum, validation state, cache state, licence, and URI/reference.
- `NormalizedEvidence`: canonical CRS/units, transform lineage/version, coverage mask, quality flags, and source references.
- `Candidate`: zone geometry plus route alternatives, generation parameters, feature evidence, and lineage.
- `EvaluationContext`: immutable request, vessel assumptions, candidate-route pair, evidence set, freshness decisions, and policy versions.
- `JurorScorecard`: contract defined in the product specification.
- `FeasibilityTrace`: evaluated hard rules, outcomes, thresholds, and evidence references.
- `DecisionBundle`: complete user result and replay manifest.

Pydantic models are the backend source of truth. OpenAPI-generated TypeScript types should prevent frontend/backend contract drift. Persisted enums and reason codes are versioned.

## 5. Decision sequence

```text
request validation
  → resolve verified evidence for area/time
  → classify freshness and validate completeness
  → normalize evidence and generate features
  → generate zone candidates
  → generate route alternative(s) per zone
  → freeze EvaluationContexts
  → run five jurors independently for each candidate-route pair
  → validate scorecard completeness
  → apply hard feasibility rules
  → negotiate among feasible survivors
  → build immutable DecisionBundle
  → render explanation and map response
```

Parallel juror execution is permitted, but deterministic inputs and output ordering must make results reproducible.

## 6. Re-evaluation model

A re-evaluation trigger is an event with a reason and deduplication key:

- location moved beyond configured distance and accuracy permits a meaningful comparison;
- configured elapsed time passed;
- a newer validated evidence revision changes an input fingerprint;
- vessel/fuel/trip input changed;
- policy version changed.

The orchestrator debounces triggers, cancels or supersedes obsolete work, and atomically publishes only a complete DecisionBundle. The client never merges partial juror results into an old verdict.

## 7. Storage and caching

PostgreSQL/PostGIS stores catalogue records, vector geometries, decision/audit metadata, and indexed spatial relationships. Large provider payloads and derived rasters may use a controlled filesystem/object-store abstraction with database metadata and content checksums.

Cache keys include provider, dataset, variable, spatial/temporal subset, provider revision where available, and transform version. Raw validated evidence is immutable. Derived-cache entries point to raw checksums. Cache eligibility, TTL, stale limit, licensing, and redistribution constraints are dataset-specific.

“Latest cached” means the latest successfully validated real response, not the latest attempted response. Cache state is separate from scientific observation/forecast age.

## 8. Geospatial correctness

- Store authoritative geometries with declared source CRS; use EPSG:4326 for exchange, not blindly for metric operations.
- Use PostGIS for indexed predicates and Shapely/PyProj for deterministic application-side processing.
- Validate/repair geometry only through explicit, logged rules; preserve originals.
- Account for antimeridian, invalid rings, multipolygons, coastal topology, coordinate order, and geodesic distance.
- Define boundary semantics (`intersects`, `within`, buffer/tolerance) per policy; never rely on display pixels.
- Raster styling is separate from analytical values; legends include units, range, timestamp, resolution, and nodata.

## 9. Availability and failure behavior

| Failure | System response |
|---|---|
| Provider timeout | Try eligible validated cache; otherwise unavailable |
| Metadata/units changed | Quarantine response; do not compute with it |
| Partial spatial coverage | Mask uncovered area; exclude affected candidates or lower confidence only if policy permits |
| Critical evidence stale/missing | DATA_UNAVAILABLE for affected decision scope |
| One juror fails/schema-invalid | No verdict from partial jury; retry safely, then DATA_UNAVAILABLE |
| No candidates generated | DATA_UNAVAILABLE if evidence/algorithm issue; NO-GO only if adequate evidence proves infeasibility |
| All candidates vetoed | NO-GO with all veto traces |
| Database unavailable | Fail request; client may show historical local result clearly labelled |
| Location denied/poor | Permit manual start point if policy allows; expose accuracy/staleness |
| Optional LLM unavailable | Use deterministic explanation |

## 10. Security and privacy

- HTTPS only; strict input validation, request limits, dependency scanning, and secrets outside source control.
- Treat precise location, trip intent, routes, vessel information, and catch-related history as sensitive data.
- Request location only in context, explain why, and provide revocation/stop controls.
- Prefer in-memory processing and coarse/short-lived storage unless history is explicitly consented to.
- Separate operational telemetry from precise coordinates; redact logs, traces, analytics, and error reports.
- Apply least privilege and row-level authorization if accounts/history exist.
- Define retention/deletion policy and encrypt sensitive persisted data and backups.
- Prevent SSRF through allow-listed provider endpoints; cap downloads; validate content types and decompression sizes.
- Sanitize provider metadata and optional LLM output before display.
- Service workers must not cache authenticated location/API responses indiscriminately.
- Avoid embedding secrets in Next.js client bundles or map style URLs.

TODO: Complete a threat model and applicable Indian privacy-law review before field deployment.

## 11. Observability

Record correlation/decision IDs, provider latency and status, validation failures, cache state, evidence age, juror duration, veto rates, re-evaluation reason, and policy version. Metrics and logs must exclude precise location by default. Alerts should distinguish upstream outage from scientific staleness and internal faults.

## 12. Testing strategy

- Unit/property tests for scores, thresholds, confidence, geodesy, geometry predicates, fuel, freshness, and tie-breakers.
- Contract tests for provider adapters using legally stored responses captured from real sources with provenance.
- Golden DecisionBundle tests for replay and explanation.
- Invariant tests: vetoed candidates never win; missing critical evidence never becomes a fabricated value; all scorecards are present.
- PostGIS integration tests for MPA/EEZ crossings, boundary contact, multipolygons, and antimeridian cases.
- Frontend tests for state transitions, accessibility, layer legends, location permission, and stale/cached labels.
- End-to-end tests for GO, CAUTIOUS GO, NO-GO, DATA_UNAVAILABLE, offline, and provider outage.

## 13. Proposed complete directory structure

```text
BLUEJURY-AI-V2/
├── README.md
├── LICENSE
├── .editorconfig
├── .gitignore
├── .env.example
├── Makefile
├── compose.yaml
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── ARCHITECTURE.md
│   ├── DATA_POLICY.md
│   ├── DATA_SOURCES.md
│   ├── DECISION_POLICY.md
│   ├── UX_SPEC.md
│   ├── adr/
│   ├── diagrams/
│   └── runbooks/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   │   ├── map/
│   │   │   ├── decision/
│   │   │   └── ui/
│   │   ├── features/
│   │   │   ├── location/
│   │   │   ├── live-trip/
│   │   │   ├── evidence-layers/
│   │   │   └── recommendations/
│   │   ├── lib/
│   │   ├── public/
│   │   ├── styles/
│   │   ├── tests/
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   └── api/
│       ├── src/bluejury/
│       │   ├── api/
│       │   ├── config/
│       │   ├── domain/
│       │   │   ├── evidence/
│       │   │   ├── candidates/
│       │   │   ├── routes/
│       │   │   ├── jury/
│       │   │   └── decisions/
│       │   ├── evidence/
│       │   │   ├── adapters/
│       │   │   ├── catalogue/
│       │   │   ├── validation/
│       │   │   └── normalization/
│       │   ├── geospatial/
│       │   ├── features/
│       │   ├── candidates/
│       │   ├── routing/
│       │   ├── jurors/
│       │   ├── policy/
│       │   ├── orchestration/
│       │   ├── explanations/
│       │   ├── persistence/
│       │   ├── provenance/
│       │   └── observability/
│       ├── tests/
│       │   ├── unit/
│       │   ├── integration/
│       │   ├── contract/
│       │   ├── property/
│       │   └── golden/
│       ├── alembic/
│       ├── alembic.ini
│       └── pyproject.toml
├── packages/
│   ├── contracts/              # generated OpenAPI TypeScript client/types
│   ├── map-style/              # versioned styles, legends, attribution config
│   └── reason-codes/           # language-neutral code catalogue, if shared build warrants it
├── data/
│   ├── README.md
│   ├── catalogue/              # reviewed dataset registrations, no guessed IDs
│   ├── schemas/
│   ├── fixtures/
│   │   ├── metadata/           # provenance manifests
│   │   └── responses/          # permitted captured real responses only
│   └── boundaries/             # licensed/versioned source manifests; large files ignored
├── scripts/
│   ├── data_discovery/
│   ├── verify_sources/
│   ├── capture_fixtures/
│   └── dev/
├── infra/
│   ├── containers/
│   ├── migrations/
│   └── deployment/
├── tests/
│   └── e2e/
└── .github/
    └── workflows/
```

Directories are proposed, not created by this documentation step except `docs/`.

## 14. Architecture decisions still open

- TODO: Verify hosting limits for raster subset storage/tiling and choose local object storage versus managed object storage.
- TODO: Choose a scheduler mechanism supported by the deployment platform.
- TODO: Define authentication requirements after trip-history scope is decided.
- TODO: Benchmark synchronous versus queued decision computation before adding a job runner.
- TODO: Decide whether analytical raster operations use xarray/rioxarray/rasterio after verified formats are known.
- TODO: Select basemap/tile provider with suitable offline, attribution, and usage terms.

