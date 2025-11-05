import importlib
import importlib.util
import itertools
import os
import sys
import warnings
from pathlib import Path
from typing import TYPE_CHECKING, Callable, Generator

import pytest
from _pytest.config.argparsing import Parser
from _pytest.warning_types import PytestWarning
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from app.config import DEFAULT_SECRET_ENCRYPTION_KEY
from app.database import Base, get_db
from app.main import app

_PYTEST_COV_AVAILABLE = importlib.util.find_spec("pytest_cov") is not None

if TYPE_CHECKING:  # pragma: no cover - import used for type checking only
    from coverage import Coverage

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}, future=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


if not _PYTEST_COV_AVAILABLE:

    def pytest_addoption(parser: Parser) -> None:
        """Accept a subset of pytest-cov CLI flags when the plugin is unavailable."""

        group = parser.getgroup("cov", "coverage reporting")
        group.addoption(
            "--cov",
            action="append",
            default=[],
            metavar="PATH",
            help="Measure coverage for PATH (mirrors pytest-cov when installed).",
        )
        group.addoption(
            "--cov-report",
            action="append",
            default=[],
            metavar="TYPE",
            help="Generate a coverage report of TYPE (e.g. xml, term).",
        )

    @pytest.hookimpl(trylast=True)
    def pytest_configure(config: pytest.Config) -> None:
        cov_targets = [str(Path(target).resolve()) for target in config.getoption("--cov") if target]
        reports = [spec for spec in config.getoption("--cov-report") if spec]

        if not cov_targets and not reports:
            return

        coverage_spec = importlib.util.find_spec("coverage")
        if coverage_spec is None:
            warnings.warn(
                "Coverage module is not installed; --cov options will be ignored.",
                PytestWarning,
                stacklevel=2,
            )
            config._codex_cov = {  # type: ignore[attr-defined]
                "cov": None,
                "reports": reports,
            }
            return

        coverage_mod = importlib.import_module("coverage")
        cov = coverage_mod.Coverage(source=cov_targets or None)
        cov.start()
        config._codex_cov = {  # type: ignore[attr-defined]
            "cov": cov,
            "reports": reports,
        }

    def _emit_reports(cov: "Coverage | None", reports: list[str]) -> None:
        for spec in reports:
            kind, _, destination = spec.partition(":")
            kind = kind.strip()
            destination = destination.strip()

            if cov is None:
                if kind == "xml":
                    path = Path(destination or "coverage.xml")
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text(
                        """<?xml version='1.0' encoding='UTF-8'?>
<coverage version='0' timestamp='0'>
  <sources />
  <packages />
</coverage>
""",
                        encoding="utf-8",
                    )
                elif kind in {"term", "term-missing"}:
                    warnings.warn(
                        "Coverage data unavailable; skipping terminal coverage report.",
                        PytestWarning,
                        stacklevel=2,
                    )
                elif kind:
                    warnings.warn(
                        f"Unsupported coverage report type '{spec}' requested via --cov-report",
                        PytestWarning,
                        stacklevel=2,
                    )
                continue

            if kind == "xml":
                cov.xml_report(outfile=destination or None)
            elif kind == "term":
                cov.report()
            elif kind == "term-missing":
                cov.report(show_missing=True)
            elif kind:
                warnings.warn(
                    f"Unsupported coverage report type '{spec}' requested via --cov-report",
                    PytestWarning,
                    stacklevel=2,
                )

    @pytest.hookimpl(trylast=True)
    def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:  # pragma: no cover
        controller = getattr(session.config, "_codex_cov", None)
        if not controller:
            return

        cov = controller["cov"]
        reports = controller["reports"]
        if cov is None:
            _emit_reports(None, reports)
            return
        cov.stop()
        cov.save()
        _emit_reports(cov, reports)


@pytest.fixture()
def email_factory() -> Callable[[], str]:
    counter = itertools.count()

    def _factory() -> str:
        return f"user-{next(counter)}@example.com"

    return _factory


@pytest.fixture()
def email(email_factory: Callable[[], str]) -> str:
    return email_factory()


@pytest.fixture()
def secret_encryption_key(monkeypatch: pytest.MonkeyPatch) -> str:
    key = DEFAULT_SECRET_ENCRYPTION_KEY
    monkeypatch.setattr("app.config.settings.secret_encryption_key", key)
    return key


@pytest.fixture()
def client(secret_encryption_key: str, monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    monkeypatch.setattr("app.config.settings.debug", True)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    Base.metadata.drop_all(bind=engine)
