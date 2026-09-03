from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class StartPoint(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    label: str = "Current position"


class MvpBoat(BaseModel):
    vessel_class: Literal["small_scale", "mechanized"] = "small_scale"
    fuel_available_l: float = Field(gt=0)
    burn_rate_l_per_km: float = Field(gt=0)
    reserve_fraction: float = Field(ge=0, lt=1)


class AnalyzeRequest(BaseModel):
    start: StartPoint
    boat: MvpBoat
    departure_at: datetime
    selected_area: StartPoint | None = None
    priorities: dict[str, float] = Field(
        default_factory=lambda: {
            "catch": 0.35,
            "safety": 0.3,
            "fuel": 0.2,
            "ecology": 0.075,
            "border": 0.075,
        }
    )


class AnalyzeResponse(BaseModel):
    verdict: str
    recommended_zone: dict[str, Any] | None
    candidates: list[dict[str, Any]]
    evidence: list[dict[str, Any]]
    hard_veto_trace: list[dict[str, Any]]
    why_winner_won: list[str]
    overall_confidence: float
    freshness_summary: str
    generated_at: datetime
    policy_version: str
