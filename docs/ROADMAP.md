# Project Roadmap

## Phase 0 — Environment Setup
- [x] Initialise Git repository
- [x] Clone OpenClaw reference into references/openclaw/
- [x] Configure .gitignore to exclude references/openclaw/
- [x] Verify clean working tree

## Phase 1 — Study and Architecture Foundation
- [x] OpenClaw deep study (OPENCLAW_STUDY.md)
- [x] OpenClaw architecture diagram (OPENCLAW_ARCHITECTURE_DIAGRAM.md)
- [x] Sub-agent orchestration study (SUBAGENT_ORCHESTRATION_STUDY.md)
- [x] Plugin system study (PLUGIN_SYSTEM_STUDY.md)
- [x] Proposed architecture document (PROPOSED_ARCHITECTURE.md)
- [x] Proposed architecture diagrams (PROPOSED_ARCHITECTURE_DIAGRAM.md)
- [x] System overview diagram (SYSTEM_OVERVIEW_DIAGRAM.md)
- [x] Roadmap initialised (this file)
- [x] GEMINI.md created
- [x] Implementation conventions established (docs/CONVENTIONS.md, CLAUDE.md, GEMINI.md updated)

## Phase 2 — Deep Dive: Memory, Heartbeat, and Agent Loop
- [x] Memory lifecycle analysis — session pruning, compaction, write-ahead log patterns
- [x] Heartbeat internals — daemon scheduling, cron expressions, wakeup triggers
- [x] Agent loop anatomy — message arrival, routing, tool dispatch, response assembly
- [x] Context compression strategies — how to handle long-running sessions without quality loss
- [x] Produce: docs/MEMORY_AND_LOOP_DEEP_DIVE.md

## Phase 3 — Project Scaffold
- [x] Create plugin manifest schema and loader
- [x] Create base SOUL.md template (generalist defaults, plugin-overridable)
- [x] Create AGENTS.md (base operating rules)
- [x] Create HEARTBEAT.md (proactive scheduling config)
- [x] Scaffold .agents/skills/ directory with core skills (read-file, http-call, bash-exec)
- [x] Scaffold plugins/ directory with all 4 plugins (email-classifier, uk-payroll-processor, uk-payroll-app-agent, sniper-sharp-agent)
- [x] Scaffold memory/ directory with shared and per-user structure
- [x] Scaffold .agents/subagents/ directory (placeholder — populated in Phase 4)
- [x] Produce: docs/ARCHITECTURE.md (living architecture doc)

## Phase 4 — Sub-Agent Orchestration + AI Provider Abstraction
- [x] Abstract AI provider interface (src/types/ai-provider.ts) — supports 5 provider types
- [x] Implement AnthropicSetupAuthProvider using @anthropic-ai/sdk + Claude CLI OAuth token
- [x] Stub providers: anthropic-api-key, openai-api-key, openai-codex-oauth, ollama
- [x] Provider factory (src/providers/index.ts)
- [x] Tool executor (src/core/tool-executor.ts) — leaf tools + progressive-disclosure plugin skills
- [x] Agent loop (src/core/agent-loop.ts) — multi-turn Messages API loop with tool use
- [x] Orchestrator (src/core/orchestrator.ts) — parallel + sequential sub-agent dispatch
- [x] Sub-agent definition: .agents/subagents/uk-payroll-processor-worker.yaml
- [x] Entry point (src/index.ts) — interactive REPL + single-message mode
- [x] Build verified: npm install && tsc --noEmit passes cleanly
- [ ] Produce: docs/SUBAGENT_IMPLEMENTATION.md

---
> **Architecture pivot (2026-03-27):** Phases 5–10 below replace the previously planned
> TypeScript-only phases. The Python `backend/` is now the primary runtime. The TypeScript
> `src/` scaffold remains as a design reference. See
> `docs/superpowers/specs/2026-03-27-langgraph-backend-design.md` for the full design.

---

## Phase 5 — Python Backend Foundation ✅

- [x] Define SQLAlchemy ORM models: Provider, Agent, Skill, AgentSkill, RoutingRule, Session, Memory
- [x] Configure Alembic; generate and apply initial migration
- [x] Implement `config.py` — env vars, DB path, port, hook timeout
- [x] Implement `db/database.py` — engine, session factory, dependency injection
- [x] Implement provider factory (`providers/factory.py`) for all 6 provider types:
  - `anthropic-api-key`, `anthropic-setup-auth`, `openai-api-key`, `openai-codex-oauth`, `google-api-key`, `custom-url`
- [x] Implement all CRUD API routes: providers, agents, skills, routing_rules, sessions
- [x] Implement `GET /api/health`, `GET /api/graph/status`, `POST /api/graph/rebuild`
- [x] Seed DB with initial agents (EmailClassifier supervisor + PayrollWorker specialist)
- [x] Verify: all CRUD routes work, provider factory returns correct LangChain LLM instances
- [x] **58 tests passing** — see `backend/tests/`

## Phase 6 — LangGraph Graph Implementation ✅

