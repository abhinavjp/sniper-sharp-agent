from db.models import Agent


def build_system_prompt(agent: Agent) -> str:
    """
    Assemble the system prompt for an agent from DB fields.

    Order:
      1. persona     (always present — SOUL.md equivalent)
      2. rules       (if set — AGENTS.md equivalent)

    Phase 9 extends this function to call the config hook between steps 1 and 2.
    Phase 7 extends this function to append retrieved memories after step 2.
    """
    sections = [agent.persona]

    if agent.rules:
        sections.append("\n\n## Operating Rules\n\n" + agent.rules)

    return "\n".join(sections)
