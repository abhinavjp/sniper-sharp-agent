import logging
from typing import Any

from langchain_core.tools import Tool
from sqlalchemy.orm import Session

from db.models import Agent
from skills.loader import SystemSkill
from skills.resolver import ResolvedSkill, resolve_skills

logger = logging.getLogger(__name__)

# Allowlist of safe builtins available inside executable skill implementations.
_SAFE_BUILTINS = {
    "len": len,
    "range": range,
    "enumerate": enumerate,
    "zip": zip,
    "map": map,
    "filter": filter,
    "sorted": sorted,
    "list": list,
    "dict": dict,
    "str": str,
    "int": int,
    "float": float,
    "bool": bool,
    "None": None,
    "True": True,
    "False": False,
    "isinstance": isinstance,
    "print": print,
    "ValueError": ValueError,
    "TypeError": TypeError,
    "KeyError": KeyError,
    "IndexError": IndexError,
    "RuntimeError": RuntimeError,
    "Exception": Exception,
}


def _make_executor(implementation: str):
    """
    Return a callable that executes the skill's Python implementation body.
    The implementation string is wrapped in a function so `return` works.
    Only _SAFE_BUILTINS is available (no __builtins__ access).
    """
    wrapped = "def _skill_fn(input):\n" + "\n".join(
        f"    {line}" for line in implementation.splitlines()
    )

    def safe_execute(input: dict[str, Any]) -> Any:
        ns: dict[str, Any] = {"__builtins__": _SAFE_BUILTINS}
        try:
            exec(wrapped, ns)  # noqa: S102
            return ns["_skill_fn"](input)
        except Exception as e:
            return {"status": "error", "message": str(e)}

    return safe_execute


async def build_tools_for_agent(
    agent: Agent,
    user_id: str | None = None,
    session_id: str | None = None,
    metadata: dict | None = None,
    system_skills: list[SystemSkill] | None = None,
    db: Session | None = None,
) -> tuple[list[Tool], list[ResolvedSkill]]:
    """
    Resolve all skills for this agent+user and split into:
    - list[Tool]: LangChain tools built from skill_type='executable' skills
    - list[ResolvedSkill]: skill_type='instruction' skills for system prompt injection

    Calls resolver.resolve_skills() which merges hook > user DB > system sources.
    """
    resolved = await resolve_skills(
        agent=agent,
        user_id=user_id,
        session_id=session_id,
        metadata=metadata,
        system_skills=system_skills or [],
        db=db,
    )

    tools: list[Tool] = []
    instruction_skills: list[ResolvedSkill] = []

    for skill in resolved:
        if skill.skill_type == "instruction":
            instruction_skills.append(skill)
        else:
            executor = _make_executor(skill.implementation)
            tools.append(
                Tool(
                    name=skill.name,
                    description=skill.description,
                    func=executor,
                )
            )

    return tools, instruction_skills
