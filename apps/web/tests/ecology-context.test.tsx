import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Jury } from "../components/decision-panel";
import type { Candidate, Scorecard } from "../lib/types";

const ecology: Scorecard = {
  agent: "ecology", zone_id: "ZONE-C", score: 50, veto: false,
  reason_codes: ["DATA_UNAVAILABLE", "PUBLIC_REFERENCE_COVERAGE_INCOMPLETE"],
  reason: "Comprehensive ecological clearance is unavailable.",
  evidence_references: ["protected-planet:WDPCA:2026-09:IND-public"],
  confidence: 0, checked_at: "2026-09-21T00:00:00Z",
  details: { supplementary_ecological_context: [{
    record_id: "wii-icmba-2013-mulki-pavanje", site_name: "Mulki-Pavanje",
    publication_year: 2013, geometry_semantics: "POINT_CONTEXT_ONLY",
    destination_distance_km: 8.652, route_distance_km: 8.652,
    display_notice: "Historical biodiversity context only; not a protected-area boundary, fishing restriction, or ecological clearance.",
  }] },
};

const candidate = {
  zone_id: "ZONE-C", juror_scorecards: [ecology], vetoes: [],
} as unknown as Candidate;

describe("Ecology supplementary context", () => {
  it("shows WII point context without presenting clearance or a restriction", () => {
    render(<Jury candidate={candidate} />);
    expect(screen.getByText("HISTORICAL BIODIVERSITY CONTEXT")).toBeInTheDocument();
    expect(screen.getByText(/Mulki-Pavanje · WII 2013/)).toBeInTheDocument();
    expect(screen.getByText(/8.652 km from destination/)).toBeInTheDocument();
    expect(screen.getByText(/not a protected-area boundary/)).toBeInTheDocument();
    expect(screen.getByText(/notification not verified/)).toBeInTheDocument();
  });
});
