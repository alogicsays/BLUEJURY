import { Suspense } from "react";
import { MapWorkspace } from "@/components/map-workspace";
export default function MapPage() { return <Suspense fallback={<div className="empty-page">BLUEJURY…</div>}><MapWorkspace /></Suspense>; }
