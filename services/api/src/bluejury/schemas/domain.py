from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=-180, le=180)]


class AgentName(StrEnum):
    CATCH = "catch"
    SAFETY = "safety"
    FUEL = "fuel"
    ECOLOGY = "ecology"
    BORDER = "border"


class Verdict(StrEnum):
    GO = "GO"
    CAUTIOUS_GO = "CAUTIOUS_GO"
    NO_GO = "NO_GO"
    DATA_UNAVAILABLE = "DATA_UNAVAILABLE"


class Freshness(StrEnum):
    LIVE_OR_CURRENT = "LIVE_OR_CURRENT"
    CACHED_CURRENT = "CACHED_CURRENT"
    CACHED_STALE = "CACHED_STALE"
    EXPIRED = "EXPIRED"
    UNKNOWN = "UNKNOWN"


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)


class Harbour(StrictSchema):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    latitude: Latitude
    longitude: Longitude
    country_code: str = Field(min_length=2, max_length=2)


class BoatProfile(StrictSchema):
    name: str = Field(min_length=1, max_length=120)
    vessel_class: str = Field(min_length=1, max_length=80)
    usable_fuel_litres: float = Field(gt=0)
    fuel_consumption_litres_per_hour: float = Field(gt=0)
    cruise_speed_knots: float = Field(gt=0)
    reserve_fraction: float = Field(ge=0, lt=1)


class UserPriorities(StrictSchema):
    catch: float = Field(ge=0, le=1)
    safety: float = Field(ge=0, le=1)
    fuel: float = Field(ge=0, le=1)
    ecology: float = Field(ge=0, le=1)
    border: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def weights_sum_to_one(self) -> "UserPriorities":
        if abs(sum((self.catch, self.safety, self.fuel, self.ecology, self.border)) - 1) > 1e-6:
            raise ValueError("priority weights must sum to 1")
        return self


class RouteSegment(StrictSchema):
    id: UUID
    geometry: dict[str, Any]
    distance_m: float = Field(ge=0)


class CandidateZone(StrictSchema):
    id: UUID
    label: str = Field(min_length=1, max_length=120)
    geometry: dict[str, Any]
    routes: list[RouteSegment] = Field(default_factory=list)


class Evidence(StrictSchema):
    id: UUID
    source: str = Field(min_length=1)
    source_url: HttpUrl
    observed_at: datetime | None = None
    forecast_valid_at: datetime | None = None
    retrieved_at: datetime
    freshness: Freshness
    provenance: dict[str, Any]


class JurorScorecard(StrictSchema):
    agent: AgentName
    zone_id: UUID
    score: int = Field(ge=0, le=100)
    veto: bool
    reason_codes: list[str] = Field(min_length=1)
    reason: str = Field(min_length=1)
    evidence_references: list[UUID] = Field(min_length=1)
    confidence: float = Field(ge=0, le=1)
    checked_at: datetime


class CaseCreate(StrictSchema):
    harbour: Harbour
    boat: BoatProfile
    priorities: UserPriorities
    departure_at: datetime | None = None


class CaseBundle(CaseCreate):
    id: UUID
    status: str
    created_at: datetime
    updated_at: datetime
    evidence: list[Evidence] = Field(default_factory=list)
    candidates: list[CandidateZone] = Field(default_factory=list)


class DecisionBundle(StrictSchema):
    id: UUID
    case_id: UUID
    verdict: Verdict
    recommended_zone: CandidateZone | None
    recommended_route: RouteSegment | None
    scorecards: list[JurorScorecard]
    rejected_alternatives: list[UUID]
    veto_reasons: list[str]
    supporting_evidence: list[Evidence]
    confidence: float = Field(ge=0, le=1)
    explanation: str
    policy_version: str
    created_at: datetime
