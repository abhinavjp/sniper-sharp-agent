import json
from pathlib import Path

from langchain_anthropic import ChatAnthropic


def _read_claude_cli_token() -> str:
    """Read OAuth token from Claude CLI credentials file."""
    creds_path = Path.home() / ".claude" / ".credentials.json"
    if not creds_path.exists():
        raise ValueError(
            f"Claude CLI credentials not found at {creds_path}. "
            "Run `claude` to authenticate first."
        )
    data = json.loads(creds_path.read_text())
    for key in ("claudeAiOauthToken", "access_token", "token"):
        if key in data:
            return data[key]
    raise ValueError(
        f"No token field found in {creds_path}. Available keys: {list(data.keys())}"
    )


def create(model: str, credentials: dict) -> ChatAnthropic:
    token = _read_claude_cli_token()
    return ChatAnthropic(model=model, api_key=token)
