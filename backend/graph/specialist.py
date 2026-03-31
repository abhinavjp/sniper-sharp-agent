from typing import Any, Callable

from langchain_core.language_models import BaseChatModel
from langgraph.prebuilt import create_react_agent

from db.models import Agent
from graph.prompt import build_system_prompt
from graph.state import SupervisorState
from providers.factory import provider_factory
from skills.registry import build_tools_for_agent


def build_specialist_node(agent: Agent) -> Callable:
    """
    Return an async node function for a specialist agent.

    Unlike the previous approach (pre-compiled create_react_agent subgraph),
    this function resolves skills lazily at invocation time using user_id and
    metadata from the graph state. This is required because skill resolution
    depends on per-request context (user identity, hook injection).

    The LLM is instantiated once (at graph compile time) and reused across requests.
    """
    llm: BaseChatModel = provider_factory(agent.provider)

    async def specialist_node(state: SupervisorState) -> dict[str, Any]:
        from db.database import SessionLocal
        from graph.registry import graph_registry

        user_id: str | None = state.get("user_id")
        session_id: str | None = state.get("session_id")
        metadata: dict | None = state.get("metadata")

        db = SessionLocal()
        try:
            tools, instruction_skills = await build_tools_for_agent(
                agent=agent,
                user_id=user_id,
                session_id=session_id,
                metadata=metadata,
                system_skills=graph_registry.system_skills,
                db=db,
            )
        finally:
            db.close()

        system_prompt = build_system_prompt(agent, instruction_skills)
        react_agent = create_react_agent(
            model=llm,
            tools=tools,
            prompt=system_prompt,
        )
        result = await react_agent.ainvoke(state)
        return result

    return specialist_node
