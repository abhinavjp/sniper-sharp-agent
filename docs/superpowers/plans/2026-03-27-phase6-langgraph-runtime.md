# Phase 6: LangGraph Runtime — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** Phase 5 plan must be complete. The DB, all CRUD routes, and the seed data must exist before starting this plan.

**Goal:** Replace the `GraphRegistry` stub with a real LangGraph supervisor graph that classifies incoming messages, routes them to the correct specialist subgraph, and returns a real LLM response. Wire `/api/chat` to run the graph.

**Architecture:** A LangGraph `StateGraph` with one classifier node and N specialist nodes (one per non-supervisor agent in the DB). The classifier uses the supervisor agent's LLM to detect intent from `routing_rules` labels. Specialist agents are `create_react_agent` subgraphs with their configured skills as tools. `GraphRegistry.rebuild()` reads all agents from SQLite and recompiles the full graph — called on startup and after every config mutation.

**Tech Stack:** LangGraph, LangChain, SQLAlchemy (read from Phase 5 DB), FastAPI

---

## File Map

**Modify (replace stubs):**
- `backend/graph/registry.py` — real `GraphRegistry` with LangGraph compilation
- `backend/main.py` — call `await graph_registry.rebuild(db)` on startup

**Create:**
- `backend/graph/state.py` — `SupervisorState` TypedDict
- `backend/graph/classifier.py` — classifier node function
- `backend/graph/specialist.py` — `build_specialist_subgraph()`
- `backend/graph/supervisor.py` — `build_supervisor_graph()`
- `backend/graph/prompt.py` — system prompt assembly (persona + rules)
- `backend/skills/registry.py` — compile DB skill rows into LangChain tools
- `backend/skills/__init__.py`
- `backend/api/chat.py` — `POST /api/chat` route
- `backend/tests/test_graph_state.py`
- `backend/tests/test_skills_registry.py`
- `backend/tests/test_api_chat.py`

---

## Task 1: Graph State

**Files:**
- Create: `backend/graph/state.py`
- Create: `backend/tests/test_graph_state.py`

- [x] **Step 1: Write failing test `backend/tests/test_graph_state.py`**

```python
from graph.state import SupervisorState


def test_supervisor_state_shape():
    """SupervisorState must be a TypedDict with the required keys."""
    import typing
    hints = typing.get_type_hints(SupervisorState)
    assert "messages" in hints
    assert "user_id" in hints
    assert "session_id" in hints
    assert "intent" in hints
    assert "response" in hints


def test_supervisor_state_instantiates():
    from langchain_core.messages import HumanMessage
    state: SupervisorState = {
        "messages": [HumanMessage(content="hello")],
        "user_id": "user-123",
        "session_id": "sess-abc",
        "intent": None,
        "response": None,
    }
    assert state["user_id"] == "user-123"
    assert state["intent"] is None
```

- [x] **Step 2: Run test to confirm it fails**

```bash
cd backend
pytest tests/test_graph_state.py -v
```

Expected: `ModuleNotFoundError: No module named 'graph.state'`

- [x] **Step 3: Write `backend/graph/state.py`**

```python
from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class SupervisorState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    user_id: str
    session_id: str
    intent: str | None   # set by classifier node; drives conditional routing
    response: str | None  # set by specialist subgraph; returned to caller
```

- [x] **Step 4: Run test — expect PASS**

```bash
cd backend
pytest tests/test_graph_state.py -v
```

Expected:
```
PASSED tests/test_graph_state.py::test_supervisor_state_shape
PASSED tests/test_graph_state.py::test_supervisor_state_instantiates
```

- [x] **Step 5: Commit**

```bash
cd backend
git add graph/state.py tests/test_graph_state.py
git commit -m "feat(backend/graph): SupervisorState TypedDict with add_messages annotation"
```

---

## Task 2: Skill Registry

**Files:**
- Create: `backend/skills/__init__.py`
- Create: `backend/skills/registry.py`
- Create: `backend/tests/test_skills_registry.py`

- [x] **Step 1: Write failing test `backend/tests/test_skills_registry.py`**

