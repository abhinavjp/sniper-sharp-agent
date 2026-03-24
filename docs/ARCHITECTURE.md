# Architecture — Living Document

This document describes the current implemented state of the framework.
It is updated at the end of each phase. For design intent, see `PROPOSED_ARCHITECTURE.md`.
For diagrams, see `PROPOSED_ARCHITECTURE_DIAGRAM.md` and `SYSTEM_OVERVIEW_DIAGRAM.md`.

**Last updated**: Phase 3 — Project Scaffold
**Status**: Scaffold complete. No runtime logic implemented yet. Phases 4–10 implement each layer.

---

## Current Directory Structure

```
.
├── AGENTS.md                          # Base framework operating rules (all agents)
├── CLAUDE.md                          # Claude Code project instructions
├── GEMINI.md                          # Gemini project instructions
├── HEARTBEAT.md                       # Heartbeat/scheduling config schema (placeholder)
├── SOUL.md                            # Base generalist soul (overridden by plugins)
├── package.json                       # Node.js project (ESM, TypeScript)
├── tsconfig.json                      # TypeScript compiler config (strict, NodeNext)
│
├── .agents/
│   ├── skills/                        # Core (framework-level) skills
│   │   ├── read-file/SKILL.md         # Read filesystem files
│   │   ├── http-call/SKILL.md         # Outbound HTTP requests
│   │   └── bash-exec/SKILL.md         # Shell command execution (restricted)
│   └── subagents/                     # Worker sub-agent definitions (Phase 4)
│       └── .gitkeep
│
├── docs/
│   ├── ARCHITECTURE.md                # This file — living implementation state
│   ├── CONVENTIONS.md                 # Authoritative naming, schemas, forbidden patterns
│   ├── MEMORY_AND_LOOP_DEEP_DIVE.md   # Memory lifecycle and agent loop analysis
│   ├── OPENCLAW_ARCHITECTURE_DIAGRAM.md
│   ├── OPENCLAW_STUDY.md
│   ├── PLUGIN_SYSTEM_STUDY.md
│   ├── PROPOSED_ARCHITECTURE.md       # Full design intent document
│   ├── PROPOSED_ARCHITECTURE_DIAGRAM.md
│   ├── ROADMAP.md                     # Phase-by-phase task tracker
│   ├── SUBAGENT_ORCHESTRATION_STUDY.md
│   └── SYSTEM_OVERVIEW_DIAGRAM.md
│
├── memory/
│   ├── shared/
│   │   ├── long-term/                 # RAG/embeddings — all users (read-only for agents)
│   │   └── rules/                     # System-wide operational rules
│   └── users/                         # Per-user directories created on first contact
│       └── .gitkeep                   # (example: memory/users/user-abc123/session/)
│
├── plugins/
│   ├── email-classifier/              # Orchestrator — email triage
│   │   ├── manifest.json
│   │   ├── SOUL.md
│   │   ├── README.md
│   │   └── skills/
│   │       ├── classify-email/SKILL.md
│   │       └── parse-attachment/SKILL.md
│   │
│   ├── uk-payroll-processor/          # Worker — UK Payroll API calls
│   │   ├── manifest.json
│   │   ├── SOUL.md
│   │   ├── README.md
│   │   └── skills/
│   │       ├── process-starter/SKILL.md      # POST /api/starters
│   │       ├── import-timesheet/SKILL.md     # POST /api/timesheets/import
│   │       └── create-task/SKILL.md          # POST /api/tasks
│   │
│   ├── uk-payroll-app-agent/          # Standalone — app navigation assistant
│   │   ├── manifest.json
│   │   ├── SOUL.md
│   │   ├── README.md
│   │   └── skills/
│   │       ├── rag-search/SKILL.md           # Semantic search over docs
│   │       ├── mcp-query/SKILL.md            # Live screen context via MCP
│   │       └── lookup-error-code/SKILL.md    # Error catalogue lookup
│   │
│   └── sniper-sharp-agent/            # Standalone — software architect
│       ├── manifest.json
│       ├── SOUL.md
│       ├── README.md
│       └── skills/
│           └── code-analysis/SKILL.md        # TypeScript code analysis
│
└── src/
    ├── core/
    │   ├── plugin-loader.ts           # Scans plugins/, validates manifest, builds skill roster
    │   └── skill-loader.ts            # Parses SKILL.md frontmatter, on-demand full load, roster merge
    └── types/
        └── plugin.ts                  # All TypeScript interfaces: PluginManifest, SkillFrontmatter, etc.
```

