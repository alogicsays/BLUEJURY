# BLUEJURY AI V2 — Product Specification

Status: architecture baseline; implementation is not authorized by this document.

## 1. Product statement

BLUEJURY AI is an explainable, map-first marine decision-intelligence PWA for small-scale and mechanized fishers. It answers “Where should I go fishing?” by evaluating independently generated fishing-zone and route candidates against verified marine and geospatial evidence.

The product is a jury system, not a catch-ranking model. Catch opportunity may distinguish feasible candidates, but it can never compensate for a safety, fuel-feasibility, protected-area, or maritime-boundary veto.

## 2. Goals

- Turn current, verified evidence into practical GO, CAUTIOUS GO, NO-GO, or DATA_UNAVAILABLE guidance.
- Make the fisher’s position, candidate zones, route, risks, and applicable boundaries visible on one map.
- Preserve independent Catch, Safety, Fuel, Ecology, and Border assessments.
- Explain the verdict in plain language without hiding evidence age, uncertainty, or rejection reasons.
- Re-evaluate a live trip when material location or evidence changes.
- Remain useful during provider outages through clearly labelled, policy-compliant cached evidence.
- Operate as a reliable hackathon-scale modular monolith with an upgrade path, not premature distributed infrastructure.

## 3. Non-goals

- Navigation, collision avoidance, or replacement for official maritime warnings.
- A guarantee of catch, vessel safety, legality, or rescue.
- Autonomous vessel control.
- LLM-derived environmental measurements, routes, geometry predicates, fuel estimates, or candidate zones.
- Crowdsourced or synthetic marine observations in the decision path.
- Prediction beyond the verified spatial/temporal scope of source data.

## 4. Primary users and assumptions

### Fisher

Needs a fast answer, readable map, actionable route, understandable risks, and evidence age. May have intermittent connectivity, limited screen size, and varying literacy.

### Operations/data steward

Registers providers and datasets, validates provenance, monitors freshness and failures, and reviews decision traces.

### Demonstrator/reviewer

Needs a reproducible decision and an auditable record showing that hard constraints cannot be traded away.

Vessel endurance and fuel consumption are vessel-specific inputs. If required inputs are absent or unreliable, fuel feasibility is unavailable and cannot be silently inferred.

## 5. Core user journey

1. The app requests foreground location permission with a plain-language purpose statement.
2. The fisher confirms or corrects vessel profile, fuel available, intended trip duration, and starting point.
3. The app displays the location, evidence layers, their observation/forecast times, and freshness state.
4. The fisher asks for a recommendation.
5. The system validates evidence, computes features, generates candidates and routes deterministically, and has all five jurors evaluate every candidate independently.
6. Hard feasibility rules remove candidates. Negotiation compares only survivors.
7. The app displays the verdict, winning zone and route, five scorecards, rejected alternatives, vetoes, confidence, provenance, and the decisive reasons.
8. In live trip mode, material movement or material evidence change triggers controlled re-evaluation and a visible update.

## 6. Functional requirements

### Decision request

Inputs include location, vessel profile, fuel state, trip preferences, departure time, and optional risk preferences. Required input validity is checked before computation.

### Evidence and map

The map shall support, when verified data exists:

- browser/mobile location and accuracy radius;
- candidate fishing zones and selection state;
- chlorophyll concentration;
- sea-surface temperature (SST);
- marine safety/risk evidence;
- recommended and alternative routes;
- EEZ/maritime reference boundaries;
- Marine Protected Areas (MPAs) and OECMs;
- legend, units, timestamps, source, freshness, and unavailable states.

Layers without verified data shall be shown as unavailable, not populated with placeholders.

### Jury contract

Every candidate zone-route pair receives exactly one current scorecard from each juror:

```text
JurorScorecard
  agent: CATCH | SAFETY | FUEL | ECOLOGY | BORDER
  zone_id: stable candidate identifier
  score: integer 0..100
  veto: boolean
  reason_codes: non-empty list of versioned codes
  reason: human-readable deterministic explanation
  evidence_references: non-empty references or an explicit missing-evidence reference
  confidence: number 0..1
  checked_at: UTC timestamp
```

Route identity is carried by the candidate evaluation record associated with `zone_id`; if one zone has several route alternatives, each alternative becomes a distinct evaluation candidate while preserving its parent zone identifier.

### Decision output

`DecisionBundle` shall contain:

