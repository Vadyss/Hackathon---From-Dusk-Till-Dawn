# Copyright (c) 2026 Adam Krúpa and Ondra Csajka. All rights reserved.
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "contract_version": 1}