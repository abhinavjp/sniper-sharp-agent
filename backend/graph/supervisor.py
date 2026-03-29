from typing import Any

from langgraph.graph import END, StateGraph
from langgraph.graph.graph import CompiledGraph

from db.models import Agent, RoutingRule
from graph.classifier import build_classifier_node
from graph.specialist import build_specialist_subgraph
from graph.state import SupervisorState


def _route(routing_rules: list[RoutingRule]) -> Any:
    """
    Return a function that maps state['intent'] to a node name.
    Used as the LangGraph conditional edge function.
    """
    label_to_node = {r.intent_label: r.target_agent_id for r in routing_rules}

    def route(state: SupervisorState) -> str:
        intent = state.get("intent") or "FALLBACK"
        return label_to_node.get(intent, END)

    return route


def build_supervisor_graph(
    supervisor: Agent,
    specialists: list[Agent],
    routing_rules: list[RoutingRule],
) -> CompiledGraph:
    """
    Build and compile the full supervisor LangGraph StateGraph.

    Topology:
      [START] → [classifier] → conditional_edge → [specialist-N] → [END]

    Each specialist is a compiled create_react_agent subgraph added as a node.
    Routing is determined by routing_rules rows — agent.id is used as the node name.
    """
    graph = StateGraph(SupervisorState)

    # Classifier node
    classifier_fn = build_classifier_node(supervisor, routing_rules)
    graph.add_node("classifier", classifier_fn)
    graph.set_entry_point("classifier")

    # Specialist nodes (one per non-supervisor agent)
    for agent in specialists:
        subgraph = build_specialist_subgraph(agent)
        graph.add_node(agent.id, subgraph)
        graph.add_edge(agent.id, END)

    # Conditional edge: classifier → specialist (or END as fallback)
    graph.add_conditional_edges("classifier", _route(routing_rules))

    return graph.compile()
