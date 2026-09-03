"use client";
import maplibregl, { Map as MapType } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisResult, Candidate } from "@/lib/types";
type Layer = "chlorophyll" | "sst" | "wave";
type Props = { result: AnalysisResult | null; start: [number, number]; current?: [number, number] | null; selected?: [number, number] | null; activeZone?: Candidate | null; onSelect?: (point: [number, number]) => void; recenterKey?: number };
const fc = (features: object[]) => ({ type: "FeatureCollection" as const, features } as GeoJSON.FeatureCollection);
const point = (lon: number, lat: number, properties: object) => ({ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [lon, lat] }, properties });
const range = (values: number[]) => values.length ? [Math.min(...values), Math.max(...values)] : [0, 1];
const waveOf = (candidate: Candidate) => candidate.juror_scorecards.find(card => card.agent === "safety")?.details?.max_wave_m ?? null;
const readable = (value: string) => value.replaceAll("_", " ");
const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export function MarineMap({ result, start, current, selected, activeZone, onSelect, recenterKey = 0 }: Props) {
  const container = useRef<HTMLDivElement>(null); const map = useRef<MapType | null>(null);
  const [layer, setLayer] = useState<Layer>("chlorophyll"); const [details, setDetails] = useState(false);
  const meta = useMemo(() => { if (!result) return null; const ev = result.evidence.find(item => layer === "chlorophyll" ? item.variable.startsWith("CHL") : layer === "sst" ? item.variable.startsWith("analysed") : item.variable.startsWith("VHM0")); const values = result.candidates.map(c => layer === "chlorophyll" ? c.chl : layer === "sst" ? (c.sst_kelvin == null ? null : c.sst_kelvin - 273.15) : waveOf(c)).filter((v): v is number => v != null); const [min, max] = range(values); return { ev, min, max, unit: layer === "chlorophyll" ? "mg/m³" : layer === "sst" ? "°C" : "m" }; }, [result, layer]);
  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new maplibregl.Map({ container: container.current, style: BASEMAP_STYLE, center: [start[1], start[0]], zoom: 8.1, attributionControl: false });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl(), "top-left");
    instance.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    if (onSelect) instance.on("click", event => onSelect([event.lngLat.lat, event.lngLat.lng]));
    if (process.env.NODE_ENV === "development") instance.on("error", event => console.error("[BLUEJURY MapLibre]", event.error ?? event));
    const resizeObserver = new ResizeObserver(() => instance.resize());
    resizeObserver.observe(container.current);
    const frame = requestAnimationFrame(() => instance.resize());
    instance.once("load", () => instance.resize());
    return () => { cancelAnimationFrame(frame); resizeObserver.disconnect(); instance.remove(); map.current = null; };
  }, [onSelect, start]);
  useEffect(() => { map.current?.easeTo({ center: [(current ?? start)[1], (current ?? start)[0]], duration: 500 }); }, [current, recenterKey, start]);
  useEffect(() => { const m = map.current; if (!m) return; const render = () => {
    ["sample-halo", "sample-values", "zones-fill", "zones-line", "zone-label", "routes-alt", "routes-active", "start-halo", "start-point", "current-halo", "current-point", "selected-ring", "selected-cross"].forEach(id => { if (m.getLayer(id)) m.removeLayer(id); });
    ["samples", "zones", "routes", "markers"].forEach(id => { if (m.getSource(id)) m.removeSource(id); });
    if (result) { const rows = result.candidates.map(candidate => ({ candidate, value: layer === "chlorophyll" ? candidate.chl : layer === "sst" ? (candidate.sst_kelvin == null ? null : candidate.sst_kelvin - 273.15) : waveOf(candidate) })).filter(row => row.value != null); const [min, max] = range(rows.map(row => row.value!));
      m.addSource("samples", { type: "geojson", data: fc(rows.map(row => point(row.candidate.centroid.longitude, row.candidate.centroid.latitude, { value: row.value, label: row.candidate.zone_id.replace("ZONE-", "") }))) });
      m.addLayer({ id: "sample-halo", type: "circle", source: "samples", paint: { "circle-radius": 30, "circle-blur": .35, "circle-opacity": .58, "circle-color": ["interpolate", ["linear"], ["get", "value"], min, layer === "sst" ? "#2b77a8" : "#d9e4c2", max || min + 1, layer === "wave" ? "#d97855" : layer === "sst" ? "#df8b58" : "#087f68"] } });
      m.addSource("zones", { type: "geojson", data: fc(result.candidates.map(c => ({ type: "Feature", geometry: c.geometry, properties: { label: c.zone_id.replace("ZONE-", ""), veto: c.vetoes.length > 0, recommended: c.zone_id === (activeZone ?? result.recommended_zone)?.zone_id } }))) });
      m.addLayer({ id: "zones-fill", type: "fill", source: "zones", paint: { "fill-color": ["case", ["get", "veto"], "#a5433a", ["get", "recommended"], "#087b72", "#527c86"], "fill-opacity": ["case", ["get", "recommended"], .32, .12] } });
      m.addLayer({ id: "zones-line", type: "line", source: "zones", paint: { "line-color": ["case", ["get", "veto"], "#a5433a", ["get", "recommended"], "#075d59", "#567783"], "line-width": ["case", ["get", "recommended"], 3, 1.5] } });
      m.addLayer({ id: "zone-label", type: "symbol", source: "zones", layout: { "text-field": ["get", "label"], "text-size": 14 }, paint: { "text-color": "#082f3d", "text-halo-color": "#fffdf7", "text-halo-width": 2 } });
      m.addSource("routes", { type: "geojson", data: fc(result.candidates.map(c => ({ type: "Feature", geometry: c.route.geometry, properties: { active: c.zone_id === (activeZone ?? result.recommended_zone)?.zone_id, veto: c.vetoes.length > 0 } }))) });
      m.addLayer({ id: "routes-alt", type: "line", source: "routes", filter: ["!=", ["get", "active"], true], paint: { "line-color": ["case", ["get", "veto"], "#a5433a", "#607b84"], "line-opacity": .55, "line-width": 1.5, "line-dasharray": [2, 2] } });
      m.addLayer({ id: "routes-active", type: "line", source: "routes", filter: ["==", ["get", "active"], true], paint: { "line-color": "#062e3c", "line-width": 4 } });
    }
    const markers = [point(start[1], start[0], { kind: "start" }), ...(current ? [point(current[1], current[0], { kind: "current" })] : []), ...(selected ? [point(selected[1], selected[0], { kind: "selected" })] : [])]; m.addSource("markers", { type: "geojson", data: fc(markers) });
    m.addLayer({ id: "start-halo", type: "circle", source: "markers", filter: ["==", ["get", "kind"], "start"], paint: { "circle-radius": 8, "circle-color": "#fff", "circle-stroke-color": "#173f4a", "circle-stroke-width": 2 } }); m.addLayer({ id: "start-point", type: "circle", source: "markers", filter: ["==", ["get", "kind"], "start"], paint: { "circle-radius": 3, "circle-color": "#173f4a" } });
    m.addLayer({ id: "current-halo", type: "circle", source: "markers", filter: ["==", ["get", "kind"], "current"], paint: { "circle-radius": 12, "circle-color": "#138b83", "circle-opacity": .2 } }); m.addLayer({ id: "current-point", type: "circle", source: "markers", filter: ["==", ["get", "kind"], "current"], paint: { "circle-radius": 5, "circle-color": "#08776f", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
    m.addLayer({ id: "selected-ring", type: "circle", source: "markers", filter: ["==", ["get", "kind"], "selected"], paint: { "circle-radius": 16, "circle-color": "transparent", "circle-stroke-color": "#a96315", "circle-stroke-width": 2 } }); m.addLayer({ id: "selected-cross", type: "symbol", source: "markers", filter: ["==", ["get", "kind"], "selected"], layout: { "text-field": "+", "text-size": 22 }, paint: { "text-color": "#8b5010" } });
  }; if (m.loaded()) render(); else m.once("load", render); }, [result, layer, start, current, selected, activeZone]);
  return <div className="marine-map"><div ref={container} className="map-canvas" aria-label="Marine decision map" /><div className="layer-control"><p>MARINE LAYER</p>{(["chlorophyll", "sst", "wave"] as Layer[]).map(item => <button key={item} className={layer === item ? "active" : ""} onClick={() => setLayer(item)}>{item === "chlorophyll" ? "CHL-a" : item === "sst" ? "SST" : "Waves"}</button>)}</div>{meta?.ev && <div className="map-legend"><p>{layer === "chlorophyll" ? "CHLOROPHYLL-a" : layer === "sst" ? "SEA SURFACE TEMPERATURE" : "SIGNIFICANT WAVE HEIGHT"}</p><div className={`legend-ramp ${layer}`} /><div className="legend-range"><span>{meta.min.toFixed(2)}</span><b>{meta.unit}</b><span>{meta.max.toFixed(2)}</span></div><small>{readable(meta.ev.classification)} · {new Date(meta.ev.valid_time).toLocaleDateString([], { month: "short", day: "numeric" })}</small><em>Sampled candidate values</em></div>}{result && <div className="data-control"><button onClick={() => setDetails(!details)}><span><b>MARINE DATA</b><small>{result.evidence.length} SOURCES AVAILABLE</small></span><i>{details ? "−" : "+"}</i></button>{details && <div>{result.evidence.map(item => <p key={item.evidence_ref}><b>{item.variable.split(",")[0]}</b><span>{item.freshness} · valid {new Date(item.valid_time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit" })}</span></p>)}</div>}</div>}<div className="map-note"><b>DECISION-SUPPORT MAP</b><span>{onSelect ? "Select any offshore area to evaluate" : "Not for navigation"}</span></div></div>;
}
