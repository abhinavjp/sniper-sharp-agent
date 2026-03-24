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
- [ ] Create plugin manifest schema and loader
- [ ] Create GEMINI.md template (already done in Phase 1, refine here)
- [ ] Create base SOUL.md template (generalist defaults, plugin-overridable)
- [ ] Create AGENTS.md (base operating rules)
- [ ] Create HEARTBEAT.md (proactive scheduling config)
- [ ] Scaffold .agents/skills/ directory with core skills
- [ ] Scaffold plugins/ directory with plugin spec and example structure
- [ ] Scaffold memory/ directory with shared and per-user structure
- [ ] Scaffold .agents/subagents/ directory with orchestrator and worker definitions
- [ ] Produce: docs/ARCHITECTURE.md (living architecture doc)

## Phase 4 — Sub-Agent Orchestration Implementation
- [ ] Implement orchestrator agent definition
- [ ] Implement parallel dispatch rules (routing logic in CLAUDE.md/GEMINI.md)
- [ ] Implement sequential chaining pattern
- [ ] Implement output contract enforcement for worker sub-agents
- [ ] Implement result synthesis pattern
- [ ] Test with a multi-domain parallel task
- [ ] Produce: docs/SUBAGENT_IMPLEMENTATION.md

## Phase 5 — Multi-User Memory Implementation
- [ ] Implement per-user memory directory creation on first contact
- [ ] Implement user identification and memory routing
- [ ] Implement session memory (ephemeral, per-conversation)
- [ ] Implement long-term memory (persistent, per-user)
- [ ] Implement shared memory (agent-wide, non-user-specific)
- [ ] Implement memory compaction and pruning
- [ ] Produce: docs/MEMORY_IMPLEMENTATION.md

## Phase 6 — SniperSharpAgent Plugin
- [ ] Define SniperSharpAgent purpose and scope
- [ ] Create plugins/sniper-sharp-agent/ directory
- [ ] Write plugin manifest
- [ ] Write SOUL.md for SniperSharpAgent
- [ ] Define and implement plugin-specific skills
- [ ] Test plugin attachment and identity transformation
- [ ] Produce: plugins/sniper-sharp-agent/README.md