- [x] Implement `graph/state.py` — `SupervisorState` TypedDict with `add_messages` annotation
- [x] Implement `graph/classifier.py` — LLM call node; returns `intent` from routing_rules labels
- [x] Implement `graph/specialist.py` — `build_specialist_subgraph()` using `create_react_agent`
- [x] Implement `graph/supervisor.py` — `build_supervisor_graph()` from DB config; conditional edges from routing_rules
- [x] Implement `graph/registry.py` — `GraphRegistry` with `get()` and `rebuild()`; `rebuild()` triggered on every config mutation and at startup
- [x] Implement `skills/registry.py` — `build_tools_for_agent()` with sandboxed `exec()` skill runner
- [x] Wire `POST /api/chat` to run the compiled graph; persist history to sessions table
- [x] **58 tests passing** — graph state, skills registry, and chat API fully covered

---
> **Frontend track** — Phases UI-1 to UI-4 below run in parallel with the backend phases.
> The `ui/` directory has a React 19 + Vite + TypeScript + Tailwind scaffold. The visual design
> language (dark glassmorphism, indigo/blue palette) is established in `App.tsx` and must be
> kept consistent. **Start here for frontend work.**

## Phase UI-1 — Foundation, API Client + Chat

*Prerequisite: Phase 6 backend complete (POST /api/chat live).*

- [ ] Install `react-router-dom` in `ui/`
- [ ] Create `ui/src/api/client.ts` — typed fetch wrappers for all 27 backend endpoints
- [ ] Scaffold top-level routing: `ChatView`, `ConfigView`, `SystemView` (sidebar nav)
- [ ] Fix provider form: wire it to `POST /api/providers` (currently calls non-existent `/api/config`)
- [ ] Build `ChatView`: session selector/creator, message thread, send box, intent badge
- [ ] `POST /api/sessions` to create a session; `POST /api/chat` for messages
- [ ] Persist `session_id` in component state; display `turn_count` and `intent` from response

## Phase UI-2 — Provider + Agent Management

- [ ] `ProvidersView`: list all providers (GET /api/providers), create form, edit inline, delete
- [ ] `AgentsView`: list agents (GET /api/agents), create/edit form with provider picker, delete
- [ ] Skill attachment panel on AgentView: list attached skills, attach/detach buttons
- [ ] Supervisor badge on agent cards (visual distinction for is_supervisor=true)

## Phase UI-3 — Skills + Routing Rules

- [ ] `SkillsView`: list all skills, create/edit form with Python code textarea (implementation field), delete
- [ ] `RoutingRulesView`: list rules ordered by priority, create/edit form, delete
- [ ] Priority drag-to-reorder (optional) or numeric priority input

## Phase UI-4 — System Dashboard + Graph Controls

- [ ] `SystemView`: poll `GET /api/health` every 10 s — show `graph_compiled` indicator
- [ ] Display `GET /api/graph/status` counts (agents, skills, routing rules)
- [ ] "Rebuild Graph" button — `POST /api/graph/rebuild`
- [ ] Toast/notification on rebuild success or failure

---

## Phase 7 — Memory System

- [ ] Implement `memory/chroma.py` — ChromaDB embedded client wrapper
- [ ] Implement `memory/manager.py` — `retrieve(agent_id, user_id, query, top_k)` and `save(memory_row)`
- [ ] Implement `memory/prompt_injector.py` — builds `[Memories]` section for system prompt
- [ ] Implement core skills: `skills/core/save_memory.py`, `skills/core/read_memory.py`
- [ ] Implement `skills/registry.py` and `skills/executor.py` — compile DB skill rows into LangChain tools
- [ ] Wire memory retrieval into system prompt assembly (persona + rules + memories)
- [ ] Implement memory CRUD routes (`GET/POST/DELETE /api/memories`)
- [ ] Test: memory-enabled agent remembers facts across turns and sessions
- [ ] Produce: `docs/MEMORY_IMPLEMENTATION.md`

## Phase 8 — Agent Seeding and Email Classification Pipeline

- [ ] Seed DB: EmailClassifier supervisor with classify-email and parse-attachment skills
- [ ] Seed DB: PayrollWorker specialist with process-starter, import-timesheet, create-task skills
- [ ] Seed routing_rules: starter-processing → PayrollWorker, timesheet-import → PayrollWorker, FALLBACK → EmailClassifier
- [ ] Implement `skills/core/http_call.py` — outbound HTTP with configurable timeout and headers
- [ ] Test end-to-end: email message → classifier → PayrollWorker → API call → response
- [ ] Seed DB: UkPayrollAppAgent (memory_enabled: true) with rag-search, lookup-error-code skills
- [ ] Test: app-question → AppAgent → retrieves memory → responds with context

## Phase 9 — Config Hook (Phase 2)

- [ ] Implement `hooks/config_hook.py` — POST to hook URL with agent metadata; HMAC-SHA256 signing
- [ ] Wire hook call into system prompt assembly (between DB config and memory injection)
- [ ] Configurable timeout (env var `HOOK_TIMEOUT_SECONDS`, default 5)
- [ ] Fallback to DB config on hook failure; log warning
- [ ] Test: agent with hook_url set receives overridden persona from external service
- [ ] Produce: updated spec with hook integration test cases

## Phase 10 — Integration and End-to-End Testing

- [ ] Integration test: email classification pipeline (starter, timesheet, task branches)
- [ ] Integration test: multi-user isolation (concurrent requests, no cross-user memory leakage)
- [ ] Integration test: UkPayrollAppAgent memory accumulation across sessions
- [ ] Integration test: config hook override replaces persona correctly
- [ ] Integration test: graph hot-reload (add agent via API → next chat uses new agent)
- [ ] Load test: concurrent users, parallel specialist invocations
- [ ] Produce: `docs/TESTING.md`
