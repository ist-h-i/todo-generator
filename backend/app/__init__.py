from __future__ import annotations

import sys

from .sqlalchemy_py313_compat import ensure_typingonly_is_compatible

ensure_typingonly_is_compatible()

if sys.platform == "win32" and sys.version_info >= (3, 13):  # pragma: no cover - Windows-only import guard
    import platform

    def _disabled_wmi_query(table: str, *keys: str):  # type: ignore[override]
        raise OSError("not supported")

    if hasattr(platform, "_wmi_query"):
        platform._wmi_query = _disabled_wmi_query  # type: ignore[attr-defined]
