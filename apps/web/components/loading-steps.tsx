"use client";
import { useExperience } from "./experience-provider";
const steps = [["fetching", "fetching"], ["analysing", "analysing"], ["generating", "generating"], ["jury", "runningJury"], ["preparing", "preparing"]] as const;
export function LoadingSteps({ stage }: { stage: string }) { const { t } = useExperience(); const index = steps.findIndex(([key]) => key === stage); return <div className="loading-steps" role="status" aria-live="polite">{steps.map(([key, label], i) => <div key={key} className={i < index || stage === "done" ? "complete" : i === index ? "current" : "pending"}><span>{i < index || stage === "done" ? "✓" : i === index ? "●" : "○"}</span>{t(label)}</div>)}</div>; }
