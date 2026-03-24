# [Framework Name TBD] — Agent Context

## What This Project Is
A generic, plugin-driven agent framework. The base agent has no hardcoded name or purpose.
Plugins transform it into specialists. The first planned plugin is SniperSharpAgent.

## Design Principles
- Agent identity (name, role, soul) always comes from a plugin — never hardcoded
- Multi-user: each user has isolated memory; rules and skills are shared
- Sub-agent orchestration is a first-class capability: parallel and sequential task dispatch
- Progressive skill disclosure: only load what is needed, when it is needed
- Plugin-first: the framework is generic; plugins are what make it useful

## Current Phase
Phase 1 complete. See `docs/ROADMAP.md` for full status.

## Key Architecture Decisions
- **Plugin Delivery**: Plugins must provide a `manifest.json`, a `SOUL.md` persona document, and a directory of YAML frontmatter-driven markdown skills.
- **Strict User Environment Segregation**: `memory/users/{userId}/` ensures agents never mix session data across requests.
- **Sub-Agent Lifecycle**: Orchestrators decompose tasks and delegate to parallel workers in completely clean context windows with rigidly enforced structured output contracts. Prompt definitions for specialists live in `.agents/subagents/`.
- **Runtime Overrides**: Core tools can be shadowed by Plugin tools, which can be shadowed by User tools.

## Conventions

Full rules in `docs/CONVENTIONS.md` — that file is authoritative. Summary of hard constraints:

- **UK English** throughout all documentation and code
- All documentation in `docs/`; diagrams are Mermaid, embedded in their `.md` files
- `references/` is git-ignored — never commit, never write to it
- **No agent names hardcoded** anywhere in framework files (`src/core/`, `CLAUDE.md`, `GEMINI.md`)
- **Language**: TypeScript (Node.js 20+), ESM only, `tsx` for script execution
- **Naming**: plugin IDs in `kebab-case`; display names in `PascalCase`; spec files in `SCREAMING_SNAKE.md`
- **Schemas must be defined before loaders** — never write a parser without a documented schema first
- **Implementation order**: Study → Scaffold → Schema → Core → Plugin → User — never skip steps
- **Sub-agents return JSON only** — no prose, no markdown, no preamble, ever
- **Memory always scoped to `memory/users/{userId}/`** — never construct this path without a bound userId
- **YAML reserved for declarative agent definitions only** — JSON for all runtime config

### Forbidden Patterns

| Pattern | Why |
|---|---|
| Plugin name hardcoded in `src/core/` or framework markdown | Breaks plugin-agnostic principle |
| Reading `memory/users/` without a bound `userId` | Cross-user data leakage risk |
| Worker sub-agent returning prose | Breaks orchestrator synthesis |
| Worker sub-agent making architectural decisions | Workers execute; orchestrators decide |
| Skipping progressive disclosure (dumping all skills at boot) | Inflates context window |
| Committing anything under `references/` | Read-only study material |

## Key Files
- `docs/ROADMAP.md` — current task status
- `docs/CONVENTIONS.md` — **authoritative implementation rules**
- `docs/PROPOSED_ARCHITECTURE.md` — design intent
- `docs/OPENCLAW_STUDY.md` — reference study
- `docs/SUBAGENT_ORCHESTRATION_STUDY.md` — sub-agent patterns
- `plugins/` — plugin packages (created in Phase 3)
- `memory/` — per-user and shared memory (created in Phase 5)

## Reference Material
- `references/openclaw/` — OpenClaw source (git-ignored, read-only)
