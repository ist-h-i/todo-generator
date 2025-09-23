from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import settings


@pytest.mark.skipif(
    bool(settings.chatgpt_api_key),
    reason="requires analysis endpoint to be disabled",
)
def test_analysis_requires_api_key(client: TestClient) -> None:
    response = client.post(
        "/analysis",
        json={"text": "Implement login flow", "max_cards": 1},
    )

    assert response.status_code == 503
    payload = response.json()
    assert "OPENAI_API_KEY" in payload["detail"]
