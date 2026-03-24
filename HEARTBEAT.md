# HEARTBEAT.md — Proactive Scheduling Configuration

The heartbeat system allows the agent to perform scheduled, background work
between user interactions — checking for new emails, summarising session memory,
or triggering maintenance tasks.

> **Status**: Placeholder — heartbeat implementation is deferred to Phase 4/5.
> This file defines the intended configuration schema and wakeup patterns.

---

## 1. Purpose

The heartbeat is a periodic wakeup signal that:
- Triggers proactive agent actions without a user message
- Allows the orchestrator to poll for new work (e.g. incoming emails)
- Triggers session memory compaction when conversation length exceeds a threshold
- Fires any scheduled plugin-level tasks declared in `manifest.json`

---

## 2. Configuration Schema

Heartbeat configuration is declared per-plugin in `manifest.json` under the optional `heartbeat` key:

```json
{
  "id": "email-classifier",
  "heartbeat": {
    "enabled": true,
    "interval": "*/5 * * * *",
    "tasks": [
      {
        "name": "poll-inbox",
        "skill": "classify-email",
        "trigger": "cron"
      }
    ]
  }
}
```

| Field | Type | Description |
|---|---|---|
| `enabled` | `boolean` | Whether the heartbeat is active for this plugin |
| `interval` | `string` | Cron expression (UTC) for the wakeup frequency |
| `tasks` | `array` | List of tasks to execute on each wakeup |
| `tasks[].name` | `string` | Human-readable task label |
| `tasks[].skill` | `string` | Skill to invoke (must exist in plugin's `skills/`) |
| `tasks[].trigger` | `string` | `cron` (scheduled) or `event` (future: webhook/queue) |

---

## 3. Wakeup Lifecycle

```
Cron fires (e.g. every 5 minutes)
    ↓
Heartbeat daemon wakes orchestrator
    ↓
Orchestrator loads plugin heartbeat config
    ↓
For each enabled task:
    Attach userId context (system/daemon userId for background tasks)
    Invoke declared skill
    Handle result (log, store, or dispatch sub-agent)
    ↓
Return to sleep until next interval
```

---

## 4. Memory Compaction Trigger

The heartbeat also monitors session length. When a conversation window approaches
the context limit, the heartbeat triggers a compaction job:

1. Summarise the oldest 30% of the session into a durable long-term memory entry
2. Prune the summarised messages from the active session
3. Append a compaction marker to `memory/users/{userId}/session/` with timestamp

---

## 5. Implementation Notes (deferred to Phase 4/5)

- Daemon implementation: Node.js `cron` package or system-level scheduler via `.agents/subagents/`
- Background userId: A reserved `system` userId for daemon-originated tasks
- Plugin heartbeat config validation: performed by `plugin-loader.ts` at boot
- Heartbeat tasks must not block the primary request–response loop
