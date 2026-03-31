# Specification: Phase 7 — Skill Registry Redesign (Backend)

**Date:** 2026-03-31
**Status:** Approved
**Phase:** 7 (Backend first; UI follows as a separate phase)
**Scope:** Migrate from DB-only, exec()-based skill loading to a layered resolver with filesystem system skills, per-user DB skills, and per-agent application hook injection.

---

## 1. Problem Statement

The current skill system has three limitations that block the framework's multi-user, multi-tenant goals:

1. **All skills live in the DB.** System-scope skills (read-file, bash-exec, etc.) are seeded into the database on startup rather than read from the canonical `.agents/skills/` packages. This breaks the skill-as-a-package model defined in `docs/CONVENTIONS.md §4.2`.
2. **No user scoping.** Any skill attached to an agent is available to every user that talks to that agent. There is no mechanism to scope a skill to a specific user.
3. **No application injection.** There is no way for an external application (e.g. a connected SaaS) to inject context-specific skills at request time — for example, injecting tenant-specific tools when a particular user is identified.

---

## 2. Design Goals

- System skills live on the filesystem; the DB is for user-created skills only.
- Skills can be `type: instruction` (injected into the system prompt) or `type: executable` (run as a LangChain tool). Both types can exist in any storage layer.
- An external application can inject skills via a per-agent HTTP hook. The framework never knows or cares about tenant logic — that belongs to the application.
- Hook failure is always non-blocking. Agent startup must not break if the hook is unavailable.
- Resolution is deterministic: **hook > user DB > system filesystem** on name collision.

---

## 3. Data Model

### 3.1 `skills` table — new columns (Alembic migration)

| Column | Type | Default | Notes |
|---|---|---|---|
| `skill_type` | `VARCHAR` | `'executable'` | `instruction` or `executable` |
| `version` | `VARCHAR` | `'1.0.0'` | Semver |
| `author` | `VARCHAR` | `'user'` | `system` is reserved for filesystem skills |
| `user_id` | `VARCHAR` nullable | `NULL` | NULL = any agent user; set = scoped to one user |
| `allowed_tools` | `JSON` | `[]` | Mirrors SKILL.md `allowed-tools` frontmatter |
| `user_invocable` | `BOOLEAN` | `False` | Expose as slash command |
| `disable_model_invocation` | `BOOLEAN` | `False` | Hook/trigger-only restriction |
| `context_requirements` | `JSON` | `[]` | Context keys required at load time (e.g. `["user_id"]`) |

Existing columns (`id`, `name`, `description`, `input_schema`, `implementation`, `created_at`) are unchanged. For `skill_type: instruction` skills, `implementation` holds the instruction body text. For `skill_type: executable`, it holds Python code.

### 3.2 `agents` table — new columns (same migration)

| Column | Type | Default | Notes |
|---|---|---|---|
| `skill_hook_url` | `VARCHAR` nullable | `NULL` | Application endpoint for skill injection |
| `skill_hook_secret` | `VARCHAR` nullable | `NULL` | HMAC-SHA256 signing secret |

Consistent with the existing `config_hook_url` / `config_hook_secret` pattern on Agent.

---

## 4. New Modules

### 4.1 `backend/skills/loader.py` — Filesystem reader

Scans `.agents/skills/*/SKILL.md` and returns `SystemSkill` dataclasses. Called once per `graph_registry.rebuild()` and cached until the next rebuild.

```python
@dataclass
class SystemSkill:
    name: str
    version: str
    description: str
    author: str                      # always "system"
    skill_type: str                  # "instruction" | "executable"
    allowed_tools: list[str]
    user_invocable: bool
    disable_model_invocation: bool
    context_requirements: list[str]
    body: str                        # full markdown body after frontmatter
    source_path: str                 # absolute path to SKILL.md

def load_system_skills(skills_dir: Path) -> list[SystemSkill]: ...
```

- Missing optional frontmatter fields default gracefully (no exception).
- Binary or unparseable SKILL.md files are skipped with a warning log.

