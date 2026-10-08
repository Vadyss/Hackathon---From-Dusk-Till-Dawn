from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from orchestrator.config import Settings


def test_blank_names_only_env_uses_defaults(monkeypatch):
    for name in Settings.__dataclass_fields__:
        monkeypatch.setenv(name.upper(), "")
    assert Settings.from_env() == Settings()


def test_role_models_inherit_configured_default(monkeypatch):
    monkeypatch.setenv("LLM_MODEL", "some-model")
    monkeypatch.setenv("LLM_MODEL_FORGE", "forge-model")
    settings = Settings.from_env()
    assert settings.llm_model_planner == "some-model"
    assert settings.llm_model_forge == "forge-model"
    assert settings.llm_model_summary == "some-model"


@pytest.mark.parametrize("key,value", [("MOCK_SCENARIO", "AB"), ("LLM_PROVIDER", "bad"),
                                      ("EXAMINER_ENABLED", "perhaps"), ("RUN_TIMEOUT_S", "nan"),
                                      ("RUN_TIMEOUT_S", "inf"), ("RUN_TIMEOUT_S", "0"),
                                      ("LLM_MAX_RETRIES", "3"), ("LLM_MAX_CALLS_PER_RUN", "26"),
                                      ("LLM_MAX_TOKENS", "0"), ("MOCK_DELAY_MS", "-1")])
def test_invalid_settings_fail_closed(monkeypatch, key, value):
    monkeypatch.setenv(key, value)
    with pytest.raises(ValueError):
        Settings.from_env()


def test_settings_are_frozen_and_secrets_are_not_repr():
    settings = Settings(apify_token="apify-secret", llm_api_key="llm-secret", elevenlabs_api_key="voice-secret")
    assert "secret" not in repr(settings)
    with pytest.raises(FrozenInstanceError):
        settings.llm_provider = "mock"
