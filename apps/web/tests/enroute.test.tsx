import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AlternativeSuggestionPanel } from "@/components/live-trip";
import { buildAlternativeSuggestion, estimateRemainingFuel, routeProgressKm } from "@/lib/enroute";
import type { AnalysisResult, Candidate, Scorecard, TripPlan } from "@/lib/types";

const ecology = (score = 50): Scorecard => ({ agent: "ecology", zone_id: "ZONE-A", score, veto: false, reason_codes: ["DATA_UNAVAILABLE", "PUBLIC_REFERENCE_COVERAGE_INCOMPLETE"], reason: "Coverage incomplete", evidence_references: ["official-reference"], confidence: 0, checked_at: "2026-09-23T10:00:00Z" });
const fuel = (zone: string, required: number): Scorecard => ({ agent: "fuel", zone_id: zone, score: 80, veto: false, reason_codes: ["FUEL_RESERVE_MET"], reason: "Fuel feasible", evidence_references: [], confidence: .86, checked_at: "2026-09-23T10:00:00Z", details: { required_fuel_l: required } });
const candidate = (zone: string, userSelected: boolean, score: number, distance: number, requiredFuel: number): Candidate => ({
  zone_id: zone, user_selected: userSelected, centroid: { latitude: userSelected ? 13 : 13.1, longitude: userSelected ? 74.5 : 74.4 },
  geometry: { type: "Polygon", coordinates: [] }, geometry_role: "DISCOVERY_FOOTPRINT", chl: 1, chl_percentile: 80,
  sst_kelvin: 300, coverage: .8, confidence: .86, catch_suitability: 80, evidence_refs: [],
  route: { route_id: zone, distance_km: distance, geometry: { type: "LineString", coordinates: [[74.5, 12.9], [74.4, 13.1]] }, notice: "" },
  juror_scorecards: [fuel(zone, requiredFuel), { ...ecology(), zone_id: zone }], vetoes: [], negotiated_score: score,
  negotiation_details: { excluded_agents: ["ecology"], eligible_agents: ["catch", "safety", "fuel", "border"], weights_renormalized: true },
});
const analysis = (freshness: "CURRENT" | "CACHED" = "CURRENT"): AnalysisResult => {
  const current = candidate("ZONE-A", true, 70, 18, 16);
  const alternative = candidate("ZONE-B", false, 76, 14, 12);
  return { verdict: "CAUTIOUS_GO", recommended_zone: alternative, candidates: [current, alternative], evidence: [{ evidence_ref: "real", provider: "Copernicus Marine Service", product_id: "p", dataset_id: "d", variable: "VHM0", unit: "m", valid_time: "2026-09-23T09:00:00Z", retrieved_at: "2026-09-23T09:05:00Z", classification: "FORECAST", freshness, quality_information: "fill values excluded" }], hard_veto_trace: [], why_winner_won: [], overall_confidence: .8, freshness_summary: "verified", generated_at: "2026-09-23T10:00:00Z", policy_version: "test" };
};

describe("en-route alternative decisions", () => {
  it("uses current route progress to estimate remaining fuel", () => {
    const route: GeoJSON.LineString = { type: "LineString", coordinates: [[74, 12], [74, 13]] };
    const progress = routeProgressKm(route, [12.5, 74]);
    expect(progress).toBeGreaterThan(54);
    expect(progress).toBeLessThan(57);
    const plan: TripPlan = { start: [12, 74], startLabel: "start", fuel: 100, burnRate: .2, reserve: .2, vesselClass: "small_scale", departure: "2026-09-23T08:00" };
    expect(estimateRemainingFuel(plan, route, [12.5, 74])).toBeCloseTo(100 - progress * .2, 6);
  });

  it("rejects stale evidence, vetoed alternatives, and tiny advantages", () => {
    expect(buildAlternativeSuggestion(analysis("CACHED"), 60)).toBeNull();
    const vetoed = analysis(); vetoed.recommended_zone!.vetoes = [fuel("ZONE-B", 100)];
    expect(buildAlternativeSuggestion(vetoed, 60)).toBeNull();
    const tiny = analysis(); tiny.recommended_zone!.negotiated_score = 74;
    expect(buildAlternativeSuggestion(tiny, 60)).toBeNull();
  });

  it("does not use the Ecology presentation value in comparison", () => {
    const original = analysis();
    const first = buildAlternativeSuggestion(original, 60);
    original.candidates.forEach(item => { const card = item.juror_scorecards.find(value => value.agent === "ecology")!; card.score = 75; });
    const second = buildAlternativeSuggestion(original, 60);
    expect(first?.alternative.zone_id).toBe("ZONE-B");
    expect(second?.alternative.zone_id).toBe(first?.alternative.zone_id);
    expect(second?.scoreAdvantage).toBe(first?.scoreAdvantage);
  });

  it("keeps the destination on dismiss and requires confirmation before switching", () => {
    const suggestion = buildAlternativeSuggestion(analysis(), 60)!;
    const dismiss = vi.fn(); const switchDestination = vi.fn();
    render(<AlternativeSuggestionPanel suggestion={suggestion} onDismiss={dismiss} onSwitch={switchDestination} />);
    fireEvent.click(screen.getByRole("button", { name: "KEEP CURRENT DESTINATION" }));
    expect(dismiss).toHaveBeenCalledOnce(); expect(switchDestination).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "SWITCH DESTINATION" }));
    expect(switchDestination).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "CONFIRM SWITCH" }));
    expect(switchDestination).toHaveBeenCalledOnce();
  });
});
