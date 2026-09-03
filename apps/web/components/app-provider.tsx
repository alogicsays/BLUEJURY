"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AnalysisResult, Candidate, TripPlan } from "@/lib/types";

const HARBOUR: [number, number] = [12.918389, 74.771556];
const defaultPlan: TripPlan = { start: HARBOUR, startLabel: "New Mangalore Port", fuel: 80, burnRate: .35, reserve: .2, vesselClass: "small_scale", departure: new Date().toISOString().slice(0, 16) };
type Stage = "idle" | "fetching" | "analysing" | "generating" | "jury" | "preparing" | "done";
type ContextValue = { plan: TripPlan; setPlan: (plan: TripPlan) => void; result: AnalysisResult | null; selected: [number, number] | null; setSelected: (point: [number, number] | null) => void; activeZone: Candidate | null; setActiveZone: (zone: Candidate | null) => void; stage: Stage; error: string; runAnalysis: (area?: [number, number], overrideStart?: [number, number]) => Promise<AnalysisResult | null>; reset: () => void };
const AppContext = createContext<ContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<TripPlan>(defaultPlan);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [activeZone, setActiveZone] = useState<Candidate | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  // Restore one small, local-only session so multipage navigation retains the active decision.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const saved = localStorage.getItem("bluejury-session"); if (saved) try { const value = JSON.parse(saved); setPlan(value.plan ?? defaultPlan); setResult(value.result ?? null); setActiveZone(value.activeZone ?? null); } catch { localStorage.removeItem("bluejury-session"); } }, []);
  useEffect(() => { localStorage.setItem("bluejury-session", JSON.stringify({ plan, result, activeZone })); }, [plan, result, activeZone]);
  const runAnalysis = useCallback(async (area?: [number, number], overrideStart?: [number, number]) => {
    setError(""); setStage("fetching");
    const timers = [setTimeout(() => setStage("analysing"), 500), setTimeout(() => setStage("generating"), 1100), setTimeout(() => setStage("jury"), 1800), setTimeout(() => setStage("preparing"), 2500)];
    try {
      const start = overrideStart ?? plan.start;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ start: { latitude: start[0], longitude: start[1], label: plan.startLabel }, selected_area: area ? { latitude: area[0], longitude: area[1], label: "Selected area" } : null, boat: { vessel_class: plan.vesselClass, fuel_available_l: plan.fuel, burn_rate_l_per_km: plan.burnRate, reserve_fraction: plan.reserve }, departure_at: new Date(plan.departure).toISOString() }) });
      if (!response.ok) throw new Error("BLUEJURY could not obtain sufficient marine evidence for this decision.");
      const data = await response.json() as AnalysisResult; setResult(data); setActiveZone(data.recommended_zone); setStage("done"); return data;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Marine evidence unavailable."); setStage("idle"); return null; }
    finally { timers.forEach(clearTimeout); }
  }, [plan]);
  const reset = () => { setResult(null); setActiveZone(null); setSelected(null); setError(""); setStage("idle"); };
  const value = useMemo(() => ({ plan, setPlan, result, selected, setSelected, activeZone, setActiveZone, stage, error, runAnalysis, reset }), [plan, result, selected, activeZone, stage, error, runAnalysis]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useBluejury() { const value = useContext(AppContext); if (!value) throw new Error("BLUEJURY provider is missing"); return value; }
export { HARBOUR };
