from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.requests import Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
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
    comments,
    competencies,
    competency_evaluations,
    status_reports,
    error_categories,
    filters,
    initiatives,
    labels,
    preferences,
    profile,
    reports,
    statuses,
    suggested_actions,
    workspace_templates,
)

FAVICON_PATH = Path(__file__).resolve().parent.parent / "favicon.svg"
SWAGGER_UI_FAVICON_URL = "/favicon.svg"

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def run_migrations() -> None:
    try:
        logger.info("Running startup migrations...")
        run_startup_migrations(engine)
        logger.info("Startup migrations completed.")
        logger.info("Ensuring database schema is up to date...")
        from . import models  # ensure models are imported
        Base.metadata.create_all(bind=engine, checkfirst=True)
        logger.info("Database schema ensured.")
    except Exception:
        logger.exception("Database initialization failed")
        raise


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Vercel: execute on cold start only
    run_migrations()
    yield


app = FastAPI(
    title="Verbalize Yourself Backend",
    description="API for transforming unstructured input into actionable task boards.",
    version="0.1.0",
    lifespan=lifespan,
    swagger_ui_favicon_url=SWAGGER_UI_FAVICON_URL,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _apply_cors(response: JSONResponse, request: Request) -> JSONResponse:
    origin = request.headers.get("origin")
    # Allow wildcard or exact match (trailing slash tolerant)
    if "*" in settings.allowed_origins:
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
        else:
            response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
    elif origin and origin.rstrip("/") in settings.allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    resp = JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    return _apply_cors(resp, request)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    resp = JSONResponse(status_code=422, content={"detail": exc.errors()})
    return _apply_cors(resp, request)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error", exc_info=exc)
    resp = JSONResponse(status_code=500, content={"detail": "Internal Server Error"})
    return _apply_cors(resp, request)


@app.get("/favicon.svg", include_in_schema=False)
async def favicon_svg() -> FileResponse:
    return FileResponse(FAVICON_PATH, media_type="image/svg+xml")


@app.get("/favicon.ico", include_in_schema=False)
async def favicon_ico() -> RedirectResponse:
    return RedirectResponse(url="/favicon.svg")


# include routers
app.include_router(analysis.router)
app.include_router(analytics.router)
app.include_router(appeals.router)
app.include_router(auth.router)
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
app.include_router(suggested_actions.router)
app.include_router(workspace_templates.router)
app.include_router(reports.router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
