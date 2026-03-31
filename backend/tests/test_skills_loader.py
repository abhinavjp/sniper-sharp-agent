import textwrap
from pathlib import Path
import pytest
from skills.loader import load_system_skills, SystemSkill


@pytest.fixture
def skills_dir(tmp_path: Path) -> Path:
    return tmp_path


def _write_skill(skills_dir: Path, name: str, content: str) -> Path:
    skill_dir = skills_dir / name
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text(content)
    return skill_dir


def test_loader_parses_skill_md(skills_dir):
    _write_skill(skills_dir, "my-skill", textwrap.dedent("""\
        ---
        name: my-skill
        version: "2.0.0"
        description: "Does something useful."
        author: system
        type: instruction
        allowed-tools:
          - read_file
          - bash
        user-invocable: true
        disable-model-invocation: false
        context-requirements:
          - user_id
        ---

        ## Instructions
        Do the thing.
    """))
    skills = load_system_skills(skills_dir)
    assert len(skills) == 1
    s = skills[0]
    assert s.name == "my-skill"
    assert s.version == "2.0.0"
    assert s.description == "Does something useful."
    assert s.author == "system"
    assert s.skill_type == "instruction"
    assert s.allowed_tools == ["read_file", "bash"]
    assert s.user_invocable is True
    assert s.disable_model_invocation is False
    assert s.context_requirements == ["user_id"]
    assert "Do the thing." in s.body


def test_loader_handles_missing_optional_fields(skills_dir):
    _write_skill(skills_dir, "minimal-skill", textwrap.dedent("""\
        ---
        name: minimal-skill
        description: "Minimal."
        ---

        Body text.
    """))
    skills = load_system_skills(skills_dir)
    assert len(skills) == 1
    s = skills[0]
    assert s.version == "1.0.0"
    assert s.author == "system"
    assert s.skill_type == "instruction"
    assert s.allowed_tools == []
    assert s.user_invocable is False
    assert s.disable_model_invocation is False
    assert s.context_requirements == []


def test_loader_skips_invalid_files(skills_dir, caplog):
    # Not a directory with SKILL.md — just a stray file
    (skills_dir / "stray.txt").write_text("hello")
    # A directory with a malformed SKILL.md (no frontmatter delimiter)
    bad_dir = skills_dir / "bad-skill"
    bad_dir.mkdir()
    (bad_dir / "SKILL.md").write_text("no frontmatter here at all")
    # A valid skill alongside the bad ones
    _write_skill(skills_dir, "good-skill", textwrap.dedent("""\
        ---
        name: good-skill
        description: "Fine."
        ---
        OK.
    """))
    skills = load_system_skills(skills_dir)
    assert len(skills) == 1
    assert skills[0].name == "good-skill"
