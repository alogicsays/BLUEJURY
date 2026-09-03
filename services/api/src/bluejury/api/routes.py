from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from bluejury.db import get_session
from bluejury.models import Decision
from bluejury.repositories.cases import CaseRepository
from bluejury.schemas.domain import CaseBundle, CaseCreate, DecisionBundle
from bluejury.schemas.mvp import AnalyzeRequest, AnalyzeResponse
from bluejury.services.cases import case_to_bundle
from bluejury.services.mvp import analyze

router = APIRouter(prefix="/api/v1")
DbSession = Annotated[Session, Depends(get_session)]


@router.get("/health")
def api_health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/cases", response_model=CaseBundle, status_code=status.HTTP_201_CREATED)
def create_case(payload: CaseCreate, session: DbSession) -> CaseBundle:
    return case_to_bundle(CaseRepository(session).create(payload))


@router.get("/cases/{case_id}", response_model=CaseBundle)
def get_case(case_id: UUID, session: DbSession) -> CaseBundle:
    case = CaseRepository(session).get(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case_to_bundle(case)


@router.get("/cases/{case_id}/decision", response_model=DecisionBundle)
def get_decision(case_id: UUID, session: DbSession) -> DecisionBundle:
    if CaseRepository(session).get(case_id) is None:
        raise HTTPException(status_code=404, detail="Case not found")
    decision = session.query(Decision).filter(Decision.case_id == case_id).one_or_none()
    if decision is None:
        raise HTTPException(status_code=404, detail="Decision not available")
    return DecisionBundle.model_validate(decision.bundle)


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_case(payload: AnalyzeRequest) -> AnalyzeResponse:
    try:
        return analyze(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
