"""Workarounds for running SQLAlchemy 2.0.x on Python 3.13."""

from __future__ import annotations

import importlib.abc
import importlib.machinery
import sys
from types import ModuleType
from typing import FrozenSet

_ALLOWED_TYPINGONLY_NAMES: FrozenSet[str] = frozenset(
    {"__firstlineno__", "__static_attributes__"}
)
_PATCH_ATTRIBUTE = "_todo_generator_py313_patch"


def _patch_langhelpers(module: ModuleType) -> None:
    try:
        typing_only_cls = module.TypingOnly  # type: ignore[attr-defined]
    except AttributeError:  # pragma: no cover - defensive guard
        return

    original_init_subclass = typing_only_cls.__init_subclass__
    if getattr(original_init_subclass, _PATCH_ATTRIBUTE, False):
        return

    original_init_subclass_func = original_init_subclass.__func__
    dunders_match = module._dunders.match  # type: ignore[attr-defined]

    @classmethod
    def _patched_init_subclass(cls) -> None:  # type: ignore[override]
        if typing_only_cls in cls.__bases__:
            remaining = {
                name
                for name in cls.__dict__
                if name not in _ALLOWED_TYPINGONLY_NAMES and not dunders_match(name)
            }
            if remaining:
                raise AssertionError(
                    f"Class {cls} directly inherits TypingOnly but has "
                    f"additional attributes {remaining}."
                )

        original_init_subclass_func(cls)

    _patched_init_subclass._todo_generator_py313_patch = True  # type: ignore[attr-defined]
    typing_only_cls.__init_subclass__ = _patched_init_subclass


class _LanghelpersLoader(importlib.abc.Loader):
    def __init__(self, wrapped_loader: importlib.abc.Loader, finder: "_Finder") -> None:
        self._wrapped_loader = wrapped_loader
        self._finder = finder

    def create_module(self, spec: importlib.machinery.ModuleSpec) -> ModuleType | None:
        create_module = getattr(self._wrapped_loader, "create_module", None)
        if create_module is None:
            return None
        return create_module(spec)

    def exec_module(self, module: ModuleType) -> None:
        self._wrapped_loader.exec_module(module)
        _patch_langhelpers(module)
        self._finder.deactivate()


class _Finder(importlib.abc.MetaPathFinder):
    def __init__(self) -> None:
        self._active = True

    def find_spec(
        self, fullname: str, path: object | None, target: ModuleType | None = None
    ) -> importlib.machinery.ModuleSpec | None:
        if not self._active or fullname != "sqlalchemy.util.langhelpers":
            return None

        spec = importlib.machinery.PathFinder.find_spec(fullname, path)
        if spec is None or spec.loader is None:
            return spec

        spec.loader = _LanghelpersLoader(spec.loader, self)
        return spec

    def deactivate(self) -> None:
        if not self._active:
            return
        self._active = False
        try:
            sys.meta_path.remove(self)
        except ValueError:  # pragma: no cover - already removed
            pass


_finder: _Finder | None = None


def ensure_typingonly_is_compatible() -> None:
    """Ensure SQLAlchemy's TypingOnly cooperates with Python 3.13."""

    if sys.version_info < (3, 13):  # pragma: no cover - behaviour is version specific
        return

    module = sys.modules.get("sqlalchemy.util.langhelpers")
    if module is not None:
        _patch_langhelpers(module)
        return

    global _finder
    if _finder is not None:
        return

    finder = _Finder()
    sys.meta_path.insert(0, finder)
    _finder = finder