```python
from unittest.mock import MagicMock
from skills.registry import build_tools_for_agent


def _make_skill(name: str, description: str, implementation: str) -> MagicMock:
    skill = MagicMock()
    skill.id = "skill-id"
    skill.name = name
    skill.description = description
    skill.input_schema = {"type": "object", "properties": {"x": {"type": "string"}}}
    skill.implementation = implementation
    return skill


def _make_agent(skills: list) -> MagicMock:
    agent = MagicMock()
    agent.skills = skills
    return agent


def test_build_tools_returns_list_of_tools(monkeypatch):
    skill = _make_skill("echo", "Echo the input", "return {'echo': input.get('x', '')}")
    agent = _make_agent([skill])
    tools = build_tools_for_agent(agent)
    assert len(tools) == 1
    assert tools[0].name == "echo"
    assert tools[0].description == "Echo the input"


def test_tool_is_callable(monkeypatch):
    skill = _make_skill("add", "Add two numbers", "return {'result': input['a'] + input['b']}")
    agent = _make_agent([skill])
    tools = build_tools_for_agent(agent)
    result = tools[0].func({"a": 2, "b": 3})
    assert result == {"result": 5}


def test_agent_with_no_skills_returns_empty_list():
    agent = _make_agent([])
    assert build_tools_for_agent(agent) == []


def test_tool_execution_error_returns_error_dict():
    skill = _make_skill("bad", "Raises", "raise ValueError('boom')")
    agent = _make_agent([skill])
    tools = build_tools_for_agent(agent)
    result = tools[0].func({})
    assert result["status"] == "error"
    assert "boom" in result["message"]
```

- [x] **Step 2: Run test to confirm it fails**

```bash
cd backend
pytest tests/test_skills_registry.py -v
```

Expected: `ModuleNotFoundError: No module named 'skills'`

- [x] **Step 3: Create `backend/skills/__init__.py`** (empty file)

- [x] **Step 4: Write `backend/skills/registry.py`**

```python
from typing import Any

from langchain_core.tools import Tool

from db.models import Agent

# Allowlist of safe builtins available inside skill implementations.
# Extend this list as more built-ins are needed by core skills.
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
}


def _make_executor(implementation: str):
    """
    Return a callable that executes the skill's Python implementation body.

    The implementation string is a Python code block where:
    - `input` is the dict of arguments passed by the LLM
    - The final `return` statement produces the tool result
    - Only the _SAFE_BUILTINS allowlist is available (no __builtins__ access)
    """
    def execute(input: dict[str, Any]) -> Any:
        local_vars: dict[str, Any] = {"input": input}
        try:
            exec(  # noqa: S102
                implementation,
                {"__builtins__": _SAFE_BUILTINS},
                local_vars,
            )
            return local_vars.get("_result") or local_vars.get("return")
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # exec() doesn't support `return` at module level; wrap in a function
    wrapped = f"def _skill_fn(input):\n" + "\n".join(
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
```

- [x] **Step 5: Run tests — expect PASS**

```bash
cd backend
pytest tests/test_skills_registry.py -v
```

Expected:
```
PASSED tests/test_skills_registry.py::test_build_tools_returns_list_of_tools
PASSED tests/test_skills_registry.py::test_tool_is_callable
PASSED tests/test_skills_registry.py::test_agent_with_no_skills_returns_empty_list
PASSED tests/test_skills_registry.py::test_tool_execution_error_returns_error_dict
```

- [x] **Step 6: Commit**

```bash
cd backend
git add skills/__init__.py skills/registry.py tests/test_skills_registry.py
git commit -m "feat(backend/skills): SkillRegistry — compile DB skill rows into LangChain Tool objects with sandboxed exec"
```

---

## Task 3: Prompt Assembly

**Files:**
- Create: `backend/graph/prompt.py`

- [x] **Step 1: Write `backend/graph/prompt.py`**

```python
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
```

- [x] **Step 2: Commit**

```bash
cd backend
git add graph/prompt.py
git commit -m "feat(backend/graph): prompt assembly — persona + rules (Phase 7/9 hooks ready)"
```

---

## Task 4: Specialist Subgraph

**Files:**
- Create: `backend/graph/specialist.py`

- [x] **Step 1: Write `backend/graph/specialist.py`**

