# Memory, Heartbeat, and Agent Loop Deep Dive

This document captures the Phase 2 architectural research into OpenClaw's internal systems context. These findings will guide how our generic agent framework handles state, proactive execution, and the primary reasoning loop.

## 1. Memory Lifecycle Analysis

OpenClaw segments memory into ephemeral session state and persistent long-term storage (embeddings).

### File-System as Source of Truth
- The memory sync manager (`src/memory/manager-sync-ops.ts`) continuously monitors `MEMORY.md`, `memory/**/*.md`, and session transcripts via `chokidar` (FS watchers).
- Incremental updates are debounced (`SESSION_DIRTY_DEBOUNCE_MS = 5000`) and read in chunks (`SESSION_DELTA_READ_CHUNK_BYTES = 64KB`) to avoid crashing on massive transcript files.

### Storage Backends
- Uses `sqlite-vec` (and optionally LanceDB/Voyage/OpenAI) to maintain an embedding cache (`EMBEDDING_CACHE_TABLE`) and vector table (`chunks_vec`).
- A Full-Text Search (FTS) table (`chunks_fts`) runs alongside the vector index for hybrid retrieval.

## 2. Heartbeat Internals

The Heartbeat system (`src/infra/heartbeat-runner.ts`) provides cron-like proactive execution.

### Execution Control
- Agents check `isWithinActiveHours` to respect user quiet times.
- If requests are already in-flight (queue > 0), the heartbeat skips to avoid colliding with active user tasks.

### Context Preservation (The "Isolated Session" Pattern)
- To prevent the agent from loading a 100k+ token history just to check `HEARTBEAT.md`, the framework spawns an **isolated session** for the heartbeat run.
- The heartbeat gets an empty transcript, runs its checks, and can still route outbound messages back to the main session's channel.

### Transcript Pruning
- If the agent determines no action is needed, it outputs a configurable `HEARTBEAT_OK` token.
- The `pruneHeartbeatTranscript` method detects this and **truncates the session transcript back to its pre-heartbeat size** (`src/infra/heartbeat-runner.transcript-prune.test.ts`). This is critical: it prevents context pollution from hundreds of zero-information exchanges over time.

## 3. Agent Loop Anatomy

The reasoning loop is driven by the Gateway WebSocket control plane (`src/gateway/server-chat.ts`).

### Message Arrival & Event Routing
- Events flow in via `AgentEventPayload`. 
- The Gateway maintains distinct registries for different consumers: `ChatRunRegistry` (for UI text streams) and `ToolEventRecipientRegistry` (for executing tools).

### Delta Throttling and Synthesis
- Assistant output streams are buffered and throttled (e.g., 150ms debounce in `emitChatDelta`) before broadcasting to the UI, preventing WebSocket flood.
- The Gateway attempts to silently strip internal directives (like `<thinking>` blocks or the `SILENT_REPLY_TOKEN`) before it reaches the end user unless running in verbose mode.

## 4. Context Compression Strategies

Continuous sessions inherently grow unbounded. The framework addresses this via:

1. **Explicit Compaction Hooks**: Tools/Commands (like OpenClaw's `/compact`) instruct the agent to read the active transcript, summarize it into a semantic snapshot, and start a fresh transcript containing only the summary.
2. **Heartbeat Pruning**: The aforementioned `HEARTBEAT_OK` file-truncation technique.
3. **Session Segmentation**: Using sub-sessions or isolated cron-sessions for background tasks so they never pollute the primary interactive context window.

## Architectural Takeaways for Our Framework
1. **Never load the main history for background heartbeats/cron jobs.** Always use isolated worker sessions (with empty logs) when the agent is acting autonomously. 
2. **Implement aggressive transcript pruning.** If an automated probe determines "no action needed", the framework must roll back the transcript write-ahead log to prevent token bleed.
3. **Decouple the tool loop from the chat stream.** Let orchestrators spin wildly fast in the background while selectively throttling/buffering final text chunks sent to the user interface.
