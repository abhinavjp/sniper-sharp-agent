# UkPayrollAppAgent Plugin

**Plugin ID**: `uk-payroll-app-agent`
**Version**: `0.1.0`
**Role**: Standalone UI assistance agent

## Overview

UkPayrollAppAgent helps users navigate and understand the UK Payroll App in real time.
It combines RAG-indexed documentation with live MCP screen context to provide accurate, contextual guidance.

## Skills

| Skill | Purpose |
|---|---|
| `rag-search` | Semantic search over `memory/shared/long-term/` documentation |
| `mcp-query` | Live screen context and active record data from the MCP server |
| `lookup-error-code` | Fast lookup of error codes in the indexed error catalogue |

## Sub-Agent Orchestration

For each user question, the orchestrator spawns workers in parallel:

| Worker | Plugin | Purpose |
|---|---|---|
| `screen-context-reader` | `uk-payroll-app-agent` | Reads current screen via MCP |
| `knowledge-retriever` | `uk-payroll-app-agent` | RAG search over docs |
| `answer-composer` | `uk-payroll-app-agent` | Synthesises results into user-facing response |

## Per-User Memory

Each user's interaction history is summarised and saved to `memory/users/{userId}/long-term/`.
This improves answer relevance over time without leaking data between users.

## Implementation Status

- [ ] RAG store indexed with app documentation (Phase 8)
- [ ] MCP server connected and live context working (Phase 8)
- [ ] Skills implemented (Phase 8)
- [ ] Sub-agent definitions written (Phase 8)
- [ ] Per-user memory summarisation working (Phase 8)
- [ ] End-to-end test passing (Phase 8)
