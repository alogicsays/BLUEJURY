"use client";
import Link from "next/link";
import { useBluejury } from "./app-provider";
import { DecisionPanel } from "./decision-panel";
import { useExperience } from "./experience-provider";
export function DecisionView({ caseId }: { caseId: string }) { const { result } = useBluejury(); const { t, formatDate } = useExperience(); if (!result) return <div className="empty-page"><p className="eyebrow">{t("decisionCase", { caseId })}</p><h1>{t("noDecision")}</h1><p>{t("noDecisionCopy")}</p><Link href="/plan" className="button primary">{t("planTrip")}</Link></div>; return <div className="decision-page"><header><p className="eyebrow">{t("verdict")} · {formatDate(result.generated_at)}</p><h1>{t("recommendationTrace")}</h1></header><DecisionPanel result={result} /></div>; }
