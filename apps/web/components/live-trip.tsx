"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LocationPermissionDeniedError, watchForegroundPosition } from "@/lib/device-location";
import { buildAlternativeSuggestion, estimateRemainingFuel, type AlternativeSuggestion } from "@/lib/enroute";
import { useBluejury } from "./app-provider";
import { statusFor } from "./decision-panel";
import { SaveOfflineTripButton } from "./offline-actions";
import { useExperience } from "./experience-provider";
const MarineMap = dynamic(() => import("./marine-map").then(m => m.MarineMap), { ssr: false });
const distance = (a: [number, number], b: [number, number]) => { const r = 6371; const dLat = (b[0] - a[0]) * Math.PI / 180; const dLon = (b[1] - a[1]) * Math.PI / 180; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return 2 * r * Math.asin(Math.sqrt(x)); };
export function locationErrorKey(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (error instanceof LocationPermissionDeniedError || message.includes("permission") || message.includes("denied")) return "gpsDenied" as const;
  if (message.includes("disabled") || message.includes("location services") || message.includes("settings")) return "gpsServicesDisabled" as const;
  return "gpsStartFailed" as const;
}

export function AlternativeSuggestionPanel({ suggestion, onDismiss, onSwitch }: { suggestion: AlternativeSuggestion; onDismiss: () => void; onSwitch: () => void }) {
  const { t, formatDate } = useExperience();
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const label = (zone: string) => zone.replace("ZONE-", "ZONE ");
  return <section className="alternative-suggestion" aria-label={t("alternativeAvailable")}>
    <p className="eyebrow">{t("alternativeAvailable")}</p>
    <h2>{label(suggestion.alternative.zone_id)}</h2>
    <p>{t(suggestion.reason === "CURRENT_INFEASIBLE" ? "alternativeReasonInfeasible" : "alternativeReasonAdvantage", { value: Math.max(0, suggestion.scoreAdvantage).toFixed(1) })}</p>
    <div className="alternative-actions"><button className="button secondary" onClick={() => setExpanded(value => !value)}>{t("viewComparison")}</button><button className="button text-button" onClick={onDismiss}>{t("keepDestination")}</button><button className="button primary" onClick={() => setConfirming(true)}>{t("switchDestination")}</button></div>
    {expanded && <div className="alternative-comparison">
      <div className="comparison-head"><span>{t("comparisonMetric")}</span><b>{label(suggestion.current.zone_id)}</b><b>{label(suggestion.alternative.zone_id)}</b></div>
      <div><span>{t("decisionScore")}</span><b>{suggestion.current.negotiated_score?.toFixed(1)}</b><b>{suggestion.alternative.negotiated_score?.toFixed(1)}</b></div>
      <div><span>{t("remainingDistance")}</span><b>{suggestion.currentDistanceKm.toFixed(1)} km</b><b>{suggestion.alternativeDistanceKm.toFixed(1)} km</b></div>
      <div><span>{t("travelTime")}</span><b>{t("speedUnavailable")}</b><b>{t("speedUnavailable")}</b></div>
      <div><span>{t("remainingFuelRequired")}</span><b>{suggestion.currentFuelRequiredL?.toFixed(1) ?? "—"} L</b><b>{suggestion.alternativeFuelRequiredL?.toFixed(1) ?? "—"} L</b></div>
      <p>{t("estimatedFuelAvailable", { value: suggestion.remainingFuelL.toFixed(1) })}</p>
      <p>{t("comparisonFreshness", { time: formatDate(suggestion.evidenceValidTime) })}<br />{t("lastCompared", { time: formatDate(suggestion.checkedAt) })}</p>
    </div>}
    {confirming && <div className="switch-confirm" role="alertdialog" aria-label={t("confirmSwitch")}><p>{t("confirmSwitchCopy", { current: label(suggestion.current.zone_id), alternative: label(suggestion.alternative.zone_id) })}</p><button className="button secondary" onClick={() => setConfirming(false)}>{t("cancel")}</button><button className="button primary" onClick={onSwitch}>{t("confirmSwitch")}</button></div>}
  </section>;
}

