# LangGraph Python Backend Design

**Date:** 2026-03-27
**Status:** Approved
**Scope:** Python backend implementation of the agent framework using LangGraph, FastAPI, SQLite, and ChromaDB

---

## 1. Context and Motivation

The framework originally scaffolded a TypeScript agent loop (`src/`) as a prototype. A subsequent pivot established the Python `backend/` as the primary runtime, with a React UI (`ui/`) wired to it. The TypeScript code remains as a reference for design patterns (plugin loading, progressive skill disclosure, provider abstraction) but is not the execution target.

This spec defines the complete Python backend implementation: the database layer, LangGraph graph structure, provider abstraction, skill system, memory system, config hook mechanism, and API surface.

---

## 2. Technology Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Agent orchestration | LangGraph | Native support for stateful graphs, conditional routing, subgraph isolation, and hot-reload via recompilation |
| API layer | FastAPI | Already established in backend/main.py; async-native, Pydantic validation |
| Relational DB | SQLite via SQLAlchemy + Alembic | Embedded, zero infrastructure, single file; migrate to SQLCipher for at-rest encryption without code changes |
| Vector DB | ChromaDB (embedded) | Runs in-process, no server, excellent Python API; used for memory retrieval |
| Provider abstraction | LangChain | Covers all required provider types under a unified interface |

---

## 3. Database Schema

All tables use UUID primary keys. `created_at` / `updated_at` are UTC datetimes.

### `providers`
```sql
id           UUID  PK
name         TEXT  UNIQUE NOT NULL     -- "Anthropic Production"
type         TEXT  NOT NULL            -- see provider types below
credentials  JSON  NOT NULL            -- {"api_key": "..."} — encrypted at rest in Phase A
model        TEXT  NOT NULL            -- "claude-opus-4-6", "gpt-4o"
is_default   BOOL  DEFAULT false
created_at   DATETIME
```

**Provider types:** `anthropic-api-key` | `anthropic-setup-auth` | `openai-api-key` | `openai-codex-oauth` | `google-api-key` | `custom-url`

### `agents`
```sql
id              UUID  PK
name            TEXT  UNIQUE NOT NULL  -- "EmailClassifier", "PayrollWorker"
persona         TEXT  NOT NULL         -- SOUL.md equivalent: identity + behavioural constraints
rules           TEXT                   -- AGENTS.md equivalent: operational rules
provider_id     UUID  FK→providers
is_supervisor   BOOL  DEFAULT false    -- only one agent should be supervisor
memory_enabled  BOOL  DEFAULT false
memory_types    JSON  DEFAULT '["user","feedback","project","reference"]'
config_hook_url     TEXT               -- Phase 2+: nullable HTTP endpoint
config_hook_secret  TEXT               -- Phase 2+: HMAC-SHA256 signing secret
created_at      DATETIME
```

### `skills`
```sql
id              UUID  PK
name            TEXT  UNIQUE NOT NULL  -- "classify-email", "http-call"
description     TEXT  NOT NULL         -- shown to LLM in tool list
input_schema    JSON  NOT NULL         -- JSON Schema for tool input validation
implementation  TEXT  NOT NULL         -- Python function body executed as the tool
created_at      DATETIME
```

### `agent_skills`
```sql
agent_id   UUID  FK→agents   NOT NULL
skill_id   UUID  FK→skills   NOT NULL
PRIMARY KEY (agent_id, skill_id)
```

### `routing_rules`
```sql
id               UUID  PK
supervisor_id    UUID  FK→agents  NOT NULL
intent_label     TEXT  NOT NULL   -- "starter-processing", "timesheet-import", "FALLBACK"
target_agent_id  UUID  FK→agents  NOT NULL
priority         INT   DEFAULT 0
```

### `sessions`
```sql
id          UUID  PK
user_id     TEXT  NOT NULL
agent_id    UUID  FK→agents  NOT NULL   -- supervisor agent for this session
history     JSON  DEFAULT '[]'          -- [{role, content}, ...]
created_at  DATETIME
updated_at  DATETIME
```

### `memories`
```sql
id          UUID  PK
agent_id    UUID  FK→agents  NOT NULL
user_id     TEXT                        -- NULL = shared across all users of this agent
type        TEXT  NOT NULL             -- user | feedback | project | reference
name        TEXT  NOT NULL             -- short slug, e.g. "user_role"
description TEXT  NOT NULL             -- one-line summary used for relevance ranking
content     TEXT  NOT NULL             -- full memory body
chroma_id   TEXT                       -- ChromaDB document ID for semantic retrieval
created_at  DATETIME
updated_at  DATETIME
```

