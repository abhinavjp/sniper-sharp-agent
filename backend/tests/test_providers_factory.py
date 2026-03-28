import pytest
from unittest.mock import patch, MagicMock
from providers.factory import provider_factory
from db.models import Provider


def _make_provider(type_: str, credentials: dict, model: str = "test-model") -> Provider:
    p = Provider()
    p.id = "test-id"
    p.name = "Test"
    p.type = type_
    p.credentials = credentials
    p.model = model
    p.is_default = False
    return p


def test_anthropic_api_key_returns_chat_anthropic():
    provider = _make_provider("anthropic-api-key", {"api_key": "sk-test"}, "claude-3-5-sonnet-20241022")
    with patch("providers.anthropic_api_key.ChatAnthropic") as mock_cls:
        mock_cls.return_value = MagicMock()
        llm = provider_factory(provider)
        mock_cls.assert_called_once_with(model="claude-3-5-sonnet-20241022", api_key="sk-test")


def test_openai_api_key_returns_chat_openai():
    provider = _make_provider("openai-api-key", {"api_key": "sk-openai"}, "gpt-4o")
    with patch("providers.openai_api_key.ChatOpenAI") as mock_cls:
        mock_cls.return_value = MagicMock()
        llm = provider_factory(provider)
        mock_cls.assert_called_once_with(model="gpt-4o", api_key="sk-openai")


def test_google_api_key_returns_chat_google():
    provider = _make_provider("google-api-key", {"api_key": "goog-key"}, "gemini-1.5-pro")
    with patch("providers.google_api_key.ChatGoogleGenerativeAI") as mock_cls:
        mock_cls.return_value = MagicMock()
        llm = provider_factory(provider)
        mock_cls.assert_called_once_with(model="gemini-1.5-pro", google_api_key="goog-key")


def test_custom_url_passes_base_url():
    provider = _make_provider(
        "custom-url",
        {"base_url": "http://localhost:11434/v1", "api_key": "local"},
        "llama3"
    )
    with patch("providers.custom_url.ChatOpenAI") as mock_cls:
        mock_cls.return_value = MagicMock()
        llm = provider_factory(provider)
        mock_cls.assert_called_once_with(
            model="llama3",
            base_url="http://localhost:11434/v1",
            api_key="local",
        )


def test_unknown_provider_type_raises():
    provider = _make_provider("nonexistent-type", {})
    with pytest.raises(ValueError, match="Unknown provider type"):
        provider_factory(provider)
