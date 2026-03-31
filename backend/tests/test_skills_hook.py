import hashlib
import hmac
import pytest
import respx
import httpx
from skills.hook import fetch_hook_skills, HookSkill


HOOK_URL = "https://example.com/skills-hook"


def _valid_response() -> dict:
    return {
        "skills": [
            {
                "name": "injected-skill",
                "description": "From the hook.",
                "skill_type": "executable",
                "implementation": "return {'ok': True}",
                "version": "1.0.0",
                "allowed_tools": [],
                "user_invocable": False,
                "disable_model_invocation": False,
                "context_requirements": [],
            }
        ]
    }


@pytest.mark.asyncio
async def test_hook_returns_skills():
    with respx.mock:
        respx.post(HOOK_URL).mock(return_value=httpx.Response(200, json=_valid_response()))
        skills = await fetch_hook_skills(
            hook_url=HOOK_URL, hook_secret=None,
            user_id="user-1", agent_id="agent-1", session_id="session-1", metadata={},
        )
    assert len(skills) == 1
    assert isinstance(skills[0], HookSkill)
    assert skills[0].name == "injected-skill"
    assert skills[0].skill_type == "executable"


@pytest.mark.asyncio
async def test_hook_timeout_fallback():
    with respx.mock:
        respx.post(HOOK_URL).mock(side_effect=httpx.TimeoutException("timeout"))
        skills = await fetch_hook_skills(
            hook_url=HOOK_URL, hook_secret=None,
            user_id="user-1", agent_id="agent-1", session_id=None, metadata={},
        )
    assert skills == []


@pytest.mark.asyncio
async def test_hook_bad_response_fallback():
    with respx.mock:
        respx.post(HOOK_URL).mock(return_value=httpx.Response(500))
        skills = await fetch_hook_skills(
            hook_url=HOOK_URL, hook_secret=None,
            user_id="user-1", agent_id="agent-1", session_id=None, metadata={},
        )
    assert skills == []


@pytest.mark.asyncio
async def test_hook_hmac_signature():
    import json
    secret = "my-secret"
    captured: list[httpx.Request] = []

    async def capture(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json=_valid_response())

    with respx.mock:
        respx.post(HOOK_URL).mock(side_effect=capture)
        await fetch_hook_skills(
            hook_url=HOOK_URL, hook_secret=secret,
            user_id="user-1", agent_id="agent-1", session_id=None, metadata={},
        )

    assert len(captured) == 1
    req = captured[0]
    assert "X-Hook-Signature" in req.headers
    sig_header = req.headers["X-Hook-Signature"]
    assert sig_header.startswith("sha256=")
    body_bytes = req.content
    expected_sig = "sha256=" + hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
    assert sig_header == expected_sig