---

## 4. LangGraph Graph Structure

### 4.1 Shared State

```python
class SupervisorState(TypedDict):
    messages:   Annotated[list, add_messages]  # full conversation history
    user_id:    str
    session_id: str
    intent:     str | None   # set by classifier node, drives routing
    response:   str | None   # set by specialist subgraph, returned to user
```

### 4.2 Supervisor Graph

```
[START]
   │
   ▼
[classifier node]          LLM call; sets state["intent"]
   │
   ▼
[conditional edge]         maps intent → agent node name (from routing_rules)
   │
   ├──► [specialist-A subgraph]
   ├──► [specialist-B subgraph]
   └──► [specialist-N subgraph]
            │
            ▼
          [END]
```

The graph is compiled by `GraphRegistry.rebuild()` which reads all agents and routing rules from SQLite. Any CRUD change to agents, skills, or routing rules triggers a rebuild. The next `/api/chat` request runs the fresh graph with no restart.

### 4.3 Classifier Node

An LLM call using the supervisor agent's configured provider. Its prompt lists all available intent labels from `routing_rules` so it always reflects current DB state. Returns `{"intent": "<label>"}`.

### 4.4 Specialist Subgraph

Each agent with `is_supervisor = false` becomes a compiled subgraph node:

```python
def build_specialist(agent: AgentRow, db: Session, user_id: str) -> CompiledGraph:
    llm     = provider_factory(agent.provider)
    tools   = skill_registry.load(agent.skills)
    prompt  = build_system_prompt(agent, user_id)  # persona + rules + memories + hook
    return create_react_agent(llm, tools, state_modifier=prompt)
```

The specialist runs a full ReAct loop (observe → think → tool call → observe → ...) until it reaches a final answer, then returns to the supervisor which exits.

### 4.5 Graph Registry (hot-reload)

```python
class GraphRegistry:
    _graph: CompiledGraph | None = None

    async def get(self) -> CompiledGraph:
        if self._graph is None:
            await self.rebuild()
        return self._graph

    async def rebuild(self, db: Session) -> None:
        agents = load_all_agents(db)
        self._graph = build_supervisor(agents)
```

`rebuild()` is called on startup and after any config mutation via the API.

---

## 5. System Prompt Assembly

For every agent invocation, the system prompt is assembled in this order:

```
1. agents.persona          (SOUL.md equivalent — always present)
2. agents.rules            (AGENTS.md equivalent — if set)
3. config hook response    (Phase 2+ — if config_hook_url is set)
4. retrieved memories      (if memory_enabled — top-K from ChromaDB)
5. additional_context      (from hook response — if provided)
```

Hook response fields (`persona`, `rules`, `additional_context`) override DB values where provided. DB values are the fallback.

---

## 6. Memory System (OpenClaw Pattern, DB-backed)

Memory is optional per agent (`memory_enabled` flag). When enabled:

**Retrieval (before each agent run):**
1. ChromaDB semantic search over memories for `(agent_id, user_id)` with query = current message
2. Top-K results injected into the system prompt as a `[Memories]` section

**Saving (during agent run):**
- Agent calls the built-in `save_memory` tool
- Tool writes to `memories` table (SQLite) and upserts the embedding in ChromaDB
- Memory types: `user` | `feedback` | `project` | `reference`

**Scope:**
- `user_id = NULL` memories are shared across all users of that agent
- `user_id = "abc"` memories are private to that user

This enables virtual-assistant style agents that accumulate user-specific knowledge across sessions.

---

## 7. Config Hook (Phase 2+)

Each agent can optionally have a `config_hook_url`. When set:

**Request (POST to hook URL before every agent run):**
```json
{
  "agent_id":   "uuid",
  "agent_name": "EmailClassifier",
  "user_id":    "user-123",
  "role":       "orchestrator",
  "context":    { "turn_count": 3, "session_id": "uuid" }
}
```

**Response (all fields optional):**
```json
{
  "persona":            "You are...",
  "rules":              "Always...",
  "additional_context": "Today is..."
}
```

**Behaviour:**
- Timeout: 5 seconds (configurable via env var)
- On failure or timeout: fall back to DB config silently; log warning
- Request signed with `X-Hook-Signature: sha256=<hmac>` using `config_hook_secret`
- Framework remains unaware of any external hierarchy — it is purely an execution engine

**Phase 1:** hook_url is null on all agents; this code path is never entered.

---

## 8. Provider Abstraction

