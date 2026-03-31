from __future__ import annotations

from typing import TYPE_CHECKING

from db.models import Agent

if TYPE_CHECKING:
    from skills.resolver import ResolvedSkill


def build_system_prompt(
    agent: Agent,
    instruction_skills: list[ResolvedSkill] | None = None,
) -> str:
    """
    Assemble the system prompt for an agent from DB fields and instruction skills.

    Order:
      1. persona     (always present — SOUL.md equivalent)
      2. rules       (if set — AGENTS.md equivalent)
      3. instruction skills (injected as named ## sections, one per skill)
    """
    sections = [agent.persona]

    if agent.rules:
        sections.append("\n\n## Operating Rules\n\n" + agent.rules)

    if instruction_skills:
        for skill in instruction_skills:
            sections.append(f"\n\n## {skill.name}\n\n{skill.implementation}")

    return "\n".join(sections)
