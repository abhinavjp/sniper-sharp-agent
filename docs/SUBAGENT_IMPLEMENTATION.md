# Sub-Agent Implementation

> Phase 4 deliverable — implementation reference for the sub-agent orchestration system.

## Overview

Sub-agents (workers) are the execution unit of complex, multi-step tasks. An orchestrator agent decomposes a task, spawns one or more workers in isolated context windows, and synthesises their results. Workers are always base agents with a plugin attached — they have no identity without one.

```
Orchestrator (plugin: email-classifier)
│
├── spawnParallel
│   ├── Worker A (plugin: uk-payroll-processor) → { status, result }
│   └── Worker B (plugin: uk-payroll-processor) → { status, result }
│
└── spawnSequential
    ├── Worker C (plugin: uk-payroll-processor) → { status, result }
    └── Worker D (plugin: uk-payroll-processor) ← injects Worker C result
```

Key constraints enforced by the framework:

- Workers **must** return strict JSON — no prose, no markdown, no preamble
- Workers **must** have a plugin — spawning without one throws immediately
- Workers run in **isolated context windows** — no shared state with the orchestrator
- Worker results flow through the `{ status, result }` or `{ status, error }` output contract

---

## Worker Definition Schema

Worker definitions live at `.agents/subagents/{name}.yaml`. The YAML schema is defined in `docs/CONVENTIONS.md §4.3`.

```yaml
# .agents/subagents/uk-payroll-processor-worker.yaml

name: uk-payroll-processor-worker
description: >
  Executes a single UK Payroll API task — process-starter, import-timesheet,
  or create-task. Called by the email-classifier orchestrator.

plugin: uk-payroll-processor        # Must be a valid plugin id in plugins/

system_prompt: |
  You are a UK Payroll API worker. You receive a structured JSON task and
  execute exactly one payroll operation using your available skills.
  You MUST return ONLY valid JSON matching the output contract.
  Never return prose. Never explain your reasoning outside the JSON.

allowed_tools:
  - process-starter
  - import-timesheet
  - create-task
  - http-call

output_contract:
  type: object
  required:
    - status
    - result
  properties:
    status:
      type: string
      enum: [success, error]
      description: Execution outcome.
    result:
      type: object
      description: Task-specific result payload.
    error:
      type: string
      description: Present only when status is "error". Concise error message.
```

### Required Fields

| Field | Type | Description |
|---|---|---|
| `name` | `string` | kebab-case identifier. Must match the filename (without `.yaml`). |
| `description` | `string` | One sentence. Used by orchestrator to select the right worker. |
| `plugin` | `string` | Plugin ID to attach. Must exist under `plugins/`. |
| `system_prompt` | `string` | Full system prompt for the worker. Must end with a JSON-only directive. |
| `allowed_tools` | `string[]` | Skills this worker may invoke. Enforces least-privilege. |
| `output_contract` | `object` | JSON Schema fragment describing the required output shape. |

---

## Orchestrator API

The `Orchestrator` class lives at `src/core/orchestrator.ts`.

```typescript
import { Orchestrator } from './src/core/orchestrator.js';
import { createProvider } from './src/providers/index.js';

const orchestrator = new Orchestrator({
  provider: createProvider({ type: 'anthropic-setup-auth', model: 'claude-opus-4-6' }),
  projectRoot: '/absolute/path/to/project',
});
```

### `spawnWorker(workerName, task, userId)`

Spawns a single worker and returns its parsed JSON result.

```typescript
const result = await orchestrator.spawnWorker(
  'uk-payroll-processor-worker',
  { action: 'process-starter', employeeId: 'EMP-001' },
  'user-demo',
);
// → { status: 'success', result: { ... } }
```

Steps performed internally:

1. Load `.agents/subagents/{workerName}.yaml` and validate required fields
2. Load the plugin specified in `definition.plugin` from `plugins/`
3. Create a fresh `AgentLoop` with the worker's plugin (isolated context)
4. Inject task as `{ userId, task }` JSON in the user turn
5. Run the loop — worker MUST return JSON only
6. Parse JSON result and return (strips markdown fences defensively)

### `spawnParallel(workers, userId)`

Spawns all workers concurrently. Use when tasks have no shared state or dependency.