### 4.2 `backend/skills/hook.py` — Application injection

```python
@dataclass
class HookSkill:
    name: str
    description: str
    skill_type: str
    implementation: str
    version: str
    allowed_tools: list[str]
    user_invocable: bool
    disable_model_invocation: bool
    context_requirements: list[str]

async def fetch_hook_skills(
    hook_url: str,
    hook_secret: str | None,
    user_id: str,
    agent_id: str,
    session_id: str | None,
    metadata: dict,
) -> list[HookSkill]: ...
```

**Request contract (POST to `hook_url`):**
```json
{
  "user_id": "string",
  "agent_id": "string",
  "session_id": "string | null",
  "metadata": {}
}
```
Request is signed with `X-Hook-Signature: sha256=<hmac>` when `hook_secret` is set.

**Response contract:**
```json
{
  "skills": [
    {
      "name": "kebab-case-name",
      "description": "...",
      "skill_type": "executable | instruction",
      "implementation": "...",
      "version": "1.0.0",
      "allowed_tools": [],
      "user_invocable": false,
      "disable_model_invocation": false,
      "context_requirements": []
    }
  ]
}
```

**Failure behaviour:**
- Timeout after 5 seconds → log warning, return `[]`
- Non-200 response → log warning with status code, return `[]`
- Malformed JSON → log warning, return `[]`
- Hook failure never raises; it is always a graceful no-op.

### 4.3 `backend/skills/resolver.py` — Priority merge

```python
@dataclass
class ResolvedSkill:
    name: str
    description: str
    skill_type: str          # "instruction" | "executable"
    implementation: str
    version: str
    author: str
    allowed_tools: list[str]
    user_invocable: bool
    disable_model_invocation: bool
    context_requirements: list[str]
    source: str              # "hook" | "user" | "system"

async def resolve_skills(
    agent: Agent,
    user_id: str | None,
    session_id: str | None,
    metadata: dict | None,
    system_skills: list[SystemSkill],   # from loader cache
    db: Session,
) -> list[ResolvedSkill]: ...
```

**Resolution logic:**
1. Fetch hook skills (`fetch_hook_skills`) if `agent.skill_hook_url` is set.
2. Query DB skills: all skills attached to this agent where `user_id IS NULL OR user_id = :user_id`.
3. Use cached `system_skills` list.
4. Merge by `name`. Precedence: **hook > user DB > system**. First occurrence wins.
5. Skills with `disable_model_invocation: True` are excluded from the resolved list (they are not surfaced to the LLM).

### 4.4 `backend/skills/registry.py` — Updated tool builder

```python
def build_tools_for_agent(
    agent: Agent,
    user_id: str | None = None,
    session_id: str | None = None,
    metadata: dict | None = None,
    system_skills: list[SystemSkill] | None = None,
    db: Session | None = None,
) -> tuple[list[Tool], list[ResolvedSkill]]:
    ...
```

Returns a tuple:
- `list[Tool]` — LangChain tools built from `skill_type: executable` skills only
- `list[ResolvedSkill]` — `skill_type: instruction` skills, to be passed to `build_system_prompt`

`executor.py` is unchanged for now (Phase 1 sandbox). The `_make_executor` function is called only for `skill_type: executable` skills.

### 4.5 `backend/graph/prompt.py` — Small update

```python
def build_system_prompt(
    agent: Agent,
    instruction_skills: list[ResolvedSkill] | None = None,
) -> str:
```

When `instruction_skills` is provided and non-empty, each skill's `implementation` body is appended as a named `## {skill.name}` section after the agent's rules block.

---

## 5. API Changes

### 5.1 `GET /api/skills/system` (new)

Returns all skills loaded from `.agents/skills/*/SKILL.md`. Reads from the in-memory cache; no DB hit. Response is a list of `SystemSkillOut` (same shape as `SkillOut` plus metadata fields; no `id`, no `created_at`).

### 5.2 `GET /api/skills` (updated)

`SkillOut` response model gains all new columns. `SkillCreate` and `SkillUpdate` gain the same fields as optional with defaults.

