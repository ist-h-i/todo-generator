from __future__ import annotations

from fastapi import FastAPI
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
    auth,
    cards,
    comments,
    competencies,
    competency_evaluations,
    daily_reports,
    error_categories,
    filters,
    initiatives,
    labels,
    preferences,
    profile,
    reports,
    statuses,
    suggested_actions,
)

run_startup_migrations(engine)
Base.metadata.create_all(bind=engine)

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

app.include_router(analysis.router)
app.include_router(analytics.router)
app.include_router(auth.router)
app.include_router(cards.router)
app.include_router(daily_reports.router)
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
app.include_router(reports.router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
