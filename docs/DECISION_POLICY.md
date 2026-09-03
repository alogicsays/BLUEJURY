# BLUEJURY AI V2 — Decision Policy

Status: policy framework. Numeric operational thresholds are intentionally TODO until source products, launch geography, vessel classes, and domain guidance are verified.

## 1. Invariants

1. Each candidate zone-route pair is independently assessed by Catch, Safety, Fuel, Ecology, and Border jurors.
2. All five valid scorecards are required before a candidate can be considered.
3. A veto cannot be averaged, weighted, negotiated, or explained away.
4. Only candidates passing every hard-feasibility rule enter negotiation.
5. Catch score never compensates for safety, legal/ecological prohibition, border, or fuel infeasibility.
6. Scores, vetoes, confidence, and explanations are deterministic functions of frozen inputs and versioned policy.
7. Missing critical evidence yields DATA_UNAVAILABLE for the affected scope, not a neutral score.
8. An optional LLM cannot alter the DecisionBundle.

## 2. Evaluation unit

The atomic evaluation unit is a candidate zone plus one route from one departure state at one decision time. If a zone has multiple routes, each is evaluated separately. Jurors receive only evidence relevant to that evaluation plus explicit missingness/quality metadata.

## 3. Scorecard semantics

`score` is a juror-specific 0–100 suitability measure under its versioned rubric; it is not probability. Higher is better. A score remains present when a veto applies so the rejected candidate can be explained, but veto controls feasibility.

`confidence` is 0–1 confidence in that juror’s score given coverage, freshness, quality, agreement, and required-input completeness. It is not allowed to erase a hard threshold observed in adequate evidence.

`reason_codes` are stable, machine-readable, documented, and versioned. At least one reason code is required. Candidate examples (not final operational rules) include `WAVE_LIMIT_EXCEEDED`, `FUEL_RESERVE_INSUFFICIENT`, `MPA_INTERSECTION_PROHIBITED`, `BOUNDARY_CROSSING_UNACCEPTABLE`, `CRITICAL_EVIDENCE_MISSING`, and `EVIDENCE_STALE`.

## 4. Hard veto framework

### Safety veto

Veto when verified evidence shows a configured vessel/operation limit is exceeded along the relevant route/time or at the zone, or an authoritative active warning prohibits the operation.

TODO: Establish vessel-class limits, warning categories, exposure aggregation, forecast horizon, and spatial/temporal buffers with marine-safety expertise.

### Fuel veto

Veto when deterministic estimated trip consumption plus required reserve exceeds trusted usable fuel, or the route exceeds verified vessel range.

Required model inputs should include route length, vessel consumption model, usable fuel, reserve rule, and explicitly approved environmental adjustments. If critical inputs are missing, return DATA_UNAVAILABLE rather than assume feasibility.

TODO: Define vessel-specific consumption functions, reserve policy, units, speed assumptions, loiter/fishing allowance, and whether verified wind/current corrections are sufficiently reliable.

### Ecology veto

Veto when the zone or route intersects an area where the contemplated activity is confirmed prohibited under an authoritative, effective rule. Conservative buffers may be used only if documented and versioned.

An MPA/OECM intersection alone must not be called illegal unless the source establishes the applicable restriction. When designation geometry exists but regulation semantics are unresolved, mark legal constraint unknown and use DATA_UNAVAILABLE or cautious routing according to criticality.

TODO: Acquire authoritative regulation attributes and decide zone-versus-transit rules.

### Border veto

Veto when a zone or route crosses a configured unacceptable maritime boundary or buffer. Reference/disputed boundaries require explicit policy and non-legal wording.

TODO: Define home jurisdiction, permitted areas, disputed-area treatment, boundary buffer, GPS uncertainty treatment, and authority-approved rule set.

### System feasibility veto

Candidates are rejected for invalid geometry, unnavigable/unsupported route, location outside supported coverage, or incomplete jury. These are system exclusions; missing critical evidence typically escalates the overall outcome to DATA_UNAVAILABLE rather than claiming NO-GO.

## 5. Juror inputs and responsibilities

