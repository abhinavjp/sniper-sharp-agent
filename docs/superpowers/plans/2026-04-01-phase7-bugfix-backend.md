# Phase 7 Bug-Fix — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five defects found in the Phase 7 skill registry implementation — two blocking (chat history loss, missing `response` field), one type mismatch, one missing `AgentOut` field, and one missing test.

**Architecture:** TDD throughout — every fix starts with a failing test. All changes are surgical: no file restructuring, no new dependencies. Run `pytest` after every task. Target: 80+ passing tests on completion.

**Tech Stack:** Python 3.10+, FastAPI, SQLAlchemy 2.0, LangGraph, LangChain, pytest, unittest.mock.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `backend/api/chat.py` | Modify | Import `AIMessage`; add `elif` branch to history loop |
| `backend/graph/specialist.py` | Modify | Extract last AIMessage text; set `response` key before returning |
| `backend/graph/state.py` | Modify | `user_id: str | None` |
| `backend/api/agents.py` | Modify | Add `config_hook_secret: str | None` to `AgentOut` |
| `backend/tests/test_api_chat.py` | Modify | Add `test_chat_preserves_assistant_history` |
| `backend/tests/test_api_agents.py` | Modify | Add `test_agent_config_hook_fields_in_response` |
| `backend/tests/test_skills_registry.py` | Modify | Add `test_instruction_skills_injected_into_prompt` |

---

## Task 1: AIMessage history reconstruction (`chat.py`)

**Files:**
- Modify: `backend/api/chat.py`
- Modify: `backend/tests/test_api_chat.py`

**Problem:** `chat.py` line 52–55 only appends `HumanMessage` objects from stored history. The comment on line 55 is wrong — LangGraph does **not** reconstruct previous assistant turns from nowhere. Every subsequent turn sees only user messages, destroying multi-turn context.

- [ ] **Step 1: Write the failing test**

Open `backend/tests/test_api_chat.py`. Add this test after `test_chat_persists_history`:

```python
def test_chat_preserves_assistant_history(client):
    """Turn 2 must receive both the human and assistant messages from turn 1."""
    session_id = _setup(client)
    captured_states = []

    async def fake_invoke(state):
        captured_states.append(state)
        return {
            "messages": state["messages"],
            "intent": "FALLBACK",
            "response": "I said hello back.",
        }

    mock_graph = AsyncMock()
    mock_graph.ainvoke.side_effect = fake_invoke

    with patch("api.chat.graph_registry") as mock_registry:
        mock_registry.get = AsyncMock(return_value=mock_graph)
        client.post("/api/chat", json={"session_id": session_id, "message": "Hello"})
        client.post("/api/chat", json={"session_id": session_id, "message": "What did you say?"})

    from langchain_core.messages import HumanMessage, AIMessage
    # The second invocation's state must contain turn-1 human AND assistant messages
    second_messages = captured_states[1]["messages"]
    assert any(isinstance(m, HumanMessage) and m.content == "Hello" for m in second_messages), \
        "Turn-1 user message missing from turn-2 state"
    assert any(isinstance(m, AIMessage) and m.content == "I said hello back." for m in second_messages), \
        "Turn-1 assistant message missing from turn-2 state"
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd backend
pytest tests/test_api_chat.py::test_chat_preserves_assistant_history -v
```

Expected: `FAILED` — the second state will be missing the `AIMessage`.

- [ ] **Step 3: Fix `backend/api/chat.py`**

Replace lines 1 and 50–56 (import + history loop):

```python
# Line 1 — replace existing import
from langchain_core.messages import AIMessage, HumanMessage
```

```python
    # Build history messages for LangGraph state (lines 50-56 — replace block)
    history_messages = []
    for turn in session.history:
        if turn["role"] == "user":
            history_messages.append(HumanMessage(content=turn["content"]))
        elif turn["role"] == "assistant":
            history_messages.append(AIMessage(content=turn["content"]))
```

Remove the stale comment `# assistant messages are included as AIMessage — LangGraph handles reconstruction`.

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd backend
pytest tests/test_api_chat.py -v
```

Expected: all chat tests `PASSED`.

- [ ] **Step 5: Commit**

```bash
git add backend/api/chat.py backend/tests/test_api_chat.py
git commit -m "fix(phase7): reconstruct AIMessage turns from session history in chat.py"
```

---

## Task 2: Specialist node sets `response` field (`graph/specialist.py`)

**Files:**
- Modify: `backend/graph/specialist.py`
- Modify: `backend/tests/test_api_chat.py`

**Problem:** `specialist.py` line 53–54 returns the raw `create_react_agent` result dict, which only contains `messages`. The `response` key is never set. `chat.py` line 70 falls back to `_extract_last_ai_message` silently — masking node failures and making the contract implicit.

- [ ] **Step 1: Write the failing test**

Add this test to `backend/tests/test_api_chat.py`:

```python
def test_chat_response_field_is_set_explicitly(client):
    """The graph result must have `response` set; we must not rely solely on message extraction."""
    session_id = _setup(client)

    # Return a state where `response` is explicitly set — chat.py must use it
    mock_graph = AsyncMock()
    mock_graph.ainvoke.return_value = {
        "messages": [],
        "intent": "FALLBACK",
        "response": "Explicit response from specialist",
    }

    with patch("api.chat.graph_registry") as mock_registry:
        mock_registry.get = AsyncMock(return_value=mock_graph)
        resp = client.post("/api/chat", json={
            "session_id": session_id,
            "message": "Test",
        })

    assert resp.json()["response"] == "Explicit response from specialist"