```typescript
const results = await orchestrator.spawnParallel(
  [
    { name: 'uk-payroll-processor-worker', task: { action: 'process-starter', employeeId: 'EMP-001' } },
    { name: 'uk-payroll-processor-worker', task: { action: 'process-starter', employeeId: 'EMP-002' } },
    { name: 'uk-payroll-processor-worker', task: { action: 'process-starter', employeeId: 'EMP-003' } },
  ],
  'user-demo',
);
// → [result0, result1, result2] — order preserved
```

Internally: `Promise.all()` over `spawnWorker()` calls.

### `spawnSequential(workers, userId)`

Spawns workers one at a time, threading each result into the next task.

```typescript
const results = await orchestrator.spawnSequential(
  [
    { name: 'uk-payroll-processor-worker', task: { action: 'import-timesheet', file: 'ts.csv' } },
    { name: 'uk-payroll-processor-worker', task: { action: 'create-task', type: 'review' } },
  ],
  'user-demo',
);
```

Worker 2 receives: `{ action: 'create-task', type: 'review', previousResult: <worker 1 result> }`.

Use sequential chaining when Worker B's task depends on Worker A's output.

---

## Output Contract Enforcement

Workers are contractually required to return `{ status, result }` or `{ status, error }`.

### Why strict JSON

The orchestrator synthesises worker outputs programmatically. Prose in a worker response breaks synthesis — the orchestrator cannot reliably extract structured data from free text. This is enforced at three levels:

1. **SOUL.md** — every worker plugin's persona includes a "JSON only" directive
2. **`system_prompt`** in the YAML definition — explicit JSON-only instruction
3. **`parseWorkerResult()`** in `orchestrator.ts` — defensive: strips markdown fences, catches JSON parse failure and wraps in an error envelope

### Defensive parsing

If a worker returns non-JSON despite the directives, the orchestrator wraps it:

```json
{
  "status": "error",
  "error": "Worker \"uk-payroll-processor-worker\" violated the output contract — returned prose instead of JSON."
}
```

The orchestrator logs the first 200 characters of the raw output to help diagnose violations.

---

## Adding a New Worker

1. **Create the plugin** (if it does not exist):
   - `plugins/{plugin-id}/manifest.json`
   - `plugins/{plugin-id}/SOUL.md` — persona must end with a JSON-only directive for workers
   - `plugins/{plugin-id}/skills/` — at least one skill

2. **Write the YAML definition**:
   ```
   .agents/subagents/{worker-name}.yaml
   ```
   Follow the schema above. The `name` field must match the filename.

3. **Spawn from an orchestrator**:
   ```typescript
   await orchestrator.spawnWorker('{worker-name}', task, userId);
   ```

4. **Validate** by running the orchestrator in single-message mode:
   ```bash
   npm run dev --plugin email-classifier "Process employee EMP-042"
   ```

---

## Isolation Guarantees

| Property | Guarantee |
|---|---|
| Context window | Each worker gets a fresh `AgentLoop` — zero state shared with the orchestrator |
| Plugin identity | Worker always has a plugin before the loop starts — no "naked" workers |
| User context | `userId` passed through to the worker; memory routing (Phase 5) will enforce per-user isolation |
| Tool access | Worker only has tools listed in `allowed_tools`; not yet enforced at runtime but validated in definition |
| Output format | JSON only; parse failure wrapped in error envelope |

---

## Current Workers

| File | Plugin | Purpose |
|---|---|---|
| `.agents/subagents/uk-payroll-processor-worker.yaml` | `uk-payroll-processor` | Executes UK Payroll API operations — process-starter, import-timesheet, create-task |

---

## Known Limitations (Phase 4)

- `allowed_tools` is declared in the YAML but not yet enforced at runtime in `tool-executor.ts` — planned for Phase 6
- Worker output is not validated against `output_contract` at runtime — the schema is informational until Phase 6 adds a validator
- Sequential chaining uses shallow `{ ...task, previousResult }` merge — complex dependency graphs will need explicit mapping logic in the orchestrator plugin's skill

---

## Reference

| File | Role |
|---|---|
| `src/core/orchestrator.ts` | Orchestrator class implementation |
| `src/core/agent-loop.ts` | Worker's execution loop (same as orchestrator) |
| `src/core/plugin-loader.ts` | Plugin loading used by orchestrator to attach worker plugin |
| `.agents/subagents/*.yaml` | Worker definition files |
| `docs/CONVENTIONS.md §4.3` | Schema source of truth for worker definitions |
| `docs/PROPOSED_ARCHITECTURE.md §4` | Design intent and orchestration patterns |
| `docs/SUBAGENT_ORCHESTRATION_STUDY.md` | Research notes that shaped this implementation |
