"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { persistOfflineTrip, retrieveOfflineTrip } from "@/lib/offline-trip-store";
import type { AnalysisResult, Candidate, NetworkStatus, SavedOfflineTrip, TripPlan } from "@/lib/types";

const HARBOUR: [number, number] = [12.918389, 74.771556];
const defaultPlan: TripPlan = { start: HARBOUR, startLabel: "New Mangalore Port", fuel: 80, burnRate: .35, reserve: .2, vesselClass: "small_scale", departure: new Date().toISOString().slice(0, 16) };
type Stage = "idle" | "fetching" | "analysing" | "generating" | "jury" | "preparing" | "done";
type ContextValue = { plan: TripPlan; setPlan: (plan: TripPlan) => void; result: AnalysisResult | null; selected: [number, number] | null; setSelected: (point: [number, number] | null) => void; activeZone: Candidate | null; setActiveZone: (zone: Candidate | null) => void; stage: Stage; error: string; networkStatus: NetworkStatus; savedTrip: SavedOfflineTrip | null; storageReady: boolean; isOffline: boolean; saveForOffline: () => Promise<SavedOfflineTrip>; runAnalysis: (area?: [number, number], overrideStart?: [number, number]) => Promise<AnalysisResult | null>; previewAnalysis: (origin: [number, number], destination: [number, number], fuelAvailable: number) => Promise<AnalysisResult>; adoptAnalysis: (analysis: AnalysisResult, zone: Candidate) => void; reset: () => void };
const AppContext = createContext<ContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<TripPlan>(defaultPlan);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [activeZone, setActiveZone] = useState<Candidate | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [savedTrip, setSavedTrip] = useState<SavedOfflineTrip | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>("ONLINE");
  const savedTripRef = useRef<SavedOfflineTrip | null>(null);
  // Restore one small, local-only session so multipage navigation retains the active decision.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const saved = localStorage.getItem("bluejury-session"); if (saved) try { const value = JSON.parse(saved); setPlan(value.plan ?? defaultPlan); setResult(value.result ?? null); setActiveZone(value.activeZone ?? null); } catch { localStorage.removeItem("bluejury-session"); } }, []);
  useEffect(() => { localStorage.setItem("bluejury-session", JSON.stringify({ plan, result, activeZone })); }, [plan, result, activeZone]);
  useEffect(() => {
    let active = true;
    retrieveOfflineTrip().then(saved => {
      if (!active) return;
      savedTripRef.current = saved; setSavedTrip(saved); setStorageReady(true);
      if (!navigator.onLine) {
        setNetworkStatus(saved ? "OFFLINE_WITH_CACHE" : "OFFLINE_NO_CACHE");
        if (saved) { setPlan(saved.plan); setResult(saved.decision); setActiveZone(saved.decision.candidates.find(candidate => candidate.zone_id === saved.activeZoneId) ?? saved.decision.recommended_zone); }
        else { setResult(null); setActiveZone(null); }
      }
    }).catch(() => { if (active) { setStorageReady(true); if (!navigator.onLine) setNetworkStatus("OFFLINE_NO_CACHE"); } });
    const offline = () => setNetworkStatus(savedTripRef.current ? "OFFLINE_WITH_CACHE" : "OFFLINE_NO_CACHE");
    const online = () => setNetworkStatus(previous => previous === "ONLINE" ? "ONLINE" : "CONNECTION_RESTORED");
    window.addEventListener("offline", offline); window.addEventListener("online", online);
    return () => { active = false; window.removeEventListener("offline", offline); window.removeEventListener("online", online); };
  }, []);
  const runAnalysis = useCallback(async (area?: [number, number], overrideStart?: [number, number]) => {
    if (!navigator.onLine) { setError("Marine evidence unavailable offline. View the saved decision or reconnect to refresh marine evidence."); return null; }
    setError(""); setStage("fetching");
    const timers = [setTimeout(() => setStage("analysing"), 500), setTimeout(() => setStage("generating"), 1100), setTimeout(() => setStage("jury"), 1800), setTimeout(() => setStage("preparing"), 2500)];
    try {
      const start = overrideStart ?? plan.start;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ start: { latitude: start[0], longitude: start[1], label: plan.startLabel }, selected_area: area ? { latitude: area[0], longitude: area[1], label: "Selected area" } : null, boat: { vessel_class: plan.vesselClass, fuel_available_l: plan.fuel, burn_rate_l_per_km: plan.burnRate, reserve_fraction: plan.reserve }, departure_at: new Date(plan.departure).toISOString() }) });
      if (!response.ok) throw new Error("BLUEJURY could not obtain sufficient marine evidence for this decision.");
      const data = await response.json() as AnalysisResult; setResult(data); setActiveZone(data.recommended_zone); setNetworkStatus("ONLINE"); setStage("done"); return data;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Marine evidence unavailable."); setStage("idle"); return null; }
    finally { timers.forEach(clearTimeout); }
  }, [plan]);
  const previewAnalysis = useCallback(async (origin: [number, number], destination: [number, number], fuelAvailable: number) => {
    if (!navigator.onLine) throw new Error("Alternative-zone checks require a backend connection.");
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/analyze`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start: { latitude: origin[0], longitude: origin[1], label: "Current GPS position" },
        selected_area: { latitude: destination[0], longitude: destination[1], label: "Current destination" },
        boat: { vessel_class: plan.vesselClass, fuel_available_l: fuelAvailable, burn_rate_l_per_km: plan.burnRate, reserve_fraction: plan.reserve },
        departure_at: new Date().toISOString(),
      }),
    });
    if (!response.ok) throw new Error("A fresh alternative-zone comparison could not be completed.");
    return await response.json() as AnalysisResult;
  }, [plan.vesselClass, plan.burnRate, plan.reserve]);
  const adoptAnalysis = useCallback((analysis: AnalysisResult, zone: Candidate) => {
    setResult(analysis); setActiveZone(zone); setSelected(null); setError(""); setStage("done");
  }, []);
  const saveForOffline = useCallback(async () => {
    if (!result) throw new Error("A completed BLUEJURY decision is required before saving offline.");
    const saved = await persistOfflineTrip(plan, result, activeZone?.zone_id ?? result.recommended_zone?.zone_id ?? null);
    savedTripRef.current = saved; setSavedTrip(saved);
    if (!navigator.onLine) setNetworkStatus("OFFLINE_WITH_CACHE");
    return saved;
  }, [plan, result, activeZone]);
  const reset = () => { setResult(null); setActiveZone(null); setSelected(null); setError(""); setStage("idle"); };
  const isOffline = networkStatus === "OFFLINE_WITH_CACHE" || networkStatus === "OFFLINE_NO_CACHE";
  const value = useMemo(() => ({ plan, setPlan, result, selected, setSelected, activeZone, setActiveZone, stage, error, networkStatus, savedTrip, storageReady, isOffline, saveForOffline, runAnalysis, previewAnalysis, adoptAnalysis, reset }), [plan, result, selected, activeZone, stage, error, networkStatus, savedTrip, storageReady, isOffline, saveForOffline, runAnalysis, previewAnalysis, adoptAnalysis]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useBluejury() { const value = useContext(AppContext); if (!value) throw new Error("BLUEJURY provider is missing"); return value; }
export { HARBOUR };
