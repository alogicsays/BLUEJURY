import { describe, expect, it } from "vitest";
import { isEcologyPlaceholder, statusFor } from "../components/decision-panel";
import type { Scorecard } from "../lib/types";

const card: Scorecard = {
  agent: "ecology", zone_id: "TEST_GEOMETRY", score: 70, veto: false,
  reason_codes: ["NEAR_PROTECTED_AREA"], reason: "Test geometry only",
  evidence_references: ["TEST_GEOMETRY"], confidence: 0.7, checked_at: "2026-09-20T00:00:00Z",
};

describe("Ecology status", () => {
  it("does not label a proximity caution CLEAR because its score is 70", () => {
    expect(statusFor(card)).toBe("VERIFIED CONCERN");
  });

  it("distinguishes source failure from checked but incomplete coverage", () => {
    expect(statusFor({ ...card, confidence: 0, evidence_references: [], reason_codes: ["DATA_UNAVAILABLE"] })).toBe("SOURCE UNAVAILABLE");
    expect(statusFor({ ...card, confidence: 0, reason_codes: ["DATA_UNAVAILABLE", "PUBLIC_REFERENCE_COVERAGE_INCOMPLETE"] })).toBe("CHECKED · INSUFFICIENT COVERAGE");
    expect(isEcologyPlaceholder({ ...card, confidence: 0, reason_codes: ["DATA_UNAVAILABLE", "PUBLIC_REFERENCE_COVERAGE_INCOMPLETE"] })).toBe(true);
    expect(isEcologyPlaceholder(card)).toBe(false);
  });

  it("reserves verified restriction for a genuine veto", () => {
    expect(statusFor({ ...card, score: 0, veto: true, reason_codes: ["CONFIRMED_NO_TAKE_FISHING_LOCATION"] })).toBe("VERIFIED RESTRICTION");
    expect(statusFor({ ...card, reason_codes: ["PROTECTED_AREA_OVERLAP_RESTRICTION_UNVERIFIED"] })).toBe("VERIFIED CONCERN");
  });
});