| Juror | Deterministic evidence/features | May veto | Must not do |
|---|---|---|---|
| Catch | Verified PFZ if admitted; chlorophyll/SST features and quality; temporal/spatial support | Normally no; may mark unevaluable | Invent fish abundance or zones |
| Safety | Waves, wind, warnings, route/time exposure, vessel limits | Yes | Infer missing weather or override limits |
| Fuel | Route distance/time, vessel model, fuel/reserve, approved environmental terms | Yes | Guess consumption/fuel or route geometry |
| Ecology | MPA/OECM geometry and verified applicable restrictions | Yes | Treat all designations as identical prohibitions |
| Border | Reference boundaries, jurisdiction policy, geometry intersections/buffers | Yes | Make legal determinations beyond configured rules |

## 6. Confidence framework

Each juror calculates component factors in `[0,1]`:

- completeness/coverage;
- freshness/time alignment;
- provider quality flags and product fitness;
- spatial resolution/support relative to candidate geometry;
- input certainty (for example location accuracy and vessel-profile quality);
- source agreement where a reviewed multi-source rule exists.

The aggregation function must be conservative, monotonic, versioned, and tested. A weighted mean alone is disallowed if it can hide a zero critical component. A proposed form is a weighted geometric mean with mandatory component floors, but remains TODO pending scientific review.

Rules:

- Missing critical component: juror unevaluable; candidate/decision DATA_UNAVAILABLE as applicable.
- Stale-but-permitted cache: explicit freshness penalty and no `LIVE` label.
- Partial coverage: calculate support ratio; below critical floor is unavailable, above it may reduce confidence.
- Conflicting verified sources: apply approved precedence/agreement rule or reduce confidence; do not cherry-pick favorable values.
- Overall decision confidence cannot exceed the minimum confidence of any feasibility-critical juror and should include winner-separation stability.
- Confidence shall not convert an observed hard breach into a non-veto. If evidence quality is too poor to establish the breach, the correct outcome is uncertainty/unavailability.

TODO: Set component weights, floors, coverage requirements, and GO/CAUTIOUS_GO confidence thresholds after real sample analysis.

## 7. Negotiation among feasible candidates

Negotiation is a transparent multi-criteria decision policy, not free-form agent debate:

1. Remove all vetoed/system-infeasible candidates.
2. Enforce minimum non-veto thresholds and required confidence floors.
3. Construct a Pareto frontier across the five scores so a strictly dominated candidate cannot win.
4. Apply published, versioned weights only to remaining candidates.
5. Apply deterministic tie-breakers in order: safer candidate, greater fuel margin, lower ecological/border exposure, higher confidence, then stable candidate ID.
6. Record each elimination and comparison in the decision trace.

Proposed weights and minimums are TODO. Stakeholder/domain review is required; they must sum to one and cannot weaken hard constraints. User preferences may reorder feasible options but cannot modify veto or minimum-feasibility rules.

## 8. Verdict computation

```text
if critical request input or critical evidence is unavailable:
    DATA_UNAVAILABLE
else if no complete candidates can be evaluated for a technical/data reason:
    DATA_UNAVAILABLE
else if every evaluated candidate is vetoed or hard-infeasible:
    NO_GO
else:
    winner = negotiate(feasible candidates)
    if winner meets GO score, margin, freshness, and confidence rules:
        GO
    else:
        CAUTIOUS_GO
```

CAUTIOUS_GO never means “a veto exists but scores are good.” It applies only to a feasible, non-vetoed winner.

## 9. Winner explanation

The explanation must state:

- what was recommended and from which start point/time;
- why it beat each material alternative;
- all five scores and confidences;
- decisive constraints and margins in user-friendly units;
- whether evidence is current, cached-current, or cached-stale;
- important uncertainty and coverage gaps;
- source names and relevant times;
- explicit rejected alternatives and veto reason codes.

No claim may appear unless it maps to a scorecard, feasibility trace, or evidence record.

## 10. Re-evaluation and hysteresis

Material changes initiate a new immutable decision run. To prevent route/verdict oscillation, use versioned hysteresis: a new feasible winner replaces the current winner only when required by a new veto or when its advantage exceeds a configured stability margin. Safety/fuel/ecology/border veto changes publish immediately after validation.

TODO: Set location movement, elapsed-time, evidence-revision, score-delta, and stability thresholds.

## 11. Policy governance

Every DecisionBundle records policy version, juror versions, thresholds, feature/candidate/route algorithm versions, and evidence fingerprints. Policy changes require domain review, migration notes, invariant tests, and replay against golden cases. Historical decisions are not silently recomputed.

