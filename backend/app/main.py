from __future__ import annotations
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.requests import Request
from fastapi.exceptions import RequestValidationError
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
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

app = FastAPI(
    title="Verbalize Yourself Backend",
    description="API for transforming unstructured input into actionable task boards.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Ensure CORS headers exist even on HTTP errors."""
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") in settings.allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Ensure validation errors also get CORS headers."""
    response = JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") in settings.allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response
    
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
