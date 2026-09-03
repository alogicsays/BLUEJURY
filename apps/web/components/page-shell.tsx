import { EvidenceEmptyState } from "./evidence-empty-state";

export function PageShell({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return <div className="mx-auto max-w-7xl px-5 py-12"><p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">{eyebrow}</p><h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight">{title}</h1><div className="mt-10">{children ?? <EvidenceEmptyState />}</div></div>;
}

