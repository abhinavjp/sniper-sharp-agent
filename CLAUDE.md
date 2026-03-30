# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A generic, plugin-driven agent framework. The base agent has no hardcoded name or purpose — plugins transform it into specialists. The same base agent is reused for orchestrators and worker sub-agents alike; a plugin is always what gives an agent its identity.

**Planned plugins**: `email-classifier` (email triage orchestrator), `uk-payroll-processor` (UK Payroll API worker), `uk-payroll-app-agent` (app navigation assistant), `sniper-sharp-agent` (software architect).

**Current status:** Phases 1–6, UI-1, and UI-2 complete. FastAPI + LangGraph backend (`backend/`, 58 tests). React frontend (`ui/`) has working chat, full provider CRUD, full agent CRUD with skill attach/detach, sidebar nav, and health badge. **Next backend: Phase 7 — Memory System. Next frontend: Phase UI-3 — SkillsView + RoutingRulesView.** See `docs/ROADMAP.md` for full status.

## Design Principles

- Agent identity (name, role, soul) always comes from a plugin — **never hardcoded** in framework files
- Each user has isolated memory at `memory/users/{userId}/`; shared rules and skills are separate
- Sub-agent orchestration is first-class: parallel and sequential task dispatch via an Orchestrator/Worker pattern
- Progressive skill disclosure: YAML frontmatter-driven markdown skills, loaded on demand
- Skill scope hierarchy (higher tiers shadow lower): **Core → Plugin → User**

## Active Frontend (React — ui/)

The `ui/` directory is the React frontend. Stack: **React 19 + Vite + TypeScript + Tailwind CSS 4**.

```
ui/
  index.html
  src/
    main.tsx             # React entry point
    App.tsx              # Currently: a single provider-config form (182 lines)
    index.css            # Tailwind base + body styles
    App.css              # Component styles
    assets/              # Static images
```

**UI completion status (vs 27 backend endpoints):**

| Area | Backend endpoints | UI status |
|---|---|---|
| Providers | 5 (CRUD) | ✅ List + create + edit inline + delete (`ProvidersView`) |
| **Chat** | 1 (`POST /api/chat`) | ✅ Full chat UI (`ChatView`) |
| Sessions | 2 (create / delete) | ✅ New Session button in ChatView |
| System / health | 3 (health, status, rebuild) | 🟡 Health dot in sidebar; full view is Phase UI-4 |
| Agents | 7 (CRUD + skill attach/detach) | ✅ Full CRUD + skill panel + supervisor badge (`AgentsView`) |
| Skills | 5 (CRUD) | ⬜ Stub — Phase UI-3 |
| Routing Rules | 5 (CRUD) | ⬜ Stub — Phase UI-3 |

**What exists:** `ui/src/api/client.ts` covers all 27 endpoints. `Sidebar` + `Layout` with react-router-dom v7. `ChatView` (full), `ProvidersView` (full CRUD), `AgentsView` (full CRUD + skill attach/detach), two stubs.

**Plans:** UI-1 plan complete. UI-2 plan: `docs/superpowers/plans/2026-03-30-phase-ui2-agents-view.md` (complete). UI-3/4 plans to be written.

## Active Backend (Python — primary runtime)

The `backend/` directory is the live implementation. TypeScript `src/` remains as a design reference only.

```
backend/
  main.py                  # FastAPI app + lifespan (calls graph_registry.rebuild on startup)
  config.py                # Env vars: DB_PATH, PORT, HOOK_TIMEOUT_SECONDS
  seed.py                  # Idempotent DB seeder — EmailClassifier + PayrollWorker + skills + routing rules

  db/
    models.py              # SQLAlchemy ORM: Provider, Agent, Skill, AgentSkill, RoutingRule, Session, Memory
    database.py            # engine, SessionLocal, init_db(), get_db() (FastAPI dependency)
    migrations/            # Alembic migrations

  providers/
    factory.py             # provider_factory(provider) — dispatches to one of 6 LangChain LLM creators
    anthropic_api_key.py   # ChatAnthropic with API key
    anthropic_setup_auth.py# ChatAnthropic via Claude CLI OAuth token
    openai_api_key.py      # ChatOpenAI with API key
    openai_codex_oauth.py  # ChatOpenAI via Codex OAuth
    google_api_key.py      # ChatGoogleGenerativeAI with API key
    custom_url.py          # ChatOpenAI-compatible custom base URL

  graph/
    state.py               # SupervisorState TypedDict (messages, user_id, session_id, intent, response)
    prompt.py              # build_system_prompt(agent) — persona + rules; Phase 7/9 hooks ready
    classifier.py          # build_classifier_node() — async node; LLM intent → routing_rules label
    specialist.py          # build_specialist_subgraph() — create_react_agent with tools + system prompt
    supervisor.py          # build_supervisor_graph() — StateGraph: classifier → conditional → specialist → END
    registry.py            # GraphRegistry singleton; rebuild() called on startup + every config mutation

  skills/
    registry.py            # build_tools_for_agent() — sandboxed exec() runner → LangChain Tool objects

  api/
    system.py              # GET /api/health, GET /api/graph/status, POST /api/graph/rebuild
    providers.py           # CRUD /api/providers
    agents.py              # CRUD /api/agents + skill attach/detach
    skills.py              # CRUD /api/skills
    routing_rules.py       # CRUD /api/routing-rules
    sessions.py            # POST/DELETE /api/sessions
    chat.py                # POST /api/chat — runs LangGraph graph, persists history

  tests/                   # 58 tests, all passing (pytest + FastAPI TestClient, shared in-memory SQLite)
```