- verdict: GO, CAUTIOUS_GO, NO_GO, or DATA_UNAVAILABLE;
- recommended candidate zone and route, or explicit absence;
- all five juror scores and full scorecards;
- rejected alternatives with rejection stage and reason;
- veto reasons and hard-rule identifiers;
- supporting evidence references and source metadata;
- observation/forecast and retrieval times;
- freshness status;
- overall and per-juror confidence;
- deterministic explanation of why the winner won;
- policy, algorithm, dataset, and software versions needed for replay.

### Live trip mode

- Foreground browser Geolocation API only for V2 unless separately approved.
- Display last fix, accuracy, timestamp, permission state, and stale-location warning.
- Re-evaluate after a configurable distance/time threshold or material evidence revision, with debounce and rate limiting.
- Never claim background tracking when the browser/platform does not support it.
- Retain the previous verdict while updating, visibly marked with its computation time.

### Offline/degraded behavior

- Cache the most recently validated real provider response where licensing and size permit.
- Label cached evidence with source, observation/forecast time, retrieval time, and `CACHED` or `STALE`; never `LIVE`.
- If critical evidence is absent or older than its policy limit, return DATA_UNAVAILABLE or a reduced-confidence result according to the decision policy.
- A cached UI shell may load offline; it may show the last decision only as historical, never current guidance.

## 7. Deterministic, agentic, live, and cacheable boundaries

| Capability | Classification | Constraint |
|---|---|---|
| Metadata/sample validation | Deterministic | Schema, units, bounds, coverage, time, and provenance checks |
| Raster/vector normalization and features | Deterministic | Versioned numerical/geospatial functions |
| Candidate-zone and route generation | Deterministic | No LLM-created geometry |
| Fuel calculation | Deterministic | Vessel model plus explicit inputs |
| Border/MPA intersection | Deterministic | PostGIS/Shapely/PyProj with documented CRS/tolerance |
| Five independent evaluations | Agentic orchestration over deterministic tools | Typed scorecards; no shared score manipulation |
| Hard feasibility | Deterministic | Juror veto or system rule excludes candidate |
| Negotiation | Deterministic policy executed by orchestrator | Feasible candidates only; versioned tie-breaks |
| Natural-language rendering | Optional LLM | May paraphrase immutable bundle only |
| Location and provider observations | Live/near-real-time when sourced as such | Status based on timestamps, never provider marketing |
| Provider payloads, normalized evidence, tiles | Cacheable | Licence, TTL, provenance, validation state enforced |
| Decision result | Cacheable as historical/auditable | Reuse only if all input/evidence fingerprints remain valid |

## 8. Verdict semantics

- **GO:** a feasible winner exists, no veto applies, all required critical evidence is usable, and confidence/risk thresholds meet GO policy.
- **CAUTIOUS GO:** a feasible winner exists without veto, but non-critical uncertainty, marginal conditions, or freshness lowers assurance.
- **NO-GO:** candidates were evaluated and none is feasible, or an explicit trip-wide prohibition applies.
- **DATA_UNAVAILABLE:** a trustworthy feasibility decision cannot be made because required evidence or required user/vessel input is missing, invalid, unsupported, or too stale.

NO-GO and DATA_UNAVAILABLE are distinct: the former is a negative conclusion from adequate evidence; the latter is refusal to pretend certainty.

## 9. Success criteria

- Every displayed value resolves to recorded provenance.
- Every candidate has five typed scorecards or the entire computation fails closed.
- Automated tests prove that a vetoed candidate cannot win regardless of Catch score.
- Geometry and fuel results are replayable from recorded inputs and versions.
- Location and layer states remain understandable on a small mobile viewport.
- Provider outage demonstrations expose cached/stale/unavailable states honestly.
- A reviewer can reconstruct winner selection from the DecisionBundle without an LLM.

## 10. Delivery phases (proposal only)

1. Contracts, schema, deterministic policy engine, captured-real-data test harness.
2. Verified provider adapters and evidence validation.
3. Geospatial candidate/route pipeline and five jurors.
4. Map-first PWA and recommendation workflow.
5. Live trip re-evaluation, offline/degraded behavior, hardening, and field usability.

No phase is authorized for implementation until explicitly approved.

## 11. Open product questions

- TODO: Define launch geography and supported departure harbours.
- TODO: Define supported vessel classes and authoritative fuel-consumption inputs.
- TODO: Confirm target languages, literacy accommodations, and voice requirements.
- TODO: Define acceptable update latency and re-evaluation thresholds for field use.
- TODO: Identify the authority responsible for validating legal/border wording.
- TODO: Define whether fishing regulations beyond MPA/OECM and EEZ references are in V2 scope.
- TODO: Define user accounts, trip history retention, and consent requirements.

