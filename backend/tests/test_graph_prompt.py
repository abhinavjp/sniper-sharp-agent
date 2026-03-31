from unittest.mock import MagicMock
from skills.resolver import ResolvedSkill
from graph.prompt import build_system_prompt


def _make_agent(persona="I am an agent.", rules=None):
    agent = MagicMock()
    agent.persona = persona
    agent.rules = rules
    return agent


def _make_instr_skill(name: str, body: str) -> ResolvedSkill:
    return ResolvedSkill(
        name=name,
        description="test",
        skill_type="instruction",
        implementation=body,
        version="1.0.0",
        author="system",
        source="system",
    )


def test_build_system_prompt_no_skills():
    agent = _make_agent(persona="I am an agent.", rules="Be helpful.")
    prompt = build_system_prompt(agent)
    assert "I am an agent." in prompt
    assert "Be helpful." in prompt


def test_build_system_prompt_appends_instruction_skills():
    agent = _make_agent(persona="I am an agent.")
    skills = [_make_instr_skill("read-file", "Read files carefully.")]
    prompt = build_system_prompt(agent, instruction_skills=skills)
    assert "## read-file" in prompt
    assert "Read files carefully." in prompt


def test_build_system_prompt_multiple_skills():
    agent = _make_agent(persona="Agent.")
    skills = [
        _make_instr_skill("skill-a", "Do A."),
        _make_instr_skill("skill-b", "Do B."),
    ]
    prompt = build_system_prompt(agent, instruction_skills=skills)
    assert "## skill-a" in prompt
    assert "Do A." in prompt
    assert "## skill-b" in prompt
    assert "Do B." in prompt
