from typing import Any

from langchain_core.tools import Tool

from db.models import Agent

# Allowlist of safe builtins available inside skill implementations.
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


def build_tools_for_agent(agent: Agent) -> list[Tool]:
    """Build a list of LangChain Tool objects from an agent's attached skills."""
    tools = []
    for skill in agent.skills:
        executor = _make_executor(skill.implementation)
        tools.append(
            Tool(
                name=skill.name,
                description=skill.description,
                func=executor,
            )
        )
    return tools
