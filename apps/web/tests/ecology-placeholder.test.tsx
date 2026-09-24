import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Jury } from "../components/decision-panel";
import type { Candidate, Scorecard } from "../lib/types";

const ecology: Scorecard = {
  agent: "ecology", zone_id: "ZONE-C", score: 50, veto: false,
  reason_codes: ["DATA_UNAVAILABLE", "PUBLIC_REFERENCE_COVERAGE_INCOMPLETE"],
  reason: "No conflict was found in public polygon records, but coverage is incomplete.",
  evidence_references: ["protected-planet:india:2026-09"], confidence: 0,
  checked_at: "2026-09-23T00:00:00Z",
};

const candidate: Candidate = {
  zone_id: "ZONE-C", user_selected: false, centroid: { latitude: 13, longitude: 74.5 },
  geometry: { type: "Polygon", coordinates: [] }, geometry_role: "DISCOVERY_FOOTPRINT",
  chl: 1, chl_percentile: 80, sst_kelvin: 300, coverage: 1, confidence: .8,
  catch_suitability: 80, evidence_refs: [],
  route: { route_id: "route", distance_km: 20, geometry: { type: "LineString", coordinates: [] }, notice: "" },
  juror_scorecards: [ecology], vetoes: [],
};

describe("Ecology presentation placeholder", () => {
  it("shows only 75 in the collapsed row and keeps the explanation in details", () => {
    render(<Jury candidate={candidate} />);
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.queryByText("75/100")).not.toBeInTheDocument();
    expect(screen.queryByText("PLACEHOLDER · NOT ASSESSED")).not.toBeInTheDocument();
    expect(screen.getByText("Ecology data is insufficient. This value is illustrative and does not affect the decision.")).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(["Demo", "Value"].join(" "), "i"))).not.toBeInTheDocument();
    expect(ecology.score).toBe(50);
    expect(ecology.confidence).toBe(0);
  });
});
