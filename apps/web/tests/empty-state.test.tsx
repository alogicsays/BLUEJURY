import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidenceEmptyState } from "../components/evidence-empty-state";

describe("EvidenceEmptyState", () => {
  it("does not imply that marine evidence is available", () => {
    render(<EvidenceEmptyState />);
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for marine evidence");
  });
});

