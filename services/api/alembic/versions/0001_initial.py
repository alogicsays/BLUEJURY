"""Create core decision tables."""

from collections.abc import Sequence

import sqlalchemy as sa
from geoalchemy2 import Geometry

from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.create_table(
        "cases",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("request_payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "evidence_snapshots",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "case_id", sa.Uuid(), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("source", sa.String(255), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True)),
        sa.Column("forecast_valid_at", sa.DateTime(timezone=True)),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("freshness", sa.String(32), nullable=False),
        sa.Column("provenance", sa.JSON(), nullable=False),
    )
    op.create_table(
        "candidate_zones",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "case_id", sa.Uuid(), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("geometry", Geometry("POLYGON", srid=4326), nullable=False),
        sa.Column("properties", sa.JSON(), nullable=False),
    )
    op.create_table(
        "routes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "candidate_zone_id",
            sa.Uuid(),
            sa.ForeignKey("candidate_zones.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("geometry", Geometry("LINESTRING", srid=4326), nullable=False),
        sa.Column("distance_m", sa.Float(), nullable=False),
        sa.Column("properties", sa.JSON(), nullable=False),
    )
    op.create_table(
        "juror_scorecards",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "candidate_zone_id",
            sa.Uuid(),
            sa.ForeignKey("candidate_zones.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("agent", sa.String(16), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("veto", sa.Boolean(), nullable=False),
        sa.Column("reason_codes", sa.JSON(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("evidence_references", sa.JSON(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("candidate_zone_id", "agent", name="uq_scorecard_zone_agent"),
    )
    op.create_table(
        "decisions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "case_id",
            sa.Uuid(),
            sa.ForeignKey("cases.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("verdict", sa.String(32), nullable=False),
        sa.Column("bundle", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    for table in [
        "decisions",
        "juror_scorecards",
        "routes",
        "candidate_zones",
        "evidence_snapshots",
        "cases",
    ]:
        op.drop_table(table)
