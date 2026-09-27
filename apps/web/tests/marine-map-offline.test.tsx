import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decision } from "./offline-trip-store.test";

const calls = vi.hoisted(() => ({
  options: [] as Array<{ style: unknown }>,
  sources: [] as Array<{ id: string; source: unknown }>,
  click: undefined as ((event: { lngLat: { lat: number; lng: number } }) => void) | undefined,
  styleLoad: undefined as (() => void) | undefined,
  styleLoaded: true,
}));

vi.mock("maplibre-gl", () => {
  class MapMock {
    constructor(options: { style: unknown }) { calls.options.push({ style: options.style }); }
    addControl() {} on(event: string, callback: (event: { lngLat: { lat: number; lng: number } }) => void) { if (event === "click") calls.click = callback; } remove() {} resize() {} triggerRepaint() {} easeTo() {}
    once(event: string, callback: () => void) { if (event === "style.load") calls.styleLoad = callback; }
    off(event: string, callback: () => void) { if (event === "style.load" && calls.styleLoad === callback) calls.styleLoad = undefined; }
    loaded() { return false; } isStyleLoaded() { return calls.styleLoaded; } getLayer() { return undefined; } removeLayer() {}
    getSource() { return undefined; } removeSource() {}
    addSource(id: string, source: unknown) { calls.sources.push({ id, source }); }
    addLayer() {}
  }
  return { default: { Map: MapMock, NavigationControl: class {}, AttributionControl: class {} }, Map: MapMock };
});

import { MarineMap, OFFLINE_BASEMAP_STYLE, ONLINE_BASEMAP_STYLE } from "@/components/marine-map";

class ResizeObserverMock { observe() {} disconnect() {} }

describe("MarineMap offline path", () => {
  beforeEach(() => { calls.options.length = 0; calls.sources.length = 0; calls.click = undefined; calls.styleLoad = undefined; calls.styleLoaded = true; vi.stubGlobal("ResizeObserver", ResizeObserverMock); Object.defineProperty(navigator, "onLine", { configurable: true, value: false }); });

  it("uses a fully local style with zero remote URLs", () => {
    expect(OFFLINE_BASEMAP_STYLE).toMatchObject({ version: 8, sources: {}, layers: [{ id: "offline-ocean", type: "background" }] });
    expect(JSON.stringify(OFFLINE_BASEMAP_STYLE)).not.toMatch(/https?:\/\//);
  });

  it("does not initialize OpenFreeMap offline and restores saved GeoJSON", async () => {
    const candidate = decision.candidates[0];
    const view = render(<MarineMap result={decision} start={[12.918389, 74.771556]} activeZone={candidate} offline />);
    await waitFor(() => expect(calls.sources.map(item => item.id)).toEqual(expect.arrayContaining(["zones", "routes", "markers"])));
    expect(calls.options[0].style).toBe(OFFLINE_BASEMAP_STYLE);
    expect(JSON.stringify(calls.options)).not.toContain("tiles.openfreemap.org");
    const routeSource = calls.sources.find(item => item.id === "routes");
    expect(JSON.stringify(routeSource?.source)).toContain("LineString");
    expect(JSON.stringify(routeSource?.source)).toContain("74.771556");
    expect(() => view.unmount()).not.toThrow();
  });

  it("keeps the online OpenFreeMap path unchanged", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    render(<MarineMap result={null} start={[12.918389, 74.771556]} />);
    expect(ONLINE_BASEMAP_STYLE).toBe("https://tiles.openfreemap.org/styles/liberty");
    expect(calls.options[0].style).toBe(ONLINE_BASEMAP_STYLE);
  });

  it("adds candidate zones when analysis arrives without map interaction", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    const start: [number, number] = [12.918389, 74.771556];
    const onSelect = vi.fn();
    const view = render(<MarineMap result={null} start={start} onSelect={onSelect} />);
    calls.sources.length = 0;

    view.rerender(<MarineMap result={decision} start={start} activeZone={decision.candidates[0]} onSelect={onSelect} />);

    await waitFor(() => expect(calls.sources.some(item => item.id === "zones")).toBe(true));
    expect(calls.options).toHaveLength(1);
    expect(onSelect).not.toHaveBeenCalled();

    act(() => calls.click?.({ lngLat: { lat: 12.95, lng: 74.75 } }));
    expect(onSelect).toHaveBeenCalledWith([12.95, 74.75]);
  });

  it("adds candidate zones when the MapLibre style becomes ready", async () => {
    calls.styleLoaded = false;
    render(<MarineMap result={decision} start={[12.918389, 74.771556]} />);
    expect(calls.sources.some(item => item.id === "zones")).toBe(false);

    act(() => { calls.styleLoaded = true; calls.styleLoad?.(); });

    await waitFor(() => expect(calls.sources.some(item => item.id === "zones")).toBe(true));
  });
});