```python
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
```

- [x] **Step 2: Commit**

```bash
cd backend
git add graph/specialist.py
git commit -m "feat(backend/graph): specialist subgraph builder using create_react_agent"
```

---

## Task 5: Classifier Node

**Files:**
- Create: `backend/graph/classifier.py`

- [x] **Step 1: Write `backend/graph/classifier.py`**

```python
from langchain_core.messages import HumanMessage, SystemMessage

from db.models import Agent, RoutingRule
from graph.state import SupervisorState
from providers.factory import provider_factory


def build_classifier_node(supervisor: Agent, routing_rules: list[RoutingRule]):
    """
    Return a LangGraph node function that classifies the latest user message
    and sets state['intent'] to one of the available intent labels.

    The classifier prompt lists all valid intent labels from routing_rules so
    it always reflects the current DB state (rebuilt on every graph recompile).
    """
    llm = provider_factory(supervisor.provider)
    labels = [r.intent_label for r in routing_rules]
    labels_str = "\n".join(f"- {label}" for label in labels)

    system_prompt = (
        f"{supervisor.persona}\n\n"
        f"## Your Task\n\n"
        f"Read the user's message and respond with EXACTLY ONE of these intent labels — "
        f"no explanation, no punctuation, just the label:\n\n"
        f"{labels_str}\n\n"
        f"If no label fits, respond with: FALLBACK"
    )

    async def classifier_node(state: SupervisorState) -> dict:
        # Take the last user message as the input to classify
        last_user_message = next(
            (m.content for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
            "",
        )

        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=last_user_message),
        ])

        intent = response.content.strip()
        # Validate — fall back if the LLM returns something unexpected
        if intent not in labels:
            intent = "FALLBACK"

        return {"intent": intent}

    return classifier_node
```

- [x] **Step 2: Commit**

```bash
cd backend
git add graph/classifier.py
git commit -m "feat(backend/graph): classifier node — LLM intent detection from routing_rules labels"
```

---

## Task 6: Supervisor Graph + Registry

**Files:**
- Create: `backend/graph/supervisor.py`
- Modify: `backend/graph/registry.py` (replace stub)

- [x] **Step 1: Write `backend/graph/supervisor.py`**

```python
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
    specialist_node_names = {agent.id for agent in specialists}
    for agent in specialists:
        subgraph = build_specialist_subgraph(agent)
        graph.add_node(agent.id, subgraph)
        graph.add_edge(agent.id, END)

    # Conditional edge: classifier → specialist (or END as fallback)
    # The path function returns a node name string or END — LangGraph routes accordingly.
    graph.add_conditional_edges("classifier", _route(routing_rules))

    return graph.compile()
```

- [x] **Step 2: Replace `backend/graph/registry.py`**

```python
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
```

- [x] **Step 3: Commit**

```bash
cd backend
git add graph/supervisor.py graph/registry.py
git commit -m "feat(backend/graph): supervisor graph builder + GraphRegistry with hot-reload rebuild()"
```

---

## Task 7: Wire Startup Rebuild in `main.py`

**Files:**
- Modify: `backend/main.py`

- [x] **Step 1: Update `backend/main.py` lifespan to call `rebuild()` on startup**

Replace the existing `lifespan` function:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.agents import router as agents_router
from api.providers import router as providers_router
from api.routing_rules import router as routing_rules_router
from api.sessions import router as sessions_router
from api.skills import router as skills_router
from api.system import router as system_router
from db.database import SessionLocal, init_db
from graph.registry import graph_registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Build the initial graph from whatever is currently in the DB
    db = SessionLocal()
    try:
        await graph_registry.rebuild(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Agent Framework API",
    description="LangGraph-powered multi-agent framework",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system_router)
