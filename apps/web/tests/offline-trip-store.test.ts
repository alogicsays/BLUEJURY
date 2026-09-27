import { beforeEach, describe, expect, it } from "vitest";
import { persistOfflineTrip, removeOfflineTrip, retrieveOfflineTrip } from "@/lib/offline-trip-store";
import type { AnalysisResult, TripPlan } from "@/lib/types";

const plan: TripPlan = { start: [12.918389, 74.771556], startLabel: "New Mangalore Port", fuel: 10, burnRate: .35, reserve: .2, vesselClass: "small_scale", departure: "2026-09-04T04:00" };
const fuelVeto = { agent: "fuel" as const, zone_id: "ZONE-A", score: 0, veto: true, reason_codes: ["FUEL_INSUFFICIENT"], reason: "Fuel reserve not met", evidence_references: [] as string[], confidence: .86, checked_at: "2026-09-04T04:01:00Z", details: { required_fuel_l: 35.2, margin_l: -25.2 } };
const ecology = { agent: "ecology" as const, zone_id: "ZONE-A", score: 55, veto: false, reason_codes: ["PROTECTED_AREA_OVERLAP_RESTRICTION_UNVERIFIED"], reason: "TEST_GEOMETRY overlap; restriction unverified", evidence_references: ["TEST_GEOMETRY:ecology"], confidence: .78, checked_at: "2026-09-04T04:01:00Z", details: { provider: "TEST_PROVIDER", retrieved_at: "2026-09-04T04:00:00Z" } };
const border = { agent: "border" as const, zone_id: "ZONE-A", score: 90, veto: false, reason_codes: ["WITHIN_PERMITTED_MARITIME_REFERENCE"], reason: "TEST_GEOMETRY remains inside", evidence_references: ["TEST_GEOMETRY:border"], confidence: .94, checked_at: "2026-09-04T04:01:00Z", details: { provider: "TEST_PROVIDER", version: "TEST" } };
const decision: AnalysisResult = {
  verdict: "NO_GO", recommended_zone: null, overall_confidence: .7, freshness_summary: "Three verified Copernicus sources", generated_at: "2026-09-04T04:01:00Z", policy_version: "mvp-test", why_winner_won: [], hard_veto_trace: [{ zone_id: "ZONE-A", vetoes: [fuelVeto] }],
  evidence: [{ evidence_ref: "wave:VHM0:2026-09-04", provider: "Copernicus Marine Service", product_id: "verified-product", dataset_id: "verified-dataset", variable: "VHM0", unit: "m", valid_time: "2026-09-04T03:00:00Z", retrieved_at: "2026-09-04T03:05:00Z", classification: "FORECAST", freshness: "CURRENT", quality_information: "Provider fill values excluded" }],
  candidates: [{ zone_id: "ZONE-A", user_selected: false, centroid: { latitude: 13.1, longitude: 74.4 }, geometry_role: "DISCOVERY_FOOTPRINT", geometry: { type: "Polygon", coordinates: [[[74.3, 13], [74.5, 13], [74.5, 13.2], [74.3, 13]]] }, chl: 1.23, chl_percentile: 80, sst_kelvin: 300.1, coverage: .8, confidence: .86, catch_suitability: 82, evidence_refs: ["wave:VHM0:2026-09-04"], route: { route_id: "route-a", distance_km: 42, geometry: { type: "LineString", coordinates: [[74.771556, 12.918389], [74.4, 13.1]] }, notice: "Decision support" }, juror_scorecards: [fuelVeto, ecology, border], vetoes: [fuelVeto] }],
};

describe("offline trip persistence", () => {
  beforeEach(async () => removeOfflineTrip());
  it("round-trips the complete accepted decision without creating values", async () => {
    const saved = await persistOfflineTrip(plan, decision, "ZONE-A", new Date("2026-09-04T04:02:00Z")); const restored = await retrieveOfflineTrip();
    expect(restored).toEqual(saved); expect(restored?.decision).toEqual(decision);
    expect(restored?.decision.candidates[0].route.geometry).toEqual(decision.candidates[0].route.geometry);
    expect(restored?.decision.candidates[0].geometry_role).toBe("DISCOVERY_FOOTPRINT");
    expect(restored?.decision.candidates[0].vetoes[0].reason_codes).toContain("FUEL_INSUFFICIENT");
    expect(restored?.decision.candidates[0].juror_scorecards).toEqual(expect.arrayContaining([ecology, border]));
    expect(restored?.decision.evidence[0]).toMatchObject({ classification: "FORECAST", valid_time: "2026-09-04T03:00:00Z", dataset_id: "verified-dataset" });
  });
});

export { decision, plan };
