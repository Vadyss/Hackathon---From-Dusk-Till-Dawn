from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from orchestrator.config import Settings


@pytest.fixture(autouse=True)
def isolated_settings_environment(monkeypatch):
    for name in Settings.__dataclass_fields__:
        monkeypatch.delenv(name.upper(), raising=False)


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


def test_relay_models_and_execution_limits_have_required_defaults():
    settings = Settings()
    assert settings.llm_base_url == "https://piquant-peacoat--llm-relay.apify.actor/v1"
    assert settings.llm_model == "anthropic/claude-sonnet-5.5"
    assert all(getattr(settings, f"llm_model_{role}") == "anthropic/claude-sonnet-5.5"
               for role in ("planner", "forge", "rule", "summary"))
    assert settings.llm_model_examiner == "deepseek/deepseek-v4.1-flash"
    assert settings.llm_model_fallback == "deepseek/deepseek-v4.1-flash"
    assert settings.llm_max_tokens == 8000 and settings.llm_max_tokens_cap == 16000
    assert settings.llm_timeout_s == 180 and settings.run_timeout_s == 1500
    assert settings.llm_max_retries == 2 and settings.llm_max_calls_per_run == 25
    assert Settings.from_env() == settings


def test_examiner_and_fallback_defaults_do_not_inherit_a_main_model_override(monkeypatch):
    monkeypatch.setenv("LLM_MODEL", "custom-main-model")
    settings = Settings.from_env()
    assert settings.llm_model_planner == "custom-main-model"
    assert settings.llm_model_examiner == Settings().llm_model_examiner
    assert settings.llm_model_fallback == Settings().llm_model_fallback


def test_every_role_and_fallback_can_be_configured_independently(monkeypatch):
    monkeypatch.setenv("LLM_MODEL", "main-model")
    for role in ("planner", "forge", "rule", "summary", "examiner", "fallback"):
        monkeypatch.setenv(f"LLM_MODEL_{role.upper()}", f"custom-{role}")
    settings = Settings.from_env()
    assert settings.llm_model == "main-model"
    for role in ("planner", "forge", "rule", "summary", "examiner", "fallback"):
        assert getattr(settings, f"llm_model_{role}") == f"custom-{role}"


def test_token_cap_and_timeouts_are_environment_configurable(monkeypatch):
    monkeypatch.setenv("LLM_MAX_TOKENS", "12000")
    monkeypatch.setenv("LLM_MAX_TOKENS_CAP", "24000")
    monkeypatch.setenv("LLM_TIMEOUT_S", "210")
    monkeypatch.setenv("RUN_TIMEOUT_S", "1800")
    settings = Settings.from_env()
    assert settings.llm_max_tokens == 12000 and settings.llm_max_tokens_cap == 24000
    assert settings.llm_timeout_s == 210 and settings.run_timeout_s == 1800


def test_initial_token_budget_equal_to_cap_is_valid(monkeypatch):
    monkeypatch.setenv("LLM_MAX_TOKENS", "8000")
    monkeypatch.setenv("LLM_MAX_TOKENS_CAP", "8000")
    assert Settings.from_env().llm_max_tokens_cap == 8000


def test_initial_token_budget_above_cap_is_rejected(monkeypatch):
    monkeypatch.setenv("LLM_MAX_TOKENS", "8001")
    monkeypatch.setenv("LLM_MAX_TOKENS_CAP", "8000")
    with pytest.raises(ValueError):
        Settings.from_env()


@pytest.mark.parametrize("key,value", [("MOCK_SCENARIO", "AB"), ("LLM_PROVIDER", "bad"),
                                      ("EXAMINER_ENABLED", "perhaps"), ("RUN_TIMEOUT_S", "nan"),
                                      ("RUN_TIMEOUT_S", "inf"), ("RUN_TIMEOUT_S", "0"),
                                      ("LLM_MAX_RETRIES", "3"), ("LLM_MAX_CALLS_PER_RUN", "26"),
                                      ("LLM_MAX_TOKENS", "0"), ("MOCK_DELAY_MS", "-1"),
                                      ("LLM_MAX_TOKENS_CAP", "0"), ("LLM_MAX_TOKENS_CAP", "-1"),
                                      ("LLM_MAX_TOKENS_CAP", "1.5"), ("LLM_MAX_TOKENS_CAP", "nan"),
                                      ("LLM_TIMEOUT_S", "nan"), ("LLM_TIMEOUT_S", "inf"),
                                      ("LLM_TIMEOUT_S", "0"), ("LLM_TIMEOUT_S", "-1"),
                                      ("LLM_MAX_RETRIES", "-1"), ("LLM_MAX_CALLS_PER_RUN", "0")])
def test_invalid_settings_fail_closed(monkeypatch, key, value):
    monkeypatch.setenv(key, value)
    with pytest.raises(ValueError):
        Settings.from_env()


def test_settings_are_frozen_and_secrets_are_not_repr():
    settings = Settings(apify_token="apify-secret", llm_api_key="llm-secret", elevenlabs_api_key="voice-secret")
    assert "secret" not in repr(settings)
    with pytest.raises(FrozenInstanceError):
        settings.llm_provider = "mock"