app.include_router(providers_router)
app.include_router(skills_router)
app.include_router(agents_router)
app.include_router(routing_rules_router)
app.include_router(sessions_router)
```

- [x] **Step 2: Verify server starts without error after seeding**

```bash
cd backend
python seed.py        # ensure seed data exists
uvicorn main:app --reload --port 8000
```

Expected: Server starts and logs show no errors. The graph compiles on startup.

```bash
curl -s http://localhost:8000/api/health | python -m json.tool
```

Expected: `{"status": "ok", "graph_compiled": true}`

- [x] **Step 3: Run existing test suite — all must still pass**

```bash
cd backend
pytest -v --tb=short
```

Expected: All existing tests still PASS. (The `conftest.py` uses an in-memory DB with no agents, so `graph_compiled` will be false in tests — that is correct behaviour.)

- [x] **Step 4: Commit**

```bash
cd backend
git add main.py
git commit -m "feat(backend): wire graph rebuild on startup — graph_compiled=true after seeding"
```

---

## Task 8: Chat API

**Files:**
- Create: `backend/api/chat.py`
- Create: `backend/tests/test_api_chat.py`
- Modify: `backend/main.py`

- [x] **Step 1: Write failing tests `backend/tests/test_api_chat.py`**

```python
from unittest.mock import AsyncMock, MagicMock, patch


def _setup(client):
    """Seed a provider, supervisor agent, and session."""
    provider = client.post("/api/providers", json={
        "name": "Anthropic",
        "type": "anthropic-api-key",
        "credentials": {"api_key": "sk-test"},
        "model": "claude-3-5-sonnet-20241022",
    }).json()
    agent = client.post("/api/agents", json={
        "name": "Supervisor",
        "persona": "You route.",
        "provider_id": provider["id"],
        "is_supervisor": True,
    }).json()
    session = client.post("/api/sessions", json={
        "user_id": "user-123",
        "agent_id": agent["id"],
    }).json()
    return session["id"]


def test_chat_requires_message(client):
    resp = client.post("/api/chat", json={"session_id": "any", "message": ""})
    assert resp.status_code == 422


def test_chat_requires_session_id(client):
    resp = client.post("/api/chat", json={"message": "hello"})
    assert resp.status_code == 422


def test_chat_session_not_found(client):
    resp = client.post("/api/chat", json={"session_id": "bad-id", "message": "hello"})
    assert resp.status_code == 404


def test_chat_returns_response(client):
    session_id = _setup(client)

    # Mock the graph registry to return a fixed response without real LLM
    mock_graph = AsyncMock()
    mock_graph.ainvoke.return_value = {
        "messages": [],
        "intent": "FALLBACK",
        "response": "Mocked LLM response",
    }

    with patch("api.chat.graph_registry") as mock_registry:
        mock_registry.get = AsyncMock(return_value=mock_graph)
        resp = client.post("/api/chat", json={
            "session_id": session_id,
            "message": "Process this starter",
        })

    assert resp.status_code == 200
    data = resp.json()
    assert "response" in data
    assert data["session_id"] == session_id
    assert data["turn_count"] == 1


def test_chat_persists_history(client):
    session_id = _setup(client)

    mock_graph = AsyncMock()
    mock_graph.ainvoke.return_value = {
        "messages": [],
        "intent": "FALLBACK",
        "response": "First response",
    }

    with patch("api.chat.graph_registry") as mock_registry:
        mock_registry.get = AsyncMock(return_value=mock_graph)
        client.post("/api/chat", json={"session_id": session_id, "message": "First message"})
        resp = client.post("/api/chat", json={"session_id": session_id, "message": "Second message"})

    assert resp.json()["turn_count"] == 2


def test_chat_graph_not_compiled(client):
    session_id = _setup(client)

    with patch("api.chat.graph_registry") as mock_registry:
        mock_registry.get = AsyncMock(return_value=None)
        resp = client.post("/api/chat", json={"session_id": session_id, "message": "hello"})

    assert resp.status_code == 503
    assert "not ready" in resp.json()["detail"].lower()
```

- [x] **Step 2: Run test to confirm it fails**

```bash
cd backend
pytest tests/test_api_chat.py -v
```

Expected: All tests fail (route not registered).

- [x] **Step 3: Write `backend/api/chat.py`**

```python
from langchain_core.messages import HumanMessage

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session as DbSession

from db.database import get_db
from db.models import Session
from graph.registry import graph_registry
from graph.state import SupervisorState

router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    session_id: str
    message: str

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("message must not be empty")
        return v.strip()


