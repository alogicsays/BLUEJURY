from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from geoalchemy2 import Geometry
from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from bluejury.models.base import Base, TimestampMixin


class Case(TimestampMixin, Base):
    __tablename__ = "cases"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    status: Mapped[str] = mapped_column(String(32), default="WAITING_FOR_EVIDENCE")
    request_payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    evidence_snapshots: Mapped[list["EvidenceSnapshot"]] = relationship(
        cascade="all, delete-orphan"
    )
    candidate_zones: Mapped[list["CandidateZoneModel"]] = relationship(cascade="all, delete-orphan")
    decision: Mapped["Decision | None"] = relationship(cascade="all, delete-orphan")


class EvidenceSnapshot(Base):
    __tablename__ = "evidence_snapshots"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    case_id: Mapped[UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"))
    source: Mapped[str] = mapped_column(String(255))
    source_url: Mapped[str] = mapped_column(Text)
    observed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    forecast_valid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    freshness: Mapped[str] = mapped_column(String(32))
    provenance: Mapped[dict[str, Any]] = mapped_column(JSON)


class CandidateZoneModel(Base):
    __tablename__ = "candidate_zones"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    case_id: Mapped[UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String(120))
    geometry: Mapped[Any] = mapped_column(Geometry("POLYGON", srid=4326))
    properties: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    routes: Mapped[list["Route"]] = relationship(cascade="all, delete-orphan")
    scorecards: Mapped[list["JurorScorecardModel"]] = relationship(cascade="all, delete-orphan")


class Route(Base):
    __tablename__ = "routes"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    candidate_zone_id: Mapped[UUID] = mapped_column(
        ForeignKey("candidate_zones.id", ondelete="CASCADE")
    )
    geometry: Mapped[Any] = mapped_column(Geometry("LINESTRING", srid=4326))
    distance_m: Mapped[float] = mapped_column(Float)
    properties: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class JurorScorecardModel(Base):
    __tablename__ = "juror_scorecards"
    __table_args__ = (
        UniqueConstraint("candidate_zone_id", "agent", name="uq_scorecard_zone_agent"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    candidate_zone_id: Mapped[UUID] = mapped_column(
        ForeignKey("candidate_zones.id", ondelete="CASCADE")
    )
    agent: Mapped[str] = mapped_column(String(16))
    score: Mapped[int] = mapped_column(Integer)
    veto: Mapped[bool] = mapped_column(Boolean)
    reason_codes: Mapped[list[str]] = mapped_column(JSON)
    reason: Mapped[str] = mapped_column(Text)
    evidence_references: Mapped[list[str]] = mapped_column(JSON)
    confidence: Mapped[float] = mapped_column(Float)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Decision(Base):
    __tablename__ = "decisions"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    case_id: Mapped[UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), unique=True)
    verdict: Mapped[str] = mapped_column(String(32))
    bundle: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
