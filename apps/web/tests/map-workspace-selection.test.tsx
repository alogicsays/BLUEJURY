import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

const runAnalysis = vi.hoisted(() => vi.fn().mockResolvedValue(null));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/dynamic", () => ({
  default: () => function MapStub({ onSelect }: { onSelect?: (point: [number, number]) => void }) {
    return <button onClick={() => onSelect?.([12.95, 74.75])}>MAP TAP</button>;
  },
}));

vi.mock("@/components/app-provider", () => ({
  useBluejury: () => {
    const [selected, setSelected] = useState<[number, number] | null>(null);
    return {
      plan: { start: [12.918389, 74.771556] as [number, number] },
      result: null,
      selected,
      setSelected,
      activeZone: null,
      setActiveZone: vi.fn(),
      stage: "idle",
      error: "",
      runAnalysis,
      isOffline: false,
      storageReady: true,
    };
  },
}));

import { MapWorkspace } from "@/components/map-workspace";

describe("MapWorkspace selected-area flow", () => {
  it("keeps map selection and Evaluate This Area connected", async () => {
    render(<MapWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "MAP TAP" }));
    expect(screen.getByText("SELECTED DESTINATION")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "EVALUATE THIS AREA" }));
    await waitFor(() => expect(runAnalysis).toHaveBeenCalledWith([12.95, 74.75]));
  });
});
