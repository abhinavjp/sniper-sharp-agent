import asyncio
from typing import Any

from langgraph.graph.graph import CompiledGraph

from db.models import Agent, RoutingRule


class GraphRegistry:
    """
    Holds the compiled LangGraph supervisor graph.

    rebuild() is called:
    - Once at app startup (in main.py lifespan)
    - After every CRUD mutation to agents, skills, providers, or routing rules

    The graph is replaced atomically — in-flight requests use the previous graph,
    the next request gets the new one.
    """

    def __init__(self) -> None:
        self._graph: CompiledGraph | None = None
        self._lock = asyncio.Lock()

    async def rebuild(self, db: Any = None) -> None:
        """Recompile the supervisor graph from current DB state."""
        if db is None:
            return  # called without DB context (e.g. during testing stubs)

        from graph.supervisor import build_supervisor_graph

        supervisor = db.query(Agent).filter_by(is_supervisor=True).first()
        if not supervisor:
            # No supervisor configured yet — graph stays uncompiled
            self._graph = None
            return

        specialists = db.query(Agent).filter_by(is_supervisor=False).all()
        routing_rules = (
            db.query(RoutingRule)
            .filter_by(supervisor_id=supervisor.id)
            .order_by(RoutingRule.priority)
            .all()
        )

        async with self._lock:
            self._graph = build_supervisor_graph(supervisor, specialists, routing_rules)

    async def get(self) -> CompiledGraph | None:
        """Return the compiled graph, or None if not yet built."""
        return self._graph

    def is_compiled(self) -> bool:
        return self._graph is not None


# Module-level singleton shared across the application
graph_registry = GraphRegistry()
