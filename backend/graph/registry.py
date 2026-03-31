import asyncio
import logging
from pathlib import Path
from typing import Any

from db.models import Agent, RoutingRule
from skills.loader import SystemSkill, load_system_skills

logger = logging.getLogger(__name__)

# Canonical location of system skill packages relative to project root
_SKILLS_DIR = Path(__file__).resolve().parent.parent.parent / ".agents" / "skills"


class GraphRegistry:
    """
    Holds the compiled LangGraph supervisor graph and cached system skills.

    rebuild() is called:
    - Once at app startup (in main.py lifespan)
    - After every CRUD mutation to agents, skills, providers, or routing rules

    The graph is replaced atomically — in-flight requests use the previous graph,
    the next request gets the new one.
    """

    def __init__(self) -> None:
        self._graph: Any | None = None
        self._lock = asyncio.Lock()
        self.system_skills: list[SystemSkill] = []

    async def rebuild(self, db: Any = None) -> None:
        """Recompile the supervisor graph from current DB state."""
        if db is None:
            return  # called without DB context (e.g. during testing stubs)

        # Reload system skills from filesystem on every rebuild
        self.system_skills = load_system_skills(_SKILLS_DIR)
        logger.info("graph_registry: loaded %d system skills", len(self.system_skills))

        from graph.supervisor import build_supervisor_graph

        supervisor = db.query(Agent).filter_by(is_supervisor=True).first()
        if not supervisor:
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

    async def get(self) -> Any | None:
        """Return the compiled graph, or None if not yet built."""
        return self._graph

    def is_compiled(self) -> bool:
        return self._graph is not None


# Module-level singleton shared across the application
graph_registry = GraphRegistry()
