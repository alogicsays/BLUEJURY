from uuid import UUID

from sqlalchemy.orm import Session

from bluejury.models import Case
from bluejury.schemas.domain import CaseCreate


class CaseRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create(self, request: CaseCreate) -> Case:
        case = Case(request_payload=request.model_dump(mode="json"))
        self.session.add(case)
        self.session.commit()
        self.session.refresh(case)
        return case

    def get(self, case_id: UUID) -> Case | None:
        return self.session.get(Case, case_id)
