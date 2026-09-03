"use client";
import Link from "next/link";
import { useBluejury } from "./app-provider";
import { DecisionPanel } from "./decision-panel";
export function DecisionView({ caseId }: { caseId: string }) { const { result } = useBluejury(); if (!result) return <div className="empty-page"><p className="eyebrow">DECISION CASE {caseId}</p><h1>No decision is loaded.</h1><p>Run a marine analysis first. BLUEJURY will never fill this page with demonstration values.</p><Link href="/plan" className="button primary">PLAN A TRIP</Link></div>; return <div className="decision-page"><header><p className="eyebrow">DECISION · {new Date(result.generated_at).toLocaleString()}</p><h1>Recommendation and evidence trace</h1></header><DecisionPanel result={result} /></div>; }
