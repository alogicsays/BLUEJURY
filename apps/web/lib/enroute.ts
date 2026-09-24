import type { AnalysisResult, Candidate, Scorecard, TripPlan } from "./types";

export const MIN_MEANINGFUL_SCORE_ADVANTAGE = 5;

export type AlternativeSuggestion = {
  analysis: AnalysisResult;
  current: Candidate;
  alternative: Candidate;
  scoreAdvantage: number;
  currentDistanceKm: number;
  alternativeDistanceKm: number;
  currentFuelRequiredL: number | null;
  alternativeFuelRequiredL: number | null;
  remainingFuelL: number;
  evidenceValidTime: string;
  checkedAt: string;
  reason: "CURRENT_INFEASIBLE" | "MEANINGFUL_DECISION_ADVANTAGE";
  signature: string;
};

const radians = (degrees: number) => degrees * Math.PI / 180;
const localPoint = (coordinate: [number, number], originLat: number): [number, number] => [
  coordinate[0] * Math.cos(radians(originLat)) * 111.32,
  coordinate[1] * 110.57,
];

export function routeProgressKm(route: GeoJSON.LineString, position: [number, number]): number {
  const coordinates = route.coordinates as [number, number][];
  if (coordinates.length < 2) return 0;
  const p = localPoint([position[1], position[0]], position[0]);
  let cumulative = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestProgress = 0;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const a = localPoint(coordinates[index], position[0]);
    const b = localPoint(coordinates[index + 1], position[0]);
    const dx = b[0] - a[0]; const dy = b[1] - a[1];
    const lengthSquared = dx * dx + dy * dy;
    const fraction = lengthSquared ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared)) : 0;
    const projected: [number, number] = [a[0] + fraction * dx, a[1] + fraction * dy];
    const perpendicular = Math.hypot(p[0] - projected[0], p[1] - projected[1]);
    const segmentLength = Math.sqrt(lengthSquared);
    if (perpendicular < bestDistance) { bestDistance = perpendicular; bestProgress = cumulative + fraction * segmentLength; }
    cumulative += segmentLength;
  }
  return Math.max(0, Math.min(cumulative, bestProgress));
}

export function estimateRemainingFuel(plan: TripPlan, route: GeoJSON.LineString, position: [number, number]): number {
  return Math.max(0, plan.fuel - routeProgressKm(route, position) * plan.burnRate);
}

const fuelRequired = (candidate: Candidate): number | null => {
  const card = candidate.juror_scorecards.find(item => item.agent === "fuel");
  return typeof card?.details?.required_fuel_l === "number" ? card.details.required_fuel_l : null;
};

const isPlaceholder = (card: Scorecard | undefined) => Boolean(card && card.agent === "ecology" && card.confidence === 0 && card.reason_codes.includes("DATA_UNAVAILABLE"));

export function buildAlternativeSuggestion(
  analysis: AnalysisResult,
  remainingFuelL: number,
): AlternativeSuggestion | null {
  if (!analysis.evidence.length || analysis.evidence.some(item => item.freshness !== "CURRENT")) return null;
  const current = analysis.candidates.find(candidate => candidate.user_selected);
  const alternative = analysis.recommended_zone;
  if (!current || !alternative || alternative.zone_id === current.zone_id || alternative.vetoes.length) return null;
  const currentEcology = current.juror_scorecards.find(card => card.agent === "ecology");
  const alternativeEcology = alternative.juror_scorecards.find(card => card.agent === "ecology");
  for (const [candidate, ecology] of [[current, currentEcology], [alternative, alternativeEcology]] as const) {
    if (isPlaceholder(ecology) && !candidate.negotiation_details?.excluded_agents.includes("ecology")) return null;
  }
  if (current.negotiated_score == null || alternative.negotiated_score == null) return null;
  const advantage = alternative.negotiated_score - current.negotiated_score;
  const currentInfeasible = current.vetoes.length > 0;
  if (!currentInfeasible && advantage < MIN_MEANINGFUL_SCORE_ADVANTAGE) return null;
  const validTimes = analysis.evidence.map(item => item.valid_time).filter(Boolean).sort();
  return {
    analysis, current, alternative, scoreAdvantage: advantage,
    currentDistanceKm: current.route.distance_km,
    alternativeDistanceKm: alternative.route.distance_km,
    currentFuelRequiredL: fuelRequired(current), alternativeFuelRequiredL: fuelRequired(alternative),
    remainingFuelL, evidenceValidTime: validTimes.at(-1) ?? analysis.generated_at,
    checkedAt: analysis.generated_at,
    reason: currentInfeasible ? "CURRENT_INFEASIBLE" : "MEANINGFUL_DECISION_ADVANTAGE",
    signature: `${current.centroid.latitude.toFixed(3)},${current.centroid.longitude.toFixed(3)}:${alternative.centroid.latitude.toFixed(3)},${alternative.centroid.longitude.toFixed(3)}`,
  };
}
