# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A generic, plugin-driven agent framework. The base agent has no hardcoded name or purpose — plugins transform it into specialists. The same base agent is reused for orchestrators and worker sub-agents alike; a plugin is always what gives an agent its identity.

**Planned plugins**: `email-classifier` (email triage orchestrator), `uk-payroll-processor` (UK Payroll API worker), `uk-payroll-app-agent` (app navigation assistant), `sniper-sharp-agent` (software architect).

This project is in early planning/architecture phase. See `docs/ROADMAP.md` for current status.

## Design Principles

- Agent identity (name, role, soul) always comes from a plugin — **never hardcoded** in framework files
- Each user has isolated memory at `memory/users/{userId}/`; shared rules and skills are separate
- Sub-agent orchestration is first-class: parallel and sequential task dispatch via an Orchestrator/Worker pattern
- Progressive skill disclosure: YAML frontmatter-driven markdown skills, loaded on demand
- Skill scope hierarchy (higher tiers shadow lower): **Core → Plugin → User**

## Planned Directory Structure

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
| `docs/ROADMAP.md` | Phase-by-phase task status |
| `docs/CONVENTIONS.md` | **Authoritative implementation rules** — naming, schemas, forbidden patterns |
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
- **Language**: TypeScript (Node.js 20+), ESM only, `tsx` for script execution
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