```

This test already passes because of the fallback in `chat.py` — but we want to lock in the explicit contract. The specialist fix test comes next.

- [ ] **Step 2: Fix `backend/graph/specialist.py`**

Replace lines 53–54 (the `ainvoke` call and `return`):

```python
        result = await react_agent.ainvoke(state)

        # Explicitly extract and set `response` so callers never rely on message extraction
        response_text = ""
        from langchain_core.messages import AIMessage as _AIMessage
        for msg in reversed(result.get("messages", [])):
            if isinstance(msg, _AIMessage):
                response_text = msg.content if isinstance(msg.content, str) else str(msg.content)
                break

        return {**result, "response": response_text}
```

- [ ] **Step 3: Run all tests**

```bash
cd backend
pytest tests/ -v
```

Expected: all tests `PASSED`.

- [ ] **Step 4: Commit**

```bash
git add backend/graph/specialist.py backend/tests/test_api_chat.py
git commit -m "fix(phase7): specialist node sets response field explicitly in returned state"
```

---

## Task 3: `user_id` type fix (`graph/state.py`)

**Files:**
- Modify: `backend/graph/state.py`

**Problem:** `SupervisorState.user_id` is declared `str` (required) but `specialist.py` uses `state.get("user_id")` which returns `str | None`, and the resolver's `resolve_skills` accepts `user_id: str | None`. The declaration doesn't match usage.

- [ ] **Step 1: Edit `backend/graph/state.py` line 9**

Replace:
```python
    user_id: str
```
With:
```python
    user_id: str | None
```

The full file after the change:

```python
from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class SupervisorState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    user_id: str | None
    session_id: str
    intent: str | None    # set by classifier node; drives conditional routing
    response: str | None  # set by specialist subgraph; returned to caller
    metadata: dict | None  # forwarded from chat request to hook; optional free-form context
