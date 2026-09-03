"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

const MarineMap = dynamic(() => import("./marine-map").then(module => module.MarineMap), { ssr: false });
const HARBOUR: [number, number] = [12.918389, 74.771556];

export function MvpConsole() {
  const [start, setStart] = useState<[number, number]>(HARBOUR);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [result, setResult] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [fuel, setFuel] = useState(80);
  const select = useCallback((point: [number, number]) => setSelected(point), []);
  const locate = () => {
    setStatus("Locating vessel…");
    navigator.geolocation.getCurrentPosition(position => {
      setStart([position.coords.latitude, position.coords.longitude]);
      setStatus(`Current position · GPS ±${Math.round(position.coords.accuracy)} m`);
    }, () => setStatus("Location unavailable — using selected harbour"), { enableHighAccuracy: true, timeout: 10000 });
  };
  const analyze = async (area?: [number, number]) => {
    setError(""); setStatus("Fetching marine evidence…");
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ start: { latitude: start[0], longitude: start[1], label: "Departure" }, selected_area: area ? { latitude: area[0], longitude: area[1], label: "Selected area" } : null, boat: { vessel_class: "small_scale", fuel_available_l: fuel, burn_rate_l_per_km: 0.35, reserve_fraction: 0.2 }, departure_at: new Date().toISOString() }) });
      if (!response.ok) throw new Error((await response.json()).detail ?? "Marine analysis failed");
      setResult(await response.json()); setStatus("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Marine evidence unavailable"); setStatus(""); }
  };
  return <div className="grid h-[calc(100vh-65px)] grid-cols-1 lg:grid-cols-[69fr_31fr]"><MarineMap result={result} start={start} onSelect={select} /><aside className="overflow-y-auto border-l bg-[#f7f8f6] p-6"><header className="mb-6"><p className="text-[11px] font-bold tracking-[.18em] text-teal-700">MARINE DECISION INTELLIGENCE</p><h1 className="mt-1 text-2xl font-bold">Where should I go?</h1><p className="mt-1 text-xs text-slate-500">3 verified Copernicus sources</p></header>{!result ? <><h2 className="text-xs font-bold tracking-wider">WHERE ARE YOU STARTING FROM?</h2><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={locate} className="rounded-md bg-slate-900 p-3 text-sm font-bold text-white">Use My Location</button><button onClick={() => setStart(HARBOUR)} className="rounded-md border bg-white p-3 text-sm font-bold">Plan From Harbour</button></div><p className="mt-2 text-xs text-slate-500">New Mangalore Port · NMPT verified coordinate</p><label className="mt-7 block border-t pt-6 text-xs font-bold">FUEL AVAILABLE</label><div className="mt-2 flex items-center gap-3"><input aria-label="Fuel available" type="number" value={fuel} onChange={event => setFuel(Number(event.target.value))} className="w-full rounded-md border bg-white p-3 tabular-nums" /><b>L</b></div><details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold">Boat profile & priorities</summary><p className="mt-2 text-slate-600">Small-scale · 0.35 L/km · 20% reserve · balanced priorities</p></details>{selected && <div className="mt-6 border-l-4 border-amber-500 bg-white p-4"><b className="text-xs">SELECTED AREA</b><p className="mt-1 tabular-nums">{selected[0].toFixed(4)}° N, {selected[1].toFixed(4)}° E</p><button onClick={() => analyze(selected)} className="mt-3 w-full rounded-md border border-amber-600 p-2 font-bold">Evaluate This Area</button></div>}<button onClick={() => analyze()} className="mt-7 w-full rounded-md bg-teal-700 p-4 font-bold text-white">FIND BEST FISHING ZONES</button></> : <Decision result={result} reset={() => setResult(null)} />}{status && <div role="status" className="mt-6 border-t pt-5"><b className="text-teal-700">{status}</b><div className="mt-3 h-1 bg-teal-600" /><p className="mt-3 text-sm text-slate-500">Analysing ocean → generating zones → running five-member jury</p></div>}{error && <div role="alert" className="mt-5 border-l-4 border-red-600 bg-white p-4"><b>MARINE EVIDENCE UNAVAILABLE</b><p className="mt-2 text-sm">{error}</p></div>}</aside></div>;
}

function Decision({ result, reset }: { result: any; reset: () => void }) {
  const winner = result.recommended_zone;
  return <section><p className="text-xs font-bold tracking-[.18em]">BLUEJURY VERDICT</p><div className={`mt-2 text-5xl font-black ${result.verdict === "NO_GO" ? "text-red-700" : "text-amber-600"}`}>{result.verdict.replaceAll("_", " ")}</div>{winner ? <><h2 className="mt-3 text-2xl font-bold">{winner.zone_id}</h2><p className="text-slate-600">Best feasible option under current evidence and MVP policy.</p><div className="my-5 grid grid-cols-2 border-y py-4"><Metric label="ONE-WAY" value={`${winner.route.distance_km.toFixed(1)} km`} /><Metric label="CHL CONTEXT" value={`${winner.chl_percentile.toFixed(0)}th pct`} /></div><h3 className="text-xs font-bold">FIVE-MEMBER JURY</h3><div className="mt-2 divide-y border-y">{winner.juror_scorecards.map((score: any) => <details key={score.agent} className="py-3"><summary className="flex cursor-pointer justify-between"><b className="capitalize">{score.agent}</b><b className={score.veto ? "text-red-700" : score.confidence === 0 ? "text-slate-500" : ""}>{score.veto ? "VETO" : score.confidence === 0 ? "UNAVAILABLE" : score.score}</b></summary><p className="mt-2 text-sm leading-6 text-slate-600">{score.reason}</p><p className="text-xs text-slate-500">Confidence {Math.round(score.confidence * 100)}%</p></details>)}</div><h3 className="mt-6 text-xs font-bold">WHY THIS ZONE?</h3><ul className="mt-2 space-y-2 text-sm">{result.why_winner_won.map((reason: string) => <li key={reason}>✓ {reason}</li>)}</ul><details className="mt-6 bg-white p-4"><summary className="cursor-pointer font-bold">View Marine Evidence</summary>{result.evidence.map((item: any) => <div key={item.evidence_ref} className="mt-4 border-t pt-3 text-xs leading-5"><b>{item.variable}</b><br />{item.provider} · {item.classification}<br />Valid {new Date(item.valid_time).toUTCString()}<br />Retrieved {new Date(item.retrieved_at).toUTCString()}<details><summary>Technical details</summary><code className="break-all">{item.dataset_id}</code></details></div>)}</details></> : <p className="mt-4">Every candidate was vetoed. High Catch potential cannot override critical Safety or Fuel constraints.</p>}<h3 className="mt-6 text-xs font-bold">OTHER OPTIONS</h3>{result.candidates.filter((candidate: any) => candidate.zone_id !== winner?.zone_id).map((candidate: any) => <div key={candidate.zone_id} className="flex justify-between border-t py-3"><b>{candidate.zone_id}</b><span className={candidate.vetoes.length ? "text-red-700" : "text-slate-500"}>{candidate.vetoes[0] ? `${candidate.vetoes[0].agent.toUpperCase()} VETO` : `${candidate.route.distance_km.toFixed(1)} km`}</span></div>)}<button onClick={reset} className="mt-6 w-full rounded-md border p-3 font-bold">New evaluation</button></section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-bold text-slate-500">{label}</p><p className="mt-1 text-xl font-bold tabular-nums">{value}</p></div>; }
