# UkPayrollProcessor Plugin

**Plugin ID**: `uk-payroll-processor`
**Version**: `0.1.0`
**Role**: Worker sub-agent — UK Payroll API execution

## Overview

UkPayrollProcessor is a worker sub-agent plugin. It is always spawned by the EmailClassifier orchestrator.
It receives a structured JSON task, invokes the appropriate skill, calls the UK Payroll API, and returns a strict JSON result.

## Skills

| Skill | API Endpoint | Triggered by |
|---|---|---|
| `process-starter` | `POST /api/starters` | `type: STARTER` |
| `import-timesheet` | `POST /api/timesheets/import` | `type: TIMESHEET` |
| `create-task` | `POST /api/tasks` | `type: TASK` |

## Output Contract

All outputs follow this envelope — no exceptions:

```json
{ "status": "success | error", "result": { ... } }
```

## Sub-Agent Definition

`.agents/subagents/uk-payroll-processor-worker.yaml`

## Implementation Status

- [ ] Skills implemented (Phase 7)
- [ ] SOUL.md finalised
- [ ] Sub-agent definition with output_contract written
- [ ] End-to-end test passing (email → classify → spawn → API → JSON result)
