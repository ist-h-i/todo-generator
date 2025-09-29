import pytest

from app import models
from app.utils.repository import apply_updates


class _Dummy:
    def __init__(self) -> None:
        self.name = "before"


def test_apply_updates_sets_existing_attribute_on_plain_object() -> None:
    dummy = _Dummy()

    apply_updates(dummy, {"name": "after"})

    assert dummy.name == "after"


def test_apply_updates_rejects_unknown_attribute_on_plain_object() -> None:
    dummy = _Dummy()

    with pytest.raises(AttributeError):
        apply_updates(dummy, {"missing": "value"})


def test_apply_updates_rejects_unknown_attribute_on_sqlalchemy_model() -> None:
    status = models.Status(id="status-1", name="In Progress", owner_id="owner-1")

    apply_updates(status, {"name": "Done"})
    assert status.name == "Done"

    with pytest.raises(AttributeError):
        apply_updates(status, {"not_a_column": "value"})