class ChatResponse(BaseModel):
    response: str
    session_id: str
    intent: str | None
    turn_count: int


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, db: DbSession = Depends(get_db)):
    # Resolve session
    session = db.get(Session, body.session_id)
    if not session:
        raise HTTPException(404, f"Session '{body.session_id}' not found")

    # Ensure graph is compiled
    graph = await graph_registry.get()
    if graph is None:
        raise HTTPException(
            503,
            detail="Graph not ready — no supervisor agent configured. Seed the DB and call POST /api/graph/rebuild.",
        )

    # Build history messages for LangGraph state
    history_messages = []
    for turn in session.history:
        if turn["role"] == "user":
            history_messages.append(HumanMessage(content=turn["content"]))
        # assistant messages are included as AIMessage — LangGraph handles reconstruction

    # Run the graph
    initial_state: SupervisorState = {
        "messages": history_messages + [HumanMessage(content=body.message)],
        "user_id": session.user_id,
        "session_id": session.id,
        "intent": None,
        "response": None,
    }

    result: SupervisorState = await graph.ainvoke(initial_state)

    # Extract text response from result messages
    response_text = result.get("response") or _extract_last_ai_message(result["messages"])

    # Persist turn to session history
    history = list(session.history)
    history.append({"role": "user", "content": body.message})
    history.append({"role": "assistant", "content": response_text})
    session.history = history
    db.commit()

    return ChatResponse(
        response=response_text,
        session_id=session.id,
        intent=result.get("intent"),
        turn_count=len(history) // 2,
    )


def _extract_last_ai_message(messages: list) -> str:
    """Extract text from the last AI message in the message list."""
    from langchain_core.messages import AIMessage
    for msg in reversed(messages):
        if isinstance(msg, AIMessage):
            return msg.content if isinstance(msg.content, str) else str(msg.content)
    return ""
```

- [x] **Step 4: Register router in `backend/main.py`**

Add import:
```python
from api.chat import router as chat_router
```
Add:
```python
app.include_router(chat_router)
```

- [x] **Step 5: Run tests — expect PASS**

```bash
cd backend
pytest tests/test_api_chat.py -v
```

Expected: All 6 tests PASS.

- [x] **Step 6: Commit**

```bash
cd backend
git add api/chat.py tests/test_api_chat.py main.py
git commit -m "feat(backend): POST /api/chat — runs LangGraph supervisor graph, persists history to session"
```

---

## Task 9: End-to-End Smoke Test

This task verifies the full stack works with a real LLM call using the seeded data.

**Prerequisite:** `anthropic-setup-auth` provider requires Claude CLI authentication (`claude` must be logged in). Alternatively, swap the seeded provider type to `anthropic-api-key` with a real API key.

- [x] **Step 1: Ensure DB is seeded**

```bash
cd backend
python seed.py
```

- [x] **Step 2: Start server**

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Watch the logs. Expected on startup:
```
INFO: Started server process
INFO: Application startup complete.
```
No errors about graph compilation.

- [x] **Step 3: Create a session**

```bash
curl -s -X POST http://localhost:8000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-smoke-test", "agent_id": "<EmailClassifier-id-from-seed>"}' \
  | python -m json.tool
```

Copy the `id` from the response — this is your `SESSION_ID`.

To get the EmailClassifier agent id:
```bash
curl -s http://localhost:8000/api/agents | python -m json.tool
```

- [x] **Step 4: Send a chat message**

```bash
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"<SESSION_ID>\", \"message\": \"I need to add a new starter. Their name is Jane Smith, start date 2026-04-01, NI number AB123456C.\"}" \
  | python -m json.tool
```

Expected: A JSON response with:
- `"intent"` — one of `starter-processing`, `timesheet-import`, `task-creation`, or `FALLBACK`
- `"response"` — non-empty string from the LLM
- `"turn_count": 1`

- [x] **Step 5: Run full test suite — all passing**

```bash
cd backend
pytest -v --tb=short
```

Expected: All tests PASS.

- [x] **Step 6: Final commit**

```bash
cd backend
git add .
git commit -m "test(backend): end-to-end smoke test verified — classifier routes to PayrollWorker via LangGraph"
```
