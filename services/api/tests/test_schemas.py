import pytest
from pydantic import ValidationError

from bluejury.jurors import JURORS
from bluejury.schemas.domain import AgentName, UserPriorities


def test_all_five_jurors_are_registered() -> None:
    assert set(JURORS) == set(AgentName)


def test_priority_weights_must_sum_to_one() -> None:
    priorities = UserPriorities(catch=0.2, safety=0.2, fuel=0.2, ecology=0.2, border=0.2)
    assert priorities.catch == 0.2


def test_invalid_priority_total_is_rejected() -> None:
    with pytest.raises(ValidationError):
        UserPriorities(catch=1, safety=1, fuel=1, ecology=1, border=1)
