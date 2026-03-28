from typing import Any

from db.models import Provider
from providers import (
    anthropic_api_key,
    anthropic_setup_auth,
    openai_api_key,
    openai_codex_oauth,
    google_api_key,
    custom_url,
)

_CREATORS = {
    "anthropic-api-key":    anthropic_api_key.create,
    "anthropic-setup-auth": anthropic_setup_auth.create,
    "openai-api-key":       openai_api_key.create,
    "openai-codex-oauth":   openai_codex_oauth.create,
    "google-api-key":       google_api_key.create,
    "custom-url":           custom_url.create,
}


def provider_factory(provider: Provider) -> Any:
    """Return a LangChain LLM instance from a Provider DB row."""
    creator = _CREATORS.get(provider.type)
    if creator is None:
        raise ValueError(
            f"Unknown provider type: {provider.type!r}. "
            f"Valid types: {list(_CREATORS)}"
        )
    return creator(provider.model, provider.credentials)