A `provider_factory(provider_row)` function returns a LangChain LLM instance:

| Type | LangChain class | Credential fields |
|---|---|---|
| `anthropic-api-key` | `ChatAnthropic` | `api_key` |
| `anthropic-setup-auth` | `ChatAnthropic` | OAuth token resolved from Claude CLI at runtime |
| `openai-api-key` | `ChatOpenAI` | `api_key` |
| `openai-codex-oauth` | `ChatOpenAI` | OAuth token injected at runtime |
| `google-api-key` | `ChatGoogleGenerativeAI` | `api_key` |
| `custom-url` | `ChatOpenAI` | `base_url`, optional `api_key` |

---

## 9. Skill System

Skills are LangChain tools defined in the `skills` table:

- `input_schema` — JSON Schema validated by Pydantic at registration time
- `implementation` — Python function body; executed by `SkillExecutor` using `exec()` with a restricted globals dict (no `__builtins__` access beyond an explicit allowlist)
- Skills are loaded from DB and compiled into LangChain `Tool` objects at graph-build time

**Built-in core skills** (always available, defined in code):
- `http_call` — outbound HTTP requests
- `save_memory` — writes to memories table + ChromaDB
- `read_memory` — semantic search over memories

---

## 10. API Surface

### Config (all mutations trigger `registry.rebuild()`)
```
GET/POST              /api/providers
GET/PUT/DELETE        /api/providers/{id}
GET/POST              /api/agents
GET/PUT/DELETE        /api/agents/{id}
POST                  /api/agents/{id}/skills        attach skill
DELETE                /api/agents/{id}/skills/{sid}  detach skill
GET/POST              /api/skills
GET/PUT/DELETE        /api/skills/{id}
GET/POST              /api/routing-rules
GET/PUT/DELETE        /api/routing-rules/{id}
```

### Sessions + Chat
```
POST                  /api/sessions          create session → { session_id }
DELETE                /api/sessions/{id}     clear history
POST                  /api/chat              run graph → { response, intent, agent_used, ... }
```

### Memory
```
GET                   /api/memories?agent_id=&user_id=
POST                  /api/memories
DELETE                /api/memories/{id}
```

### System
```
GET                   /api/health
POST                  /api/graph/rebuild     force recompile
GET                   /api/graph/status
```

---

## 11. Backend File Structure

```
backend/
├── main.py                    # FastAPI app, lifespan, route registration
├── requirements.txt
├── config.py                  # env vars, settings
│
├── db/
│   ├── database.py            # SQLAlchemy engine + session factory
│   ├── models.py              # ORM models
│   └── migrations/            # Alembic migration scripts
│
├── api/
│   ├── providers.py
│   ├── agents.py
│   ├── skills.py
│   ├── routing_rules.py
│   ├── sessions.py
│   ├── chat.py
│   ├── memories.py
│   └── system.py
│
├── graph/
│   ├── registry.py            # GraphRegistry — holds compiled graph, rebuild()
│   ├── supervisor.py          # build_supervisor_graph()
│   ├── specialist.py          # build_specialist_subgraph()
│   ├── classifier.py          # classifier node
│   └── state.py               # SupervisorState TypedDict
│
├── providers/
│   ├── factory.py
│   ├── anthropic_api_key.py
│   ├── anthropic_setup_auth.py
│   ├── openai_api_key.py
│   ├── openai_codex_oauth.py
│   ├── google_api_key.py
│   └── custom_url.py
│
├── skills/
│   ├── registry.py
│   ├── executor.py
│   └── core/
│       ├── http_call.py
│       ├── save_memory.py
│       └── read_memory.py
│
├── memory/
│   ├── manager.py
│   ├── chroma.py
│   └── prompt_injector.py
│
└── hooks/
    └── config_hook.py         # Phase 2+
```

---

## 12. Phase Evolution (B → A)

| Capability | Phase B (current spec) | Phase A (future) |
|---|---|---|
| Graph topology | Fixed: all agents in DB become nodes | Dynamic: add/remove agents via UI, graph rebuilds |
| Routing | Built from routing_rules table at compile time | Same table; UI exposes editing |
| Skills | Created via API, attached to agents | Same; UI skill builder |
| Config hook | Not implemented (null hook_url) | Activated per-agent via UI |
| Encryption | Plaintext SQLite | SQLCipher drop-in |
| Vector store | ChromaDB embedded | ChromaDB or hosted alternative |

Phase A requires no schema changes — the schema already supports the full vision. Phase A is primarily a UI and factory-wiring effort.
