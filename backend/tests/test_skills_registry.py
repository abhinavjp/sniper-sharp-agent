import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from langchain_core.tools import Tool
from skills.registry import build_tools_for_agent
from skills.resolver import ResolvedSkill


def _make_resolved(name: str, skill_type: str = "executable", implementation: str = "return {'ok': True}") -> ResolvedSkill:
    return ResolvedSkill(
        name=name,
        description=f"{name} description",
        skill_type=skill_type,
        implementation=implementation,
        version="1.0.0",
        author="user",
        source="user",
    )


def _make_agent():
    agent = MagicMock()
    agent.id = "agent-1"
    agent.skill_hook_url = None
    agent.skill_hook_secret = None
    agent.skills = []
    return agent


@pytest.mark.asyncio
async def test_build_tools_returns_tools_for_executable_skills():
    agent = _make_agent()
    resolved = [_make_resolved("echo", skill_type="executable", implementation="return {'echo': input.get('x', '')}")]

    with patch("skills.registry.resolve_skills", new=AsyncMock(return_value=resolved)):
        tools, instruction_skills = await build_tools_for_agent(agent=agent, user_id="u1", db=MagicMock())

    assert len(tools) == 1
    assert isinstance(tools[0], Tool)
    assert tools[0].name == "echo"
    assert instruction_skills == []


@pytest.mark.asyncio
async def test_build_tools_excludes_instruction_skills_from_tools():
    agent = _make_agent()
    resolved = [_make_resolved("my-guide", skill_type="instruction", implementation="## Guide\nDo this.")]

    with patch("skills.registry.resolve_skills", new=AsyncMock(return_value=resolved)):
        tools, instruction_skills = await build_tools_for_agent(agent=agent, user_id="u1", db=MagicMock())

    assert tools == []
    assert len(instruction_skills) == 1
    assert instruction_skills[0].name == "my-guide"


@pytest.mark.asyncio
async def test_build_tools_tool_is_callable():
    agent = _make_agent()
    resolved = [_make_resolved("add", implementation="return {'result': input['a'] + input['b']}")]

    with patch("skills.registry.resolve_skills", new=AsyncMock(return_value=resolved)):
        tools, _ = await build_tools_for_agent(agent=agent, user_id="u1", db=MagicMock())

    result = tools[0].func({"a": 2, "b": 3})
    assert result == {"result": 5}


@pytest.mark.asyncio
async def test_build_tools_empty_when_no_skills():
    agent = _make_agent()

    with patch("skills.registry.resolve_skills", new=AsyncMock(return_value=[])):
        tools, instruction_skills = await build_tools_for_agent(agent=agent, user_id="u1", db=MagicMock())

    assert tools == []
    assert instruction_skills == []


@pytest.mark.asyncio
async def test_build_tools_execution_error_returns_error_dict():
    agent = _make_agent()
    resolved = [_make_resolved("bad", implementation="raise ValueError('boom')")]

    with patch("skills.registry.resolve_skills", new=AsyncMock(return_value=resolved)):
        tools, _ = await build_tools_for_agent(agent=agent, user_id="u1", db=MagicMock())

    result = tools[0].func({})
    assert result["status"] == "error"
    assert "boom" in result["message"]


@pytest.mark.asyncio
async def test_build_tools_mixed_types_split_correctly():
    agent = _make_agent()
    resolved = [
        _make_resolved("exec-skill", skill_type="executable"),
        _make_resolved("instr-skill", skill_type="instruction"),
    ]

    with patch("skills.registry.resolve_skills", new=AsyncMock(return_value=resolved)):
        tools, instruction_skills = await build_tools_for_agent(agent=agent, user_id="u1", db=MagicMock())

    assert len(tools) == 1
    assert tools[0].name == "exec-skill"
    assert len(instruction_skills) == 1
    assert instruction_skills[0].name == "instr-skill"