---

## What Is Implemented (Phase 3)

### TypeScript Types (`src/types/plugin.ts`)
Full set of interfaces covering:
- `PluginManifest` — validated against `manifest.json`
- `SkillFrontmatter` — parsed from `SKILL.md` YAML frontmatter
- `SkillSummary` — progressive disclosure entry (name + description only)
- `ResolvedSkill` — full skill after on-demand load
- `ResolvedPlugin` — manifest + soul + skill roster
- `SubAgentDefinition` — worker definition including `plugin` field and `output_contract`
- `AgentRequestContext` — per-request context including bound `userId`

### Plugin Loader (`src/core/plugin-loader.ts`)
- `validateManifest(data, sourcePath)` — validates against schema, rejects missing/malformed fields
- `loadPlugin(pluginDir)` — loads a single plugin: manifest → SOUL.md → skill roster
- `loadAllPlugins(pluginsRoot)` — scans `plugins/` directory, loads all valid plugins
- `loadCoreSkills(agentsSkillsDir)` — loads `.agents/skills/` core skill roster

### Skill Loader (`src/core/skill-loader.ts`)
- `parseSkillFrontmatter(content, sourcePath)` — parses YAML frontmatter from SKILL.md
- `loadSkillFull(summary)` — on-demand full skill load (Phase 4 will call this)
- `mergeSkillRosters(...rosters)` — merges Core + Plugin + User rosters with scope precedence (`User > Plugin > Core`)

### Plugin Scaffolds
All 4 plugins scaffolded with `manifest.json`, `SOUL.md`, `README.md`, and full `skills/` directories.
SOUL.md files contain the complete persona for each plugin — ready for Phase 6–9 implementation.

### Memory Structure
Directory tree created. Per-user directories (`memory/users/{userId}/`) are created at runtime on first contact.

### Core Skills
3 core SKILL.md files defined with full input/output contracts:
- `read-file`, `http-call`, `bash-exec`

---

## What Is Not Yet Implemented

| Component | Phase |
|---|---|
| Sub-agent definition YAML files | Phase 4 |
| Orchestrator routing logic | Phase 4 |
| Runtime agent loop (request → classify → spawn → synthesise) | Phase 4 |
| Per-user memory creation and routing | Phase 5 |
| Session memory compaction | Phase 5 |
| Email classifier skill implementations | Phase 6 |
| UK Payroll API calls (all 3 skills) | Phase 7 |
| RAG store indexing and MCP server | Phase 8 |
| SniperSharpAgent skill implementations | Phase 9 |
| Integration tests | Phase 10 |

---

## Key Design Decisions (Rationale)

### Plugin loader parses YAML frontmatter manually
Rather than adding a heavy YAML dependency at the core loader level, the frontmatter parser
handles the precise subset of YAML used in `SKILL.md` files. This keeps the core layer lean.
Full YAML parsing (via `js-yaml`) is available when plugin-level code needs it.

### Skill roster is built at boot (names only), loaded on demand
Following OpenClaw's progressive disclosure pattern. At boot, only `name` and `description`
are loaded for every skill. The full `SKILL.md` (schema, body, allowed-tools) is loaded
only when the orchestrator decides to invoke that skill. Keeps the context window lean.

### Workers are base agents + plugin — no separate worker type
There is no `WorkerAgent` class. A worker is a fresh base agent with a plugin attached.
The `plugin` field in `.agents/subagents/{name}.yaml` is mandatory — without it, the worker
has no identity and cannot be spawned. This is enforced at definition parse time.

### `userId` always comes from request context — never from agent reasoning
The `AgentRequestContext.userId` field is populated by the Gateway/Router from the authenticated
request. No agent code constructs or infers a userId. This prevents cross-user memory leakage.
