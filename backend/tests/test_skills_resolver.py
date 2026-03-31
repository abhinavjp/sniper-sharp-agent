import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from skills.resolver import resolve_skills, ResolvedSkill
from skills.loader import SystemSkill
from skills.hook import HookSkill


def _make_agent(skill_hook_url=None, skill_hook_secret=None, skills=None):
    agent = MagicMock()
    agent.id = "agent-1"
    agent.skill_hook_url = skill_hook_url
    agent.skill_hook_secret = skill_hook_secret
    agent.skills = skills or []
    return agent


def _make_db_skill(name, skill_type="executable", user_id=None, disable_model_invocation=False):
    s = MagicMock()
    s.name = name
    s.description = f"{name} description"
    s.skill_type = skill_type
    s.implementation = f"return {{'{name}': True}}"
    s.version = "1.0.0"
    s.author = "user"
    s.user_id = user_id
    s.allowed_tools = []
    s.user_invocable = False
    s.disable_model_invocation = disable_model_invocation
    s.context_requirements = []
    return s


def _make_system_skill(name, skill_type="instruction", disable_model_invocation=False):
    return SystemSkill(
        name=name,
        description=f"{name} description",
        skill_type=skill_type,
        body=f"## {name}\nInstructions here.",
        disable_model_invocation=disable_model_invocation,
    )


@pytest.mark.asyncio
async def test_resolver_priority_order():
    """Hook skill wins over DB skill and system skill with the same name."""
    hook_skill = HookSkill(name="my-skill", description="from hook", implementation="return 1")
    db_skill = _make_db_skill("my-skill")
    system_skill = _make_system_skill("my-skill")

    agent = _make_agent(skill_hook_url="https://example.com/hook", skills=[db_skill])

    with patch("skills.resolver.fetch_hook_skills", new=AsyncMock(return_value=[hook_skill])):
        resolved = await resolve_skills(
            agent=agent,
            user_id="user-1",
            session_id="session-1",
            metadata={},
            system_skills=[system_skill],
            db=MagicMock(),
        )

    assert len(resolved) == 1
    assert resolved[0].source == "hook"
    assert resolved[0].description == "from hook"


@pytest.mark.asyncio
async def test_resolver_user_scoping():
    """Skill with user_id='user-A' is NOT returned when resolving for user-B."""
    db_skill_scoped = _make_db_skill("scoped-skill", user_id="user-A")
    db_skill_global = _make_db_skill("global-skill", user_id=None)

    agent = _make_agent(skills=[db_skill_scoped, db_skill_global])

    with patch("skills.resolver.fetch_hook_skills", new=AsyncMock(return_value=[])):
        resolved = await resolve_skills(
            agent=agent,
            user_id="user-B",
            session_id=None,
            metadata={},
            system_skills=[],
            db=MagicMock(),
        )

    names = [r.name for r in resolved]
    assert "global-skill" in names
    assert "scoped-skill" not in names


@pytest.mark.asyncio
async def test_resolver_disable_model_invocation():
    """Skill with disable_model_invocation=True is excluded from resolved list."""
    hidden_skill = _make_db_skill("hidden", disable_model_invocation=True)
    visible_skill = _make_db_skill("visible")

    agent = _make_agent(skills=[hidden_skill, visible_skill])

    with patch("skills.resolver.fetch_hook_skills", new=AsyncMock(return_value=[])):
        resolved = await resolve_skills(
            agent=agent,
            user_id="user-1",
            session_id=None,
            metadata={},
            system_skills=[],
            db=MagicMock(),
        )

    names = [r.name for r in resolved]
    assert "visible" in names
    assert "hidden" not in names


@pytest.mark.asyncio
async def test_resolver_instruction_and_executable_coexist():
    """Both skill_type values can appear in the resolved list."""
    db_skill = _make_db_skill("exec-skill", skill_type="executable")
    sys_skill = _make_system_skill("instr-skill", skill_type="instruction")

    agent = _make_agent(skills=[db_skill])

    with patch("skills.resolver.fetch_hook_skills", new=AsyncMock(return_value=[])):
        resolved = await resolve_skills(
            agent=agent,
            user_id="user-1",
            session_id=None,
            metadata={},
            system_skills=[sys_skill],
            db=MagicMock(),
        )

    types = {r.name: r.skill_type for r in resolved}
    assert types["exec-skill"] == "executable"
    assert types["instr-skill"] == "instruction"