```

- [ ] **Step 2: Run all tests to confirm no regressions**

```bash
cd backend
pytest tests/ -v
```

Expected: all tests `PASSED`.

- [ ] **Step 3: Commit**

```bash
git add backend/graph/state.py
git commit -m "fix(phase7): user_id in SupervisorState is str | None to match resolver usage"
```

---

## Task 4: `AgentOut` missing `config_hook_secret` (`api/agents.py`)

**Files:**
- Modify: `backend/api/agents.py`
- Modify: `backend/tests/test_api_agents.py`

**Problem:** `AgentOut` (line 48–62) exposes `config_hook_url` but silently drops `config_hook_secret`. The `skill_hook_*` pair is returned in full — the `config_hook_*` pair should be symmetric.

- [ ] **Step 1: Write the failing test**

Add this test to `backend/tests/test_api_agents.py`:

```python
def test_agent_config_hook_fields_in_response(client):
    """AgentOut must include config_hook_url AND config_hook_secret."""
    prov = client.post("/api/providers", json={
        "name": "cfg-hook-provider",
        "type": "anthropic-api-key",
        "credentials": {"api_key": "test"},
        "model": "claude-3-haiku-20240307",
    }).json()

    agent = client.post("/api/agents", json={
        "name": "cfg-hook-agent",
        "persona": "I test config hooks.",
        "provider_id": prov["id"],
        "config_hook_url": "https://example.com/config-hook",
        "config_hook_secret": "cfg-secret-value",
    }).json()

    resp = client.get(f"/api/agents/{agent['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["config_hook_url"] == "https://example.com/config-hook"
    assert "config_hook_secret" in data, "config_hook_secret must be returned in AgentOut"
    assert data["config_hook_secret"] == "cfg-secret-value"
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd backend
pytest tests/test_api_agents.py::test_agent_config_hook_fields_in_response -v
```

Expected: `FAILED` — `config_hook_secret` will be absent from the response.

- [ ] **Step 3: Fix `backend/api/agents.py`**

In the `AgentOut` class (lines 48–62), add `config_hook_secret` after `config_hook_url`:

```python
class AgentOut(BaseModel):
    id: str
    name: str
    persona: str
    rules: str | None
    provider_id: str
    is_supervisor: bool
    memory_enabled: bool
    memory_types: list[str]
    config_hook_url: str | None
    config_hook_secret: str | None
    skill_hook_url: str | None
    skill_hook_secret: str | None
    created_at: datetime
    skills: list[SkillSummary]
    model_config = ConfigDict(from_attributes=True)
```

- [ ] **Step 4: Run all tests**

```bash
cd backend
pytest tests/ -v
```

Expected: all tests `PASSED`.

- [ ] **Step 5: Commit**

```bash
git add backend/api/agents.py backend/tests/test_api_agents.py
git commit -m "fix(phase7): add config_hook_secret to AgentOut response model"
```

---

## Task 5: Missing test — instruction skills injected into prompt (`test_skills_registry.py`)

**Files:**
- Modify: `backend/tests/test_skills_registry.py`

**Problem:** `build_tools_for_agent` returns `(tools, instruction_skills)` and `specialist.py` passes `instruction_skills` to `build_system_prompt`. There is no test that verifies the instruction skill body text actually appears in the assembled system prompt — the integration point is untested.

- [ ] **Step 1: Write the failing test**

The test does not fail at import time — it will fail only if the assertion is wrong. Add this to `backend/tests/test_skills_registry.py`:

```python
@pytest.mark.asyncio
async def test_instruction_skills_injected_into_prompt():
    """Instruction skills returned by build_tools_for_agent must appear in system prompt."""
    from graph.prompt import build_system_prompt
    from unittest.mock import MagicMock

    agent = _make_agent()
    agent.persona = "I am a test agent."
    agent.rules = None

    resolved = [_make_resolved(
        "my-guide",
        skill_type="instruction",
        implementation="Always be polite and helpful.",
    )]

    with patch("skills.registry.resolve_skills", new=AsyncMock(return_value=resolved)):
        tools, instruction_skills = await build_tools_for_agent(
            agent=agent, user_id="u1", db=MagicMock()
        )

    # instruction skills must NOT appear in the tools list
    assert tools == [], "instruction skill must not become a Tool"
    assert len(instruction_skills) == 1

    # assembling the system prompt must embed the skill body
    prompt = build_system_prompt(agent, instruction_skills)
    assert "my-guide" in prompt, "skill name must appear as a section header"
    assert "Always be polite and helpful." in prompt, "skill body must appear in prompt"
```

- [ ] **Step 2: Run the test to confirm it passes** (it exercises existing code — verify green)

```bash
cd backend
pytest tests/test_skills_registry.py::test_instruction_skills_injected_into_prompt -v
```

Expected: `PASSED`. If it fails, the instruction skill body field name differs — check `ResolvedSkill.implementation` vs `.body` in `resolver.py` and align.

- [ ] **Step 3: Run the full suite**

```bash
cd backend
pytest tests/ -q
```

Expected: `80 passed` (or more).

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_skills_registry.py
git commit -m "test(phase7): assert instruction skills are injected into system prompt"
```

---

## Task 6: Update docs and mark Phase 7 complete

**Files:**
- Modify: `docs/superpowers/plans/2026-03-31-phase7-skill-registry.md`
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Append bug-fix addendum to the Phase 7 plan**

Open `docs/superpowers/plans/2026-03-31-phase7-skill-registry.md` and append at the very end:

```markdown
---

## Bug-Fix Addendum (2026-04-01)

Post-implementation code review identified five defects. All fixed and tested.

- [x] **A1** — `chat.py`: reconstruct `AIMessage` turns from session history (was discarding assistant turns)
- [x] **A2** — `graph/specialist.py`: explicitly set `response` key in returned state dict
- [x] **A3** — `graph/state.py`: `user_id: str | None` (was `str`, mismatching resolver)
- [x] **A4** — `api/agents.py`: add `config_hook_secret` to `AgentOut` (was asymmetrically omitted)
- [x] **A5** — `tests/test_skills_registry.py`: add `test_instruction_skills_injected_into_prompt`
```

- [ ] **Step 2: Mark Phase 7 complete in ROADMAP.md**

In `docs/ROADMAP.md`, find the Phase 7 heading:

```markdown
## Phase 7 — "Skill-as-a-Package" Modular Architecture
```

Replace with:

```markdown
## Phase 7 — "Skill-as-a-Package" Modular Architecture ✅
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-03-31-phase7-skill-registry.md docs/ROADMAP.md
git commit -m "docs: mark Phase 7 complete; append bug-fix addendum to plan"
```

---

## Final verification

- [ ] **Run the full test suite one last time**

```bash
cd backend
pytest tests/ -v
```

Expected: all tests `PASSED`, count ≥ 80.
