import { DecisionView } from "@/components/decision-view";
export default async function DecisionPage({ params }: { params: Promise<{ caseId: string }> }) { const { caseId } = await params; return <DecisionView caseId={caseId} />; }