### 5.3 `PUT /api/agents/{id}` (additive)

`AgentUpdate` Pydantic model gains two optional fields:
- `skill_hook_url: str | None`
- `skill_hook_secret: str | None`

No new endpoint — the existing agent update handler covers it.

---

## 6. Call Flow

### 6.1 Graph pre-compilation vs. per-request tool resolution

The current `graph_registry.rebuild()` pre-compiles the LangGraph graph with tools baked in at startup. This approach breaks when tools depend on `user_id`, which is only known per-request.

**Solution:** The specialist node resolves skills lazily at invocation time rather than at compile time. The graph structure (nodes, edges, conditional routing) is still pre-compiled at `rebuild()`. Only the tool list is resolved dynamically inside the specialist node, using `user_id` and `session_id` from the `SupervisorState`.

`graph_registry` caches the `system_skills` list (loaded from filesystem at rebuild). Each specialist node invocation receives this cached list from the registry.

### 6.2 Per-request flow

```
POST /api/chat  →  chat.py
  │  (carries user_id, session_id, optional metadata in request body)
  │
  ├─ graph_registry.get_graph(agent_id)   # returns pre-compiled graph
  │
  └─ graph.invoke(state)                  # state includes user_id, session_id, metadata
       │
       └─ specialist node (invoked per request)
            │
            ├─ registry.build_tools_for_agent(agent, user_id, session_id, metadata, system_skills, db)
            │    │
            │    └─ resolver.resolve_skills(...)
            │         ├─ hook.fetch_hook_skills(...)     # if skill_hook_url set
            │         ├─ db.query(Skill) by user         # user + unscoped DB skills
            │         └─ system_skills cache             # filesystem, from registry
            │
            ├─ executable skills → list[Tool]  (passed to create_react_agent at invoke time)
            └─ instruction skills → injected into system prompt for this invocation
```

**`metadata`** is an optional free-form dict passed in the `POST /api/chat` request body alongside `user_id` and `session_id`. It is forwarded unchanged to the hook. Typical uses: request tags, feature flags, application context.

---

## 7. Tests

| Test | What it covers |
|---|---|
| `test_loader_parses_skill_md` | Fixture SKILL.md → all frontmatter fields parsed correctly |
| `test_loader_handles_missing_optional_fields` | Partial frontmatter → graceful defaults, no exception |
| `test_loader_skips_invalid_files` | Malformed SKILL.md → warning logged, file skipped |
| `test_hook_returns_skills` | Mocked HTTP returns valid payload → skills included at top priority |
| `test_hook_timeout_fallback` | 5-second timeout → returns `[]`, no exception |
| `test_hook_bad_response_fallback` | HTTP 500 → returns `[]`, warning logged |
| `test_hook_hmac_signature` | Secret set → request carries correct `X-Hook-Signature` header |
| `test_resolver_priority_order` | Same name in hook + user + system → hook version wins |
| `test_resolver_user_scoping` | Skill with `user_id=A` not returned when resolving for user B |
| `test_resolver_disable_model_invocation` | Skill with flag set → excluded from resolved list |
| `test_resolver_instruction_excluded_from_tools` | `skill_type=instruction` → not in Tool list |
| `test_resolver_instruction_in_prompt` | `skill_type=instruction` → body appears in `build_system_prompt` output |
| `test_api_skills_system_endpoint` | `GET /api/skills/system` returns filesystem skills with correct shape |
| `test_api_skill_metadata_fields` | Create skill with new fields → GET returns them correctly |
| `test_agent_skill_hook_fields` | Update agent with `skill_hook_url` → GET returns it |

---

## 8. Out of Scope (this phase)

- Subprocess/Docker sandbox for executable skills (Phase 2, tracked separately)
- `POST /api/skills/ingest` and `POST /api/skills/authorise` ingestion API (Phase 2)
- SkillsView UI redesign (separate UI phase, after this backend phase is merged and tested)
- Tenant-level DB model (`tenant_id` column) — handled entirely by application hook logic; framework has no tenant concept
