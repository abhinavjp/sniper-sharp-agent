import hashlib
import hmac
import json
import logging
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger(__name__)

_HOOK_TIMEOUT_SECONDS = 5.0


@dataclass
class HookSkill:
    name: str
    description: str
    skill_type: str = "executable"
    implementation: str = ""
    version: str = "1.0.0"
    allowed_tools: list[str] = field(default_factory=list)
    user_invocable: bool = False
    disable_model_invocation: bool = False
    context_requirements: list[str] = field(default_factory=list)


def _sign_body(body_bytes: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


async def fetch_hook_skills(
    hook_url: str,
    hook_secret: str | None,
    user_id: str,
    agent_id: str,
    session_id: str | None,
    metadata: dict,
) -> list[HookSkill]:
    """
    POST to hook_url with request context. Returns injected skills or [] on any failure.
    Failure is always non-blocking — errors are logged as warnings only.
    """
    payload = {
        "user_id": user_id,
        "agent_id": agent_id,
        "session_id": session_id,
        "metadata": metadata or {},
    }
    body_bytes = json.dumps(payload, separators=(",", ":")).encode()
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if hook_secret:
        headers["X-Hook-Signature"] = _sign_body(body_bytes, hook_secret)

    try:
        async with httpx.AsyncClient(timeout=_HOOK_TIMEOUT_SECONDS) as client:
            response = await client.post(hook_url, content=body_bytes, headers=headers)
    except httpx.TimeoutException:
        logger.warning("skills.hook: timeout calling %s", hook_url)
        return []
    except Exception as exc:
        logger.warning("skills.hook: request error for %s — %s", hook_url, exc)
        return []

    if response.status_code != 200:
        logger.warning("skills.hook: non-200 response %d from %s", response.status_code, hook_url)
        return []

    try:
        data = response.json()
        raw_skills = data.get("skills", [])
    except Exception as exc:
        logger.warning("skills.hook: malformed JSON from %s — %s", hook_url, exc)
        return []

    results: list[HookSkill] = []
    for raw in raw_skills:
        if not isinstance(raw, dict):
            continue
        name = raw.get("name")
        description = raw.get("description")
        if not name or not description:
            continue
        results.append(HookSkill(
            name=str(name),
            description=str(description),
            skill_type=str(raw.get("skill_type", "executable")),
            implementation=str(raw.get("implementation", "")),
            version=str(raw.get("version", "1.0.0")),
            allowed_tools=list(raw.get("allowed_tools") or []),
            user_invocable=bool(raw.get("user_invocable", False)),
            disable_model_invocation=bool(raw.get("disable_model_invocation", False)),
            context_requirements=list(raw.get("context_requirements") or []),
        ))
    return results
