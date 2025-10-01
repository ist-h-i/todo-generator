from __future__ import annotations

import importlib.abc
import importlib.machinery
import sys
from types import ModuleType, SimpleNamespace
from unittest import TestCase

import pytest

from backend.app import sqlalchemy_py313_compat as compat

assertions = TestCase()


@pytest.fixture(autouse=True)
def reset_compat_globals(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ensure tests do not leak compat state into one another."""

    monkeypatch.setattr(compat, "_finder", None)
    yield
    sys.modules.pop("sqlalchemy.util.langhelpers", None)


@pytest.fixture
def restore_meta_path(monkeypatch: pytest.MonkeyPatch) -> None:
    original = list(sys.meta_path)
    try:
        yield
    finally:
        sys.meta_path[:] = original


def _make_langhelpers_module(init_calls: list[type] | None = None) -> ModuleType:
    module = ModuleType("sqlalchemy.util.langhelpers")
    call_log: list[type] = init_calls if init_calls is not None else []

    class TypingOnly:
        @classmethod
        def __init_subclass__(cls) -> None:
            call_log.append(cls)

    module.TypingOnly = TypingOnly  # type: ignore[attr-defined]
    module._dunders = SimpleNamespace(match=lambda name: name.startswith("__") and name.endswith("__"))
    module.call_log = call_log  # type: ignore[attr-defined]
    return module


def test_patch_langhelpers_enforces_typingonly_contract() -> None:
    module = _make_langhelpers_module()
    compat._patch_langhelpers(module)

    class ValidSubclass(module.TypingOnly):  # type: ignore[misc, valid-type]
        __firstlineno__ = 1
        __static_attributes__ = ()

    assertions.assertTrue(ValidSubclass in module.call_log)
    patched_descriptor = module.TypingOnly.__dict__["__init_subclass__"]  # type: ignore[attr-defined]
    assertions.assertTrue(getattr(patched_descriptor, compat._PATCH_ATTRIBUTE) is True)

    with pytest.raises(AssertionError) as exc:

        class InvalidSubclass(module.TypingOnly):  # type: ignore[misc, valid-type]
            extra_attribute = True

    assertions.assertTrue("extra_attribute" in str(exc.value))

    # Patching again should be a no-op once the sentinel attribute is set.
    compat._patch_langhelpers(module)


def test_patch_langhelpers_detects_existing_patch() -> None:
    module = _make_langhelpers_module()

    class AlreadyPatchedDescriptor:
        def __init__(self) -> None:
            setattr(self, compat._PATCH_ATTRIBUTE, True)
            self.calls = 0

        def __get__(self, instance: object, owner: type | None = None) -> "AlreadyPatchedDescriptor":
            return self

        def __call__(self, cls: type) -> None:
            self.calls += 1

    descriptor = AlreadyPatchedDescriptor()
    module.TypingOnly.__init_subclass__ = descriptor  # type: ignore[attr-defined]

    compat._patch_langhelpers(module)
    assertions.assertTrue(module.TypingOnly.__dict__["__init_subclass__"].calls == 0)


def test_patch_langhelpers_ignores_missing_typingonly() -> None:
    module = ModuleType("sqlalchemy.util.langhelpers")
    compat._patch_langhelpers(module)


def test_langhelpers_loader_executes_wrapped_loader_and_deactivates_finder(restore_meta_path: None) -> None:
    module = _make_langhelpers_module()

    class LoaderWithoutCreate:
        def exec_module(self, mod: ModuleType) -> None:  # pragma: no cover - interface requirement
            mod.executed = True  # type: ignore[attr-defined]

    finder = compat._Finder()
    sys.meta_path.insert(0, finder)

    loader = compat._LanghelpersLoader(LoaderWithoutCreate(), finder)
    spec = importlib.machinery.ModuleSpec("sqlalchemy.util.langhelpers", loader)
    assertions.assertTrue(loader.create_module(spec) is None)

    loader.exec_module(module)
    assertions.assertTrue(module.executed is True)
    assertions.assertTrue(finder not in sys.meta_path)


def test_langhelpers_loader_respects_wrapped_create_module(monkeypatch: pytest.MonkeyPatch) -> None:
    module = _make_langhelpers_module()

    class LoaderWithCreate(importlib.abc.Loader):
        def __init__(self) -> None:
            self.calls: list[str] = []

        def create_module(
            self, spec: importlib.machinery.ModuleSpec
        ) -> ModuleType:  # pragma: no cover - exercised in test
            self.calls.append("create")
            return module

        def exec_module(self, mod: ModuleType) -> None:  # pragma: no cover - exercised in test
            self.calls.append("exec")

    finder = compat._Finder()
    loader = compat._LanghelpersLoader(LoaderWithCreate(), finder)
    spec = importlib.machinery.ModuleSpec("sqlalchemy.util.langhelpers", loader)
    created = loader.create_module(spec)
    assertions.assertTrue(created is module)
    loader.exec_module(module)
    assertions.assertTrue(loader._wrapped_loader.calls == ["create", "exec"])


def test_finder_wraps_langhelpers_spec(monkeypatch: pytest.MonkeyPatch) -> None:
    finder = compat._Finder()

    assertions.assertTrue(finder.find_spec("something_else", None) is None)
    finder._active = False
    assertions.assertTrue(finder.find_spec("sqlalchemy.util.langhelpers", None) is None)
    finder._active = True

    dummy_loader = SimpleNamespace(exec_module=lambda module: None)
    spec = importlib.machinery.ModuleSpec("sqlalchemy.util.langhelpers", dummy_loader)
    monkeypatch.setattr(importlib.machinery.PathFinder, "find_spec", lambda fullname, path: spec)

    wrapped_spec = finder.find_spec("sqlalchemy.util.langhelpers", None)
    assertions.assertTrue(isinstance(wrapped_spec.loader, compat._LanghelpersLoader))


def test_finder_deactivate_handles_missing_meta_path_entry(restore_meta_path: None) -> None:
    finder = compat._Finder()
    sys.meta_path.insert(0, finder)
    sys.meta_path.remove(finder)
    finder.deactivate()
    assertions.assertTrue(not finder._active)
    finder.deactivate()


def test_finder_returns_spec_when_loader_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    finder = compat._Finder()
    spec = importlib.machinery.ModuleSpec("sqlalchemy.util.langhelpers", loader=None)
    monkeypatch.setattr(importlib.machinery.PathFinder, "find_spec", lambda fullname, path: spec)

    result = finder.find_spec("sqlalchemy.util.langhelpers", None)
    assertions.assertTrue(result is spec)


def test_ensure_typingonly_short_circuits_on_old_python(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sys, "version_info", (3, 12, 0))
    compat.ensure_typingonly_is_compatible()


def test_ensure_typingonly_patches_loaded_module(monkeypatch: pytest.MonkeyPatch) -> None:
    module = _make_langhelpers_module()
    sys.modules["sqlalchemy.util.langhelpers"] = module
    monkeypatch.setattr(sys, "version_info", (3, 13, 0))

    compat.ensure_typingonly_is_compatible()
    patched_descriptor = module.TypingOnly.__dict__["__init_subclass__"]  # type: ignore[attr-defined]
    assertions.assertTrue(getattr(patched_descriptor, compat._PATCH_ATTRIBUTE) is True)


def test_ensure_typingonly_inserts_meta_path_finder(monkeypatch: pytest.MonkeyPatch, restore_meta_path: None) -> None:
    sys.modules.pop("sqlalchemy.util.langhelpers", None)
    monkeypatch.setattr(sys, "version_info", (3, 13, 0))

    compat.ensure_typingonly_is_compatible()
    assertions.assertTrue(isinstance(compat._finder, compat._Finder))
    assertions.assertTrue(compat._finder in sys.meta_path)

    compat.ensure_typingonly_is_compatible()
    assertions.assertTrue(sys.meta_path.count(compat._finder) == 1)
