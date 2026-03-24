# Proposed Architecture

## 1. Plugin System Design

The framework defaults to a capable generalist but transitions into a specialist upon plugin initialisation.
A plugin is **the only source of identity** for any agent — whether that agent is an orchestrator or a worker sub-agent.
The same base agent binary is reused everywhere; plugins are simply attached at spawn time.

**Plugin Manifest Format (`manifest.json`)**:
```json
{
  "id": "email-classifier",
  "name": "EmailClassifier",
  "version": "1.0.0",
  "role": "Precision email triage agent for UK payroll operations",
  "entrypoint": "SOUL.md",
  "skillsDir": "skills/"
}
```

- **Plugin Obligations**: A plugin must supply a `manifest.json`, a `SOUL.md` (defining identity, persona, and behavioural constraints), and its own isolated `skills/` directory containing `SKILL.md` definitions.
- **Detection & Transition**: Upon boot, the base agent scans the `plugins/` directory (or a configured active plugin pointer). If a plugin is found, its `manifest.json` overrides the base name and role, its `SOUL.md` overrides the base system prompt persona, and its `skills/` are appended to the available tool manifest.
- **Workers are also base agents**: When the orchestrator spawns a sub-agent (worker), it spawns a fresh base agent and attaches a plugin to it — exactly the same pattern. There is no separate "worker agent type"; all agents are base agents with plugins.

**Planned Plugins for this Project**:

| Plugin ID | Display Name | Purpose |
|---|---|---|
| `email-classifier` | `EmailClassifier` | Orchestrates email triage — classifies incoming emails and dispatches the correct worker sub-agent |
| `uk-payroll-processor` | `UkPayrollProcessor` | Worker — executes UK Payroll API calls (starters, timesheets, tasks) |
| `uk-payroll-app-agent` | `UkPayrollAppAgent` | Standalone — helps users navigate and understand the UK Payroll App via RAG and MCP |
| `sniper-sharp-agent` | `SniperSharpAgent` | High-precision software architect (general-purpose developer assistant) |

**Example Plugin Directory Structure**:
```
plugins/
  email-classifier/
    manifest.json
    SOUL.md
    README.md
    skills/
      classify-email/
        SKILL.md
      parse-attachment/
        SKILL.md

  uk-payroll-processor/
    manifest.json
    SOUL.md
    README.md
    skills/
      process-starter/
        SKILL.md        ← Wraps POST /api/starters
      import-timesheet/
        SKILL.md        ← Wraps POST /api/timesheets/import
      create-task/
        SKILL.md        ← Wraps POST /api/tasks

  uk-payroll-app-agent/
    manifest.json
    SOUL.md
    README.md
    skills/
      rag-search/
        SKILL.md
      mcp-query/
        SKILL.md
      lookup-error-code/
        SKILL.md

  sniper-sharp-agent/
    manifest.json
    SOUL.md
    README.md
    skills/
      code-analysis/
        SKILL.md
```

---

## 2. Skills as API Wrappers

A skill is a focused, single-purpose capability. For this project, the payroll-processing skills each wrap exactly one UK Payroll API endpoint. The skill's `SKILL.md` documents:
- The endpoint (`POST /api/starters`)
- The expected request shape (JSON body fields)
- The expected response shape (what fields to extract)
- The `allowed-tools` it needs (e.g. `http-call`)

Skills are loaded on demand (progressive disclosure) — not all at boot — to keep the context window lean.

**Skill Scope Hierarchy** (higher wins on name collision):
```
User > Plugin > Core
```

---

## 3. Multi-User Memory Model

To support multiple users simultaneously while retaining shared operational logic, memory is segmented strictly.

**Directory Structure**:
```
memory/
  shared/
    long-term/        # RAG / embeddings available to all users (e.g. app docs, HMRC guides)
    rules/            # System-wide operational rules
  users/
    {user-id}/
      session/        # Ephemeral context for current conversation
      long-term/      # Per-user persistent RAG/embeddings
      preferences/    # User-specific config overrides
        skills/       # User-level skill overrides (shadow Plugin and Core)
```

