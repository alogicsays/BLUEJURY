export function EvidenceEmptyState({ detail = "Verified provider data has not been connected yet. No marine values or recommendations are being generated." }: { detail?: string }) {
  return <section role="status" className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><div className="mb-4 h-2 w-12 rounded bg-teal-700" /><h1 className="text-2xl font-bold tracking-tight">Waiting for marine evidence</h1><p className="mt-3 max-w-xl leading-7 text-slate-600">{detail}</p><p className="mt-5 text-sm font-semibold text-slate-500">DATA UNAVAILABLE · No synthetic fallback</p></section>;
}

