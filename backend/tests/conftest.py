from __future__ import annotations

import socket
from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def offline_test_environment(monkeypatch, tmp_path):
    monkeypatch.setenv("LLM_PROVIDER", "mock")
    monkeypatch.setenv("MOCK_DELAY_MS", "0")
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("ELEVENLABS_API_KEY", "")
    monkeypatch.setenv("ELEVENLABS_VOICE_ID", "")
    monkeypatch.setenv("APIFY_TOKEN", "")
    monkeypatch.setenv("LLM_API_KEY", "")
    monkeypatch.setenv("EXAMINER_ENABLED", "false")
    monkeypatch.delenv("MOCK_SCENARIO", raising=False)
    original = socket.socket.connect

    def guarded_connect(sock, address):
        if isinstance(address, tuple) and address[0] not in {"127.0.0.1", "::1", "localhost"}:
            raise AssertionError("Test se pokusil připojit mimo localhost.")
        return original(sock, address)

    monkeypatch.setattr(socket.socket, "connect", guarded_connect)


@pytest.fixture
def client(tmp_path):
    from dataclasses import replace

    from fastapi.testclient import TestClient

    from orchestrator.config import Settings
    from orchestrator.main import create_app
    from tests.fakes import InProcessSandbox

    settings = replace(Settings(), llm_provider="mock", mock_delay_ms=0, data_dir=tmp_path / "data")
    with TestClient(create_app(settings=settings, sandbox=InProcessSandbox())) as client:
        yield client
