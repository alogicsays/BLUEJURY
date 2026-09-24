export type Agent = "catch" | "safety" | "fuel" | "ecology" | "border";
export type FootprintRole = "DISCOVERY_FOOTPRINT" | "FISHING_ACTIVITY_AREA";

export type Evidence = {
  evidence_ref: string; provider: string; product_id: string; dataset_id: string;
  variable: string; unit: string; valid_time: string; retrieved_at: string;
  classification: "RECENT_SATELLITE_OBSERVATION" | "ANALYSIS" | "FORECAST";
  freshness: "CURRENT" | "CACHED" | "STALE"; quality_information: string;
};

export type Scorecard = {
  agent: Agent; zone_id: string; score: number; veto: boolean; reason_codes: string[];
  reason: string; evidence_references: string[]; confidence: number; checked_at: string;
  details?: Record<string, unknown> & { max_wave_m?: number; threshold_m?: number;
    round_trip_distance_km?: number; base_fuel_l?: number; required_fuel_l?: number;
    margin_l?: number; notice?: string; evaluated_scope?: string;
    provider?: string; dataset?: string; version?: string;
    release_month?: string; coverage_note?: string;
    supplementary_ecological_context?: Array<{
      record_id?: string; site_name?: string; provider?: string; publication?: string;
      publication_year?: number; geometry_semantics?: string; classification?: string;
      context_status?: string; designation_status?: string; fishing_restriction_status?: string;
      destination_distance_km?: number; route_distance_km?: number; evidence_ref?: string;
      display_notice?: string;
    }>;
    footprint_outside_km2?: number; footprint_outside_percent?: number };
};

export type Candidate = {
  zone_id: string; user_selected: boolean; centroid: { latitude: number; longitude: number };
  geometry: GeoJSON.Polygon; geometry_role?: FootprintRole; chl: number | null; chl_percentile: number;
  sst_kelvin: number | null; coverage: number; confidence: number; catch_suitability: number;
  evidence_refs: string[]; route: { route_id: string; distance_km: number; geometry: GeoJSON.LineString; notice: string };
  juror_scorecards: Scorecard[]; vetoes: Scorecard[]; negotiated_score?: number;
  negotiation_details?: { excluded_agents: Agent[]; eligible_agents: Agent[]; weights_renormalized: boolean };
};

export type AnalysisResult = {
  verdict: "GO" | "CAUTIOUS_GO" | "NO_GO"; recommended_zone: Candidate | null;
  candidates: Candidate[]; evidence: Evidence[]; hard_veto_trace: { zone_id: string; vetoes: Scorecard[] }[];
  why_winner_won: string[]; overall_confidence: number; freshness_summary: string;
  generated_at: string; policy_version: string;
};

export type TripPlan = {
  start: [number, number]; startLabel: string; fuel: number; burnRate: number;
  reserve: number; vesselClass: "small_scale" | "mechanized"; departure: string;
};

export type SavedOfflineTrip = {
  schemaVersion: 1;
  id: "active-trip";
  savedAt: string;
  plan: TripPlan;
  decision: AnalysisResult;
  activeZoneId: string | null;
};

export type NetworkStatus = "ONLINE" | "OFFLINE_WITH_CACHE" | "OFFLINE_NO_CACHE" | "CONNECTION_RESTORED";
