from unittest.mock import MagicMock
from skills.registry import build_tools_for_agent


def _make_skill(name: str, description: str, implementation: str) -> MagicMock:
    skill = MagicMock()
    skill.id = "skill-id"
    skill.name = name
    skill.description = description
    skill.input_schema = {"type": "object", "properties": {"x": {"type": "string"}}}
    skill.implementation = implementation
    return skill


def _make_agent(skills: list) -> MagicMock:
    agent = MagicMock()
    agent.skills = skills
    return agent


def test_build_tools_returns_list_of_tools(monkeypatch):
    skill = _make_skill("echo", "Echo the input", "return {'echo': input.get('x', '')}")
    agent = _make_agent([skill])
    tools = build_tools_for_agent(agent)
    assert len(tools) == 1
    assert tools[0].name == "echo"
    assert tools[0].description == "Echo the input"


def test_tool_is_callable(monkeypatch):
    skill = _make_skill("add", "Add two numbers", "return {'result': input['a'] + input['b']}")
    agent = _make_agent([skill])
    tools = build_tools_for_agent(agent)
    result = tools[0].func({"a": 2, "b": 3})
    assert result == {"result": 5}


def test_agent_with_no_skills_returns_empty_list():
    agent = _make_agent([])
    assert build_tools_for_agent(agent) == []


def test_tool_execution_error_returns_error_dict():
    skill = _make_skill("bad", "Raises", "raise ValueError('boom')")
    agent = _make_agent([skill])
    tools = build_tools_for_agent(agent)
    result = tools[0].func({})
    assert result["status"] == "error"
    assert "boom" in result["message"]
