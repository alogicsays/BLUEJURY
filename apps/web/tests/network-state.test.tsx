import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider, useBluejury } from "@/components/app-provider";
import { DecisionView } from "@/components/decision-view";
import { LiveTrip } from "@/components/live-trip";
import { persistOfflineTrip, removeOfflineTrip } from "@/lib/offline-trip-store";
import { decision, plan } from "./offline-trip-store.test";

let online = true;
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="offline-map" /> }));
function Probe() { const state = useBluejury(); return <div><span data-testid="network">{state.networkStatus}</span><span data-testid="cache">{state.savedTrip ? "CACHE" : "NO_CACHE"}</span><span data-testid="route">{state.result?.candidates[0].route.route_id ?? "NO_ROUTE"}</span></div>; }

describe("network state", () => {
  beforeEach(async () => { await removeOfflineTrip(); online = true; Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online }); localStorage.clear(); });
  it("transitions online to offline without cache and back to restored", async () => {
    render(<AppProvider><Probe /></AppProvider>); await waitFor(() => expect(screen.getByTestId("cache")).toHaveTextContent("NO_CACHE"));
    online = false; act(() => window.dispatchEvent(new Event("offline"))); expect(screen.getByTestId("network")).toHaveTextContent("OFFLINE_NO_CACHE");
    online = true; act(() => window.dispatchEvent(new Event("online"))); expect(screen.getByTestId("network")).toHaveTextContent("CONNECTION_RESTORED");
  });
  it("restores saved route, veto, timestamps and saved-evidence labelling offline", async () => {
    await persistOfflineTrip(plan, decision, "ZONE-A"); online = false;
    render(<AppProvider><Probe /><DecisionView caseId="saved" /></AppProvider>);
    await waitFor(() => expect(screen.getByTestId("network")).toHaveTextContent("OFFLINE_WITH_CACHE"));
    expect(screen.getByTestId("route")).toHaveTextContent("route-a"); expect(screen.getAllByText("FUEL VETO").length).toBeGreaterThan(0);
    expect(screen.getByText("SAVED EVIDENCE")).toBeInTheDocument(); expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Sep 4, 2026/).length).toBeGreaterThan(0);
  });
  it("keeps the saved trip UI available without a network", async () => {
    await persistOfflineTrip(plan, decision, "ZONE-A"); online = false;
    render(<AppProvider><LiveTrip /></AppProvider>);
    await waitFor(() => expect(screen.getByText("ON ROUTE TO ZONE A")).toBeInTheDocument());
    expect(screen.getByText("SAVED EVIDENCE")).toBeInTheDocument(); expect(screen.getByTestId("offline-map")).toBeInTheDocument();
  });
});