- **Identification & Routing**: Every incoming request must include a `userId`. The Gateway/Router maps the request context to `memory/users/{userId}/`.
- **Isolation**: Sub-agents inherit only the specific `{userId}` memory path required for the task. No code path may construct a memory path without a bound `userId`.
- **Shared memory** is read-only for all agents. Only an explicit orchestration-level permission allows writes to `memory/shared/`.

---

## 4. Sub-Agent Orchestration Design

Sub-agent orchestration treats the primary agent session as an **Orchestrator** and spawned sessions as **Workers**.
Workers are themselves base agents with a plugin attached — the plugin is what gives the worker its specialisation.

### The Email Classification Pipeline (Concrete Example)

```
Email arrives
    ↓
Email Classifying Agent  (base agent + email-classifier plugin)
    uses skill: classify-email
    classifies into: STARTER | TIMESHEET | TASK
    ↓
Spawns: UK Payroll Processor Sub-Agent  (base agent + uk-payroll-processor plugin)
    injects task as structured JSON prompt: { type: "STARTER", data: { ... } }
    ↓
Worker loads skill: process-starter (or import-timesheet or create-task)
    calls UK Payroll API
    returns: strict JSON result
    context window destroyed
    ↓
Orchestrator receives result
    logs to memory/users/{userId}/session/
    returns structured summary to caller
```

### Orchestration Rules

- **Decomposition & Dispatch**: The Orchestrator receives a complex prompt, breaks it into sub-tasks, and spawns worker sub-agents.
- **Parallel Dispatch**: If tasks share no dependency and alter no shared state, the Orchestrator fires multiple workers concurrently.
- **Sequential Chaining**: If Task B requires Task A's output, they are chained. Worker A runs; its output is injected into Worker B's isolated prompt.
- **Result Synthesis**: Workers run in isolated context windows. They reply strictly with structured JSON. The Orchestrator aggregates these payloads.
- **Sub-Agent Definitions**: Worker prompts and permissions are declared in `.agents/subagents/{agent-name}.yaml`.

---

## 5. Skill Scope Model

Skills are resolved through a tiered hierarchy, allowing higher-specificity scopes to shadow lower ones.

1. **Core (Base tier)**: Built-in framework capabilities (`read_file`, `write_file`, `http_call`, `bash`).
2. **Plugin (Specialist tier)**: Skills injected dynamically by the active plugin. If a Plugin skill shares a name with a Core skill, the Plugin skill wins.
3. **User (Individual tier)**: Residing in `memory/users/{user-id}/preferences/skills/`. Personal overrides that shadow Plugin and Core skills.

Resolution happens at session initialisation. The resolved skill roster is immutable for the session's lifetime.

---

## 6. Agent Lifecycle State Machine

The agent execution loop moves through 5 discrete states. This applies to both orchestrators and worker sub-agents.

- **State 1: Generalist** — System boots. No plugin specified. Load base generalist `SOUL.md` and Core skills.
- **State 2: Plugin Detection** — Scan for an active plugin. Parse `manifest.json`.
- **State 3: Specialist Transformation** — Swap generalist prompt for plugin's `SOUL.md`. Override name and role. Register plugin skills.
- **State 4: User Context Loading** — Incoming request attaches a `userId`. Set working memory boundary to `memory/users/{userId}/`. Load active session history.
- **State 5: Sub-Agent Dispatch (Optional)** — If the orchestrator detects complexity or parallelism opportunity, pause primary session, delegate to workers, await JSON results, synthesise and resume.

---

## 7. UK Payroll App Agent (Standalone — UI Assistance)

This agent is independent of the email pipeline. It assists users in navigating the UK Payroll App in real time.

- **Plugin**: `uk-payroll-app-agent`
- **Knowledge Sources**:
  - RAG / vector store over `memory/shared/long-term/` — indexed app docs, HMRC guides, error catalogue, release notes
  - MCP server — live screen context, active record data, user permissions
- **Sub-Agent Pattern**: The orchestrator spawns two parallel workers:
  1. `screen-context-reader` — queries MCP for the current screen state
  2. `knowledge-retriever` — performs semantic search over the RAG store
  Both results are fed to `answer-composer` which produces a user-facing step-by-step guide.
- **Per-User Memory**: Each user's Q&A history is saved to `memory/users/{userId}/long-term/`, making future answers more relevant.
