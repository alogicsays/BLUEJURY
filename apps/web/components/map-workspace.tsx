"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useBluejury } from "./app-provider";
import { DecisionPanel, Jury, VetoBlock } from "./decision-panel";
import { LoadingSteps } from "./loading-steps";
import { useExperience } from "./experience-provider";
const MarineMap = dynamic(() => import("./marine-map").then(m => m.MarineMap), { ssr: false });

export function MapWorkspace() {
  const search = useSearchParams();
  const { t } = useExperience();
  const { plan, result, selected, setSelected, activeZone, setActiveZone, stage, error, runAnalysis, isOffline, storageReady } = useBluejury();
  const ran = useRef(false); const [sheet, setSheet] = useState(false); const [areaResult, setAreaResult] = useState(false);
  useEffect(() => { if (storageReady && !isOffline && search.get("analyze") === "1" && !ran.current) { ran.current = true; void runAnalysis(); } }, [search, runAnalysis, isOffline, storageReady]);
  const evaluate = async () => { if (selected && !isOffline) { const value = await runAnalysis(selected); setAreaResult(Boolean(value)); } };
  const selectedCandidate = result?.candidates.find(c => c.user_selected); const selectedVeto = selectedCandidate?.vetoes[0];
  const better = result && selectedCandidate && result.recommended_zone?.zone_id !== selectedCandidate.zone_id ? result.recommended_zone : null;
  const routeSelected = () => { if (selectedCandidate) setActiveZone(selectedCandidate); };
  const verdictLabel = (value: string) => value === "GO" ? t("go") : value === "NO_GO" ? t("noGo") : t("cautiousGo");
  return <div className="map-workspace"><MarineMap result={result} start={plan.start} selected={selected} activeZone={activeZone} offline={isOffline} onSelect={isOffline ? undefined : point => { setSelected(point); setAreaResult(false); }} /><aside className={`analysis-panel ${sheet ? "sheet-open" : ""}`}>{result && <button className="sheet-handle" onClick={() => setSheet(!sheet)}><span>{verdictLabel(result.verdict)} · {(activeZone ?? result.recommended_zone)?.zone_id.replace("ZONE-", "ZONE ")}</span><small>{t("viewDecision")} {sheet ? "↓" : "↑"}</small></button>}<div className="panel-scroll">{stage !== "idle" && stage !== "done" ? <><div className="panel-title"><p className="eyebrow">{t("analysis")}</p><h1>{t("evaluatingArea")}</h1></div><LoadingSteps stage={stage} /></> : error && !isOffline ? <div className="failure"><p className="eyebrow">{t("marineUnavailable")}</p><h1>{t("insufficientConfidence")}</h1><p>{error}</p><button className="button secondary" onClick={() => runAnalysis(selected ?? undefined)}>{t("retry")}</button></div> : selected && (!areaResult || !selectedCandidate) && !isOffline ? <div className="selected-card"><p className="eyebrow">{t("selectedDestination")}</p><h1 className="coordinates">{selected[0].toFixed(4)}° N<br />{selected[1].toFixed(4)}° E</h1><p>{t("selectedCopy")}</p><button className="button primary" onClick={evaluate}>{t("evaluateArea")}</button>{result && <button className="button text-button" onClick={() => setSelected(null)}>{t("returnRecommendation")}</button>}</div> : areaResult && selectedCandidate && !isOffline ? <div className="area-verdict"><p className="eyebrow">{t("destinationVerdict")}</p><h1 className={`verdict ${selectedVeto ? "no-go" : "cautious"}`}>{selectedVeto ? t("noGo") : t("cautiousGo")}</h1><h2>{t("selectedDestination")} · {selectedCandidate.zone_id.replace("ZONE-", "")}</h2>{selectedVeto ? <VetoBlock candidate={selectedCandidate} /> : <><p className="verdict-copy">{t("selectedCopy")}</p><Jury candidate={selectedCandidate} /><button className="button primary" onClick={routeSelected}>{t("routeMeHere")}</button></>}{better && <div className="better"><p>{t("betterAlternative")}</p><b>{better.zone_id.replace("ZONE-", "ZONE ")}</b><span>{t("higherScore")}</span><button className="button secondary" onClick={() => { setActiveZone(better); setSelected(null); }}>{t("viewZone", { zone: better.zone_id.replace("ZONE-", "ZONE ") })}</button></div>}</div> : result ? <><DecisionPanel result={result} compact /><Link href="/decision/latest" className="button decision-link">{t("viewDecision")} →</Link></> : <div className="waiting"><p className="eyebrow">{isOffline ? t("offlineNoTrip") : t("marineAnalysis")}</p><h1>{isOffline ? t("offlineUnavailable") : t("waitingEvidence")}</h1><p>{isOffline ? t("offlineConnect") : t("waitingCopy")}</p>{!isOffline && <Link href="/plan" className="button primary">{t("planTrip")}</Link>}</div>}</div></aside></div>;
}
