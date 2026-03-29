from typing import Any


class GraphRegistry:
    """
    Stub for Phase 5. Phase 6 replaces this with a real LangGraph registry.
    All mutation API routes call rebuild() after DB changes.
    """

    _compiled: bool = False

    async def rebuild(self, db: Any = None) -> None:
        """No-op in Phase 5. Phase 6 compiles the LangGraph supervisor graph here."""
        self._compiled = True

    def is_compiled(self) -> bool:
        return self._compiled


# Module-level singleton shared across the application
graph_registry = GraphRegistry()
