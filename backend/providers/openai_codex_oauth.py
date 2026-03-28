import json
from pathlib import Path

from langchain_openai import ChatOpenAI


def _read_codex_token() -> str:
    """Read OAuth token from OpenAI Codex CLI credentials file."""
    creds_path = Path.home() / ".codex" / "auth.json"
    if not creds_path.exists():
        raise ValueError(
            f"Codex credentials not found at {creds_path}. "
            "Authenticate with the Codex CLI first."
        )
    data = json.loads(creds_path.read_text())
    for key in ("access_token", "token", "api_key"):
        if key in data:
            return data[key]
    raise ValueError(f"No token field in {creds_path}. Keys: {list(data.keys())}")


def create(model: str, credentials: dict) -> ChatOpenAI:
    token = _read_codex_token()
    return ChatOpenAI(model=model, api_key=token)
