from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import activity, analysis, cards, comments, labels, preferences, statuses

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Todo Generator Backend",
    description="API for transforming unstructured input into actionable task boards.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router)
app.include_router(cards.router)
app.include_router(labels.router)
app.include_router(statuses.router)
app.include_router(preferences.router)
app.include_router(comments.router)
app.include_router(activity.router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
