import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decision, plan } from "./offline-trip-store.test";

const locationMocks = vi.hoisted(() => ({ watch: vi.fn() }));
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="trip-map" /> }));
vi.mock("@/lib/device-location", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/device-location")>();
  return { ...actual, watchForegroundPosition: locationMocks.watch };
});
vi.mock("@/components/offline-actions", () => ({ SaveOfflineTripButton: () => <div data-testid="offline-action" /> }));
vi.mock("@/components/app-provider", () => ({
  useBluejury: () => ({
    plan, result: decision, activeZone: decision.candidates[0], runAnalysis: vi.fn(),
    previewAnalysis: vi.fn(), adoptAnalysis: vi.fn(), isOffline: false,
    savedTrip: null, storageReady: true,
  }),
}));

import { LocationPermissionDeniedError } from "@/lib/device-location";
import { LiveTrip, locationErrorKey } from "@/components/live-trip";

describe("Live Trip start interaction", () => {
  beforeEach(() => locationMocks.watch.mockReset());

  it("runs the handler and shows an immediate state while native location is pending", async () => {
    let resolveWatch!: (stop: () => Promise<void>) => void;
    locationMocks.watch.mockReturnValue(new Promise(resolve => { resolveWatch = resolve; }));
    render(<LiveTrip />);
    fireEvent.click(screen.getByRole("button", { name: "START TRIP" }));
    expect(locationMocks.watch).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "REQUESTING LOCATION…" })).toBeDisabled();
    expect(screen.getByText("REQUESTING DEVICE LOCATION")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "REQUESTING LOCATION…" }));
    expect(locationMocks.watch).toHaveBeenCalledOnce();
    resolveWatch(async () => undefined);
    await waitFor(() => expect(screen.getByText("GPS ACTIVE")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "END TRIP" })).toBeInTheDocument();
  });

  it("shows an actionable permission message when the location callback reports denial", async () => {
    locationMocks.watch.mockImplementation(async (...args: unknown[]) => {
      const callbacks = args.filter(
        (argument): argument is (value: unknown) => void => typeof argument === "function",
      );
      callbacks.at(-1)?.(new LocationPermissionDeniedError("denied"));
      return async () => undefined;
    });
    render(<LiveTrip />);
    fireEvent.click(screen.getByRole("button", { name: "START TRIP" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("GPS permission was denied"));
  });

  it("classifies native permission, disabled-service, and unknown errors", () => {
    expect(locationErrorKey(new LocationPermissionDeniedError("denied"))).toBe("gpsDenied");
    expect(locationErrorKey(new Error("Location services are disabled"))).toBe("gpsServicesDisabled");
    expect(locationErrorKey(new Error("Native bridge failed"))).toBe("gpsStartFailed");
  });
});