## Planned TypeScript Directory Structure (design reference only)

```
plugins/
  {plugin-id}/
    manifest.json       # id, name, version, role, entrypoint, skillsDir
    SOUL.md             # Agent persona, identity, behavioural constraints
    skills/
      {skill-name}/
        SKILL.md        # YAML frontmatter: name, description, allowed-tools

memory/
  shared/
    long-term/          # RAG/embeddings available to all users
    rules/              # System-wide operational rules
  users/
    {user-id}/
      session/          # Ephemeral context for current conversation
      long-term/        # Per-user persistent RAG/embeddings
      preferences/
        skills/         # User-level skill overrides

.agents/
  subagents/
    {agent-name}.yaml   # Declarative worker prompt definitions and permissions
```

## Agent Lifecycle

5 discrete states:
1. **Generalist** — Load base `SOUL.md` and Core skills
2. **Plugin Detection** — Scan `plugins/`, parse `manifest.json`
3. **Specialist Transformation** — Swap persona, register plugin skills
4. **User Context Loading** — Bind working memory to `memory/users/{userId}/`
5. **Sub-Agent Dispatch** (optional) — Decompose complex tasks; fire parallel or sequential workers

## Sub-Agent Orchestration Pattern

- **Workers are also base agents with a plugin attached** — the orchestrator spawns a fresh base agent, attaches the designated plugin, binds the userId context, and injects the task as structured JSON
- Workers run in **isolated context windows** and must return strict structured output (JSON, no conversational filler)
- Parallel dispatch: tasks with no dependency graph sharing no shared state
- Sequential chaining: Task B injects Task A's output into its isolated prompt
- Worker definitions live in `.agents/subagents/{agent-name}.yaml` and include a `plugin` field

## Key Documentation

| File | Purpose |
|------|---------|
| `docs/ROADMAP.md` | Phase-by-phase task status — **start here** |
| `docs/CONVENTIONS.md` | **Authoritative implementation rules** — naming, schemas, forbidden patterns |
| `docs/superpowers/specs/2026-03-27-langgraph-backend-design.md` | Full Python backend design spec (Phases 5–10) |
| `docs/superpowers/plans/2026-03-27-phase5-python-backend-foundation.md` | Phase 5 plan (complete) |
| `docs/superpowers/plans/2026-03-27-phase6-langgraph-runtime.md` | Phase 6 plan (complete) |
| `docs/PROPOSED_ARCHITECTURE.md` | Detailed design intent (plugins, skills, memory, sub-agents) |
| `docs/PROPOSED_ARCHITECTURE_DIAGRAM.md` | Mermaid diagrams of plugin lifecycle and multi-user flow |
| `docs/SYSTEM_OVERVIEW_DIAGRAM.md` | Full visual map — all agents, plugins, skills, sub-agents, memory |
| `docs/OPENCLAW_STUDY.md` | Reference study: Gateway/Agent decoupling, SOUL.md pattern |
| `docs/SUBAGENT_ORCHESTRATION_STUDY.md` | Sub-agent patterns and output contracts |
| `docs/PLUGIN_SYSTEM_STUDY.md` | Plugin skill scope and identity transformation details |

## Reference Material

`references/openclaw/` — Full OpenClaw source (git-ignored, read-only). OpenClaw is a single-user personal AI assistant; this framework extends its patterns to multi-user contexts.

## Conventions

Full rules in `docs/CONVENTIONS.md` — that file is authoritative. Summary of hard constraints:

- **UK English** throughout all documentation and code
- All documentation lives in `docs/`; diagrams are Mermaid, embedded in their `.md` files
- `references/` is git-ignored — never commit reference material
- **No agent names hardcoded** anywhere in framework files (`src/core/`, `CLAUDE.md`, `GEMINI.md`)
- **Backend language**: Python 3.10+ — FastAPI, SQLAlchemy 2.0, LangGraph, LangChain (`backend/`)
- **TypeScript scaffold**: `src/` (Node.js 20+, ESM, `tsx`) — design reference only; not the active runtime
- **Naming**: plugin IDs in `kebab-case`; display names in `PascalCase`; spec files in `SCREAMING_SNAKE.md`
- **Schemas must be defined before loaders** — never write a parser without a documented schema first
- **Implementation order**: Study → Scaffold → Schema → Core → Plugin → User — never skip steps
- **Sub-agents return JSON only** — no prose, no markdown, no preamble, ever
- **Memory always scoped to `memory/users/{userId}/`** — never construct this path without a bound userId
- **YAML reserved for declarative agent definitions only** — JSON for all runtime config

### Forbidden Patterns (hard blockers — raise immediately if encountered)

| Pattern | Why |
|---|---|
| Plugin name hardcoded in `src/core/` or framework markdown | Breaks plugin-agnostic principle |
| Reading `memory/users/` without a bound `userId` | Cross-user data leakage risk |
| Worker sub-agent returning prose | Breaks orchestrator synthesis |
| Worker sub-agent making architectural decisions | Workers execute; orchestrators decide |
| Spawning a worker without attaching a plugin | Workers have no identity without a plugin — same rule as orchestrators |
| Skipping progressive disclosure (dumping all skills at boot) | Inflates context window |
| Committing anything under `references/` | Read-only study material |