export function LiveTrip() {
  const { plan, result, activeZone, runAnalysis, previewAnalysis, adoptAnalysis, isOffline, savedTrip, storageReady } = useBluejury();
  const { t, formatDate } = useExperience();
  const stopWatch = useRef<(() => Promise<void>) | null>(null);
  const dismissedSuggestion = useRef<string | null>(null);
  const [tracking, setTracking] = useState(false); const [starting, setStarting] = useState(false); const [position, setPosition] = useState<[number, number] | null>(null); const [accuracy, setAccuracy] = useState<number | null>(null); const [locationError, setLocationError] = useState(""); const [recenter, setRecenter] = useState(0);
  const [suggestion, setSuggestion] = useState<AlternativeSuggestion | null>(null); const [comparisonState, setComparisonState] = useState(""); const [checking, setChecking] = useState(false);
  const zone = activeZone ?? result?.recommended_zone ?? null;
  useEffect(() => () => { void stopWatch.current?.(); }, []);
  const locationMessage = (error: unknown) => t(locationErrorKey(error));
  const startTrip = async () => {
    if (starting || tracking) return;
    setStarting(true); setLocationError("");
    try {
      const stop = await watchForegroundPosition(
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
        next => { setPosition([next.latitude, next.longitude]); setAccuracy(next.accuracy); setLocationError(""); },
        error => setLocationError(locationMessage(error)),
      );
      stopWatch.current = stop; setTracking(true);
    } catch (error) { setLocationError(locationMessage(error)); }
    finally { setStarting(false); }
  };
  const end = () => { void stopWatch.current?.(); stopWatch.current = null; setTracking(false); setPosition(null); setAccuracy(null); setSuggestion(null); };
  const checkAlternatives = async () => {
    if (isOffline) { setComparisonState(t("alternativesRequireConnection")); return; }
    if (!position || !zone) { setComparisonState(t("alternativesRequireGps")); return; }
    const remainingFuel = estimateRemainingFuel(plan, zone.route.geometry, position);
    if (remainingFuel <= 0) { setComparisonState(t("remainingFuelUnavailable")); return; }
    setChecking(true); setComparisonState(""); setSuggestion(null);
    try {
      const analysis = await previewAnalysis(position, [zone.centroid.latitude, zone.centroid.longitude], remainingFuel);
      if (analysis.evidence.some(item => item.freshness !== "CURRENT")) { setComparisonState(t("freshEvidenceRequired")); return; }
      const next = buildAlternativeSuggestion(analysis, remainingFuel);
      if (!next) { setComparisonState(t("noMeaningfulAlternative")); return; }
      if (dismissedSuggestion.current === next.signature) { setComparisonState(t("dismissedAlternativeUnchanged")); return; }
      setSuggestion(next);
    } catch { setComparisonState(t("alternativeCheckUnavailable")); }
    finally { setChecking(false); }
  };
  if (!storageReady) return <div className="empty-page"><p className="eyebrow">{t("liveTrip")}</p><h1>{t("loadingTrip")}</h1></div>;
  if (!result || !zone) return <div className="empty-page"><p className="eyebrow">{isOffline ? t("offlineNoTrip") : t("liveTrip")}</p><h1>{isOffline ? t("offlineUnavailable") : t("noRoute")}</h1><p>{isOffline ? t("offlineConnect") : t("noRouteCopy")}</p>{!isOffline && <Link href="/plan" className="button primary">{t("planTrip")}</Link>}</div>;
  const latestEvidence = result.evidence.map(item => new Date(item.valid_time).getTime()).filter(Number.isFinite).sort((a, b) => b - a)[0];
  const remaining = position ? distance(position, [zone.centroid.latitude, zone.centroid.longitude]) : zone.route.distance_km;
  const translatedStatus = (raw: string) => ({ "VERIFIED CONCERN": t("verifiedConcern"), "VERIFIED RESTRICTION": t("verifiedRestriction"), "CHECKED · INSUFFICIENT COVERAGE": t("insufficientCoverage"), "SOURCE UNAVAILABLE": t("sourceUnavailable"), "DATA UNAVAILABLE": t("dataUnavailable"), CLEAR: t("clear"), STRONG: t("strong"), MODERATE: t("moderate"), VETO: t("veto"), CAUTION: t("caution"), "POINT + ROUTE CLEAR": t("pointRouteClear"), "AREA + ROUTE CLEAR": t("areaRouteClear") }[raw] ?? raw);
  return <div className="trip-workspace"><MarineMap result={result} start={plan.start} current={position} activeZone={zone} recenterKey={recenter} offline={isOffline} /><aside className="trip-panel"><div className="trip-status"><p className="eyebrow" role="status">{tracking ? t("gpsActive") : starting ? t("locationStarting") : t("tripReady")}</p><h1>{t("onRoute", { zone: zone.zone_id.replace("ZONE-", "ZONE ") })}</h1><strong>{remaining.toFixed(1)} km <small>{t("remaining")}</small></strong>{accuracy != null && <span>{t("positionAccuracy", { value: Math.round(accuracy) })}</span>}</div>{locationError && <div className="location-error" role="alert"><b>{t("gpsUnavailable")}</b><p>{locationError}</p></div>}<div className="trip-jury">{zone.juror_scorecards.filter(card => card.agent !== "catch").map(card => <div key={card.agent}><span>{t(card.agent)}</span><b className={card.veto ? "bad" : card.confidence === 0 ? "muted" : statusFor(card) === "VERIFIED CONCERN" ? "caution" : "good"}>{translatedStatus(statusFor(card))}</b></div>)}</div><div className="freshness"><span>{t("marineEvidence")}</span><b>{isOffline ? t("savedEvidence") : result.freshness_summary}</b><small>{isOffline && savedTrip ? `${t("savedAt", { time: formatDate(savedTrip.savedAt) })} · ` : ""}{t("latestValid", { time: latestEvidence ? formatDate(latestEvidence) : "—" })}</small></div>
  {tracking && <section className="alternative-check"><button className="button secondary" disabled={checking} onClick={() => void checkAlternatives()}>{checking ? t("checkingAlternatives") : t("checkAlternatives")}</button>{comparisonState && <p role="status">{comparisonState}</p>}</section>}
  {suggestion && <AlternativeSuggestionPanel suggestion={suggestion} onDismiss={() => { dismissedSuggestion.current = suggestion.signature; setSuggestion(null); setComparisonState(t("keptCurrentDestination")); }} onSwitch={() => { adoptAnalysis(suggestion.analysis, suggestion.alternative); dismissedSuggestion.current = null; setSuggestion(null); setComparisonState(t("destinationSwitched")); }} />}
  <SaveOfflineTripButton compact />{tracking ? <div className="trip-controls"><button className="button secondary" onClick={() => setRecenter(v => v + 1)}>{t("recenter")}</button>{!isOffline && <button className="button primary" onClick={() => position && runAnalysis(undefined, position)}>{t("reevaluate")}</button>}<button className="button text-button" onClick={end}>{t("endTrip")}</button></div> : <button className="button primary" disabled={starting} aria-busy={starting} onClick={() => void startTrip()}>{starting ? t("requestingLocation") : t("startTrip")}</button>}<p className="navigation-note">{t("navigationNote")}</p></aside></div>;
}
