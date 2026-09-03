from bluejury.models import Case
from bluejury.schemas.domain import CaseBundle, CaseCreate


def case_to_bundle(case: Case) -> CaseBundle:
    request = CaseCreate.model_validate(case.request_payload)
    return CaseBundle(
        **request.model_dump(),
        id=case.id,
        status=case.status,
        created_at=case.created_at,
        updated_at=case.updated_at,
    )
