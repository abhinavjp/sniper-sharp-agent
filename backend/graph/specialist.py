from langchain_core.language_models import BaseChatModel
from langgraph.graph.graph import CompiledGraph
from langgraph.prebuilt import create_react_agent

from db.models import Agent
from graph.prompt import build_system_prompt
from providers.factory import provider_factory
from skills.registry import build_tools_for_agent


def build_specialist_subgraph(agent: Agent) -> CompiledGraph:
    """
    Compile a ReAct agent subgraph for a specialist (non-supervisor) agent.

    The subgraph:
    - Uses the agent's configured LLM provider
    - Has the agent's attached skills as LangChain tools
    - Uses persona + rules as the system prompt
    - Runs a full ReAct loop (think → tool call → observe → ...) until end_turn
    """
    llm: BaseChatModel = provider_factory(agent.provider)
    tools = build_tools_for_agent(agent)
    system_prompt = build_system_prompt(agent)

    return create_react_agent(
        model=llm,
        tools=tools,
        state_modifier=system_prompt,
    )
