from __future__ import annotations

import logging
import os
from logging.handlers import TimedRotatingFileHandler
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.requests import Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response

from .config import settings
from .database import Base, get_engine
from .migrations import run_startup_migrations
from .routers import (
    activity,
    admin_settings,
    admin_users,
    analysis,
    analytics,
    appeals,
    auth,
    cards,
    channels,
    comments,
    competencies,
    competency_evaluations,
    error_categories,
    filters,
    initiatives,
    labels,
    preferences,
    profile,
    reports,
    status_reports,
    statuses,
    workspace_templates,
)

LOG_DIR = Path(__file__).resolve().parents[1] / "logs"
LOG_FILE = LOG_DIR / "backend.log"


def _configure_logging() -> None:
    logging.basicConfig(level=logging.INFO)

    if os.getenv("VERCEL"):
        # Vercel captures stdout/stderr automatically; avoid file logging on a read-only filesystem.
        return

    root_logger = logging.getLogger()

    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        log_path = LOG_FILE.resolve()

        for handler in root_logger.handlers:
            if isinstance(handler, TimedRotatingFileHandler):
                handler_path = Path(getattr(handler, "baseFilename", "")).resolve()
                if handler_path == log_path:
                    return

        formatter = logging.Formatter(
            "%(asctime)s %(levelname)s %(name)s %(message)s",
        )
        file_handler = TimedRotatingFileHandler(
            log_path,
            when="D",
            interval=1,
            backupCount=3,
            encoding="utf-8",
        )
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    except OSError:
        root_logger.warning("File logging disabled (cannot write to %s).", LOG_FILE, exc_info=True)


_configure_logging()
logger = logging.getLogger(__name__)


def _find_favicon() -> Optional[Path]:
    candidates = [
        Path(__file__).resolve().parent / "favicon.svg",
        Path(__file__).resolve().parent.parent / "favicon.svg",
        Path("/var/task/favicon.svg"),
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


FAVICON_PATH = _find_favicon()


def run_migrations() -> None:
    try:
        logger.info("Running startup migrations...")
        run_startup_migrations(get_engine())
        logger.info("Startup migrations completed.")
        logger.info("Ensuring database schema is up to date...")
        from . import models  # noqa: F401

        Base.metadata.create_all(bind=get_engine(), checkfirst=True)
        logger.info("Database schema ensured.")
    except Exception:
        logger.exception("Database initialization failed")
        raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.startup_error = None
    try:
        run_migrations()
    except Exception as exc:
        app.state.startup_error = str(exc)
    # Log route information for 405 investigation
    try:
        for r in app.routes:
            methods = getattr(r, "methods", None)
            if methods:
                logger.info("route: %-28s methods=%s", r.path, sorted(m for m in methods if m != "HEAD"))
    except Exception:
        logger.exception("Route logging failed")
    yield


app = FastAPI(
    title="Verbalize Yourself Backend",
    description="API for transforming unstructured input into actionable task boards.",
    version="0.1.0",
    lifespan=lifespan,
    swagger_ui_favicon_url="/favicon.svg",
)

_cors_allow_credentials = "*" not in settings.allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=_cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _apply_cors(response: Response, request: Request) -> Response:
    origin = request.headers.get("origin")
    if "*" in settings.allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response

    if origin and origin.rstrip("/") in settings.allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        if _cors_allow_credentials:
            response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    resp = JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=exc.headers)
    return _apply_cors(resp, request)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    if request.url.path.startswith("/auth/login"):
        sanitized_errors = [
            {
                "loc": err.get("loc"),
                "msg": err.get("msg"),
                "type": err.get("type"),
            }
            for err in exc.errors()
        ]
        logger.warning("Login validation failed: %s", sanitized_errors)
    resp = JSONResponse(status_code=422, content={"detail": exc.errors()})
    return _apply_cors(resp, request)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error", exc_info=exc)
    resp = JSONResponse(status_code=500, content={"detail": "Internal Server Error"})
    return _apply_cors(resp, request)


@app.middleware("http")
async def cors_preflight_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        resp = Response(status_code=204)
        resp.headers.update(
            {
                "Access-Control-Allow-Methods": request.headers.get("access-control-request-method", "*"),
                "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers", "*"),
                "Access-Control-Max-Age": "600",
            }
        )
        return _apply_cors(resp, request)

    response = await call_next(request)
    return response


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    # Let the CORS preflight middleware handle OPTIONS requests.
    if request.method == "OPTIONS":
        return await call_next(request)

    startup_error = getattr(request.app.state, "startup_error", None)
    if startup_error and request.url.path not in {"/health", "/docs", "/openapi.json", "/redoc", "/favicon.svg", "/favicon.ico"}:
        resp = JSONResponse(status_code=503, content={"detail": "Service unavailable"})
        resp = _apply_cors(resp, request)
        response = resp
    else:
        response = await call_next(request)

    # Minimal, broadly safe security headers for API responses.
    headers = {
        "Strict-Transport-Security": "max-age=15552000; includeSubDomains",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "X-Frame-Options": "DENY",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Resource-Policy": "same-origin",
    }
    for k, v in headers.items():
        # Preserve existing header values if already set upstream.
        response.headers.setdefault(k, v)
    return response


@app.get("/", include_in_schema=False)
def root() -> Response:
    return RedirectResponse(url="/health")


@app.get("/favicon.svg", include_in_schema=False)
async def favicon_svg():
    if FAVICON_PATH:
        return FileResponse(FAVICON_PATH, media_type="image/svg+xml")
    svg_markup = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">'
        '<rect width="100%" height="100%" rx="8" fill="#111"/>'
        '<text x="50%" y="55%" text-anchor="middle" fill="#fff" '
        'font-size="28" font-family="Inter, Arial" dy=".1em">VY</text>'
        "</svg>"
    )
    return Response(svg_markup, media_type="image/svg+xml")


@app.get("/favicon.ico", include_in_schema=False)
async def favicon_ico():
    return RedirectResponse(url="/favicon.svg")


# Routers
app.include_router(analysis.router)
app.include_router(analytics.router)
app.include_router(appeals.router)
app.include_router(auth.router)
app.include_router(channels.router)
app.include_router(cards.router)
app.include_router(status_reports.router)
app.include_router(labels.router)
app.include_router(statuses.router)
app.include_router(preferences.router)
app.include_router(profile.router)
app.include_router(comments.router)
app.include_router(activity.router)
app.include_router(admin_users.router)
app.include_router(admin_settings.router)
app.include_router(competencies.router)
app.include_router(competency_evaluations.router)
app.include_router(error_categories.router)
app.include_router(filters.router)
app.include_router(initiatives.router)
app.include_router(workspace_templates.router)
app.include_router(reports.router)


@app.get("/health", tags=["health"], response_model=None)
def health(request: Request):
    if getattr(request.app.state, "startup_error", None):
        resp = JSONResponse(status_code=503, content={"status": "degraded"})
        return _apply_cors(resp, request)
    return {"status": "ok"}
