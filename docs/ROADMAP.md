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

## Phase 6 — Email Classifier Plugin
- [ ] Create plugins/email-classifier/ directory
- [ ] Write plugin manifest (id: email-classifier, name: EmailClassifier)
- [ ] Write SOUL.md for EmailClassifier
- [ ] Define and implement skill: classify-email
- [ ] Define and implement skill: parse-attachment (CSV, XLSX, PDF)
- [ ] Define sub-agent definition for orchestrator role
- [ ] Test plugin attachment and identity transformation
- [ ] Produce: plugins/email-classifier/README.md

## Phase 7 — UK Payroll Processor Plugin (Worker Sub-Agent)
- [ ] Create plugins/uk-payroll-processor/ directory
- [ ] Write plugin manifest (id: uk-payroll-processor, name: UkPayrollProcessor)
- [ ] Write SOUL.md for UkPayrollProcessor (worker persona — JSON only, no prose)
- [ ] Define and implement skill: process-starter (POST /api/starters)
- [ ] Define and implement skill: import-timesheet (POST /api/timesheets/import)
- [ ] Define and implement skill: create-task (POST /api/tasks)
- [ ] Define sub-agent definition for worker role (output_contract required)
- [ ] Test end-to-end email → classify → spawn worker → API call → JSON result
- [ ] Produce: plugins/uk-payroll-processor/README.md

## Phase 8 — UK Payroll App Agent Plugin
- [ ] Create plugins/uk-payroll-app-agent/ directory
- [ ] Write plugin manifest (id: uk-payroll-app-agent, name: UkPayrollAppAgent)
- [ ] Write SOUL.md for UkPayrollAppAgent
- [ ] Define and implement skill: rag-search (semantic search over knowledge base)
- [ ] Define and implement skill: mcp-query (live screen/record context via MCP)
- [ ] Define and implement skill: lookup-error-code (error catalogue search)
- [ ] Define sub-agent definitions: screen-context-reader, knowledge-retriever, answer-composer
- [ ] Index app documentation into memory/shared/long-term/ RAG store
- [ ] Configure and connect MCP server for live app context
- [ ] Test end-to-end: user question → parallel sub-agents → composed answer
- [ ] Test per-user memory: repeated questions improve over time
- [ ] Produce: plugins/uk-payroll-app-agent/README.md

## Phase 9 — SniperSharpAgent Plugin
- [ ] Create plugins/sniper-sharp-agent/ directory
- [ ] Write plugin manifest (id: sniper-sharp-agent, name: SniperSharpAgent)
- [ ] Write SOUL.md for SniperSharpAgent
- [ ] Define and implement plugin-specific skills (code-analysis, etc.)
- [ ] Test plugin attachment and identity transformation
- [ ] Produce: plugins/sniper-sharp-agent/README.md

## Phase 10 — Integration and End-to-End Testing
- [ ] Integration test: email classification pipeline (all three branches)
- [ ] Integration test: multi-user isolation (concurrent requests, no cross-user leakage)
- [ ] Integration test: UK Payroll App Agent (RAG + MCP + per-user memory)
- [ ] Load test: concurrent users, parallel sub-agent dispatch
- [ ] Produce: docs/TESTING.md
