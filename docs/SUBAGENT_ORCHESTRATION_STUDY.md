# Sub-Agent Orchestration Study

## 1. Claude Code Task Tool Mechanics
The Claude Code Task tool acts as a contextual fork. When a parent agent spawns a sub-agent using the `Task` tool, the sub-agent receives an isolated, pristine context window. It inherits the tool permissions of the parent but none of the conversational clutter. This prevents the sub-agent from being confused by previous dialogue. The parent pauses (or continues, depending on implementation) and waits for the sub-agent to return its final result, perfectly encapsulating the reasoning.

## 2. Parallel vs Sequential Dispatch
Orchestration relies on a core routing heuristic: **If tasks can be shuffled in any order and produce the exact same final result, they are parallel-safe.** 
- **Parallel Dispatch**: Used for independent domain queries. E.g., querying three different database shards or searching three disparate code files simultaneously. This is cost-heavy but highly latency-optimised.
- **Sequential Chaining**: Used when a strict dependency graph exists. E.g., Sub-agent A fetches a schema, Sub-agent B writes a migration based on A's schema, Sub-agent C applies the migration. B cannot run until A's output is injected into its prompt.

## 3. Orchestrator/Worker Pattern
The parent becomes an **Orchestrator**. Its job is strictly decomposition and synthesis.
1. It receives a complex task.
2. It breaks the task into discrete, scoped prompts (e.g., "Analyse user authentication loop in file X").
3. It dispatches workers (via the Task tool or background process execution).
4. The workers do not make architectural decisions; they simply execute the scoped prompt and return a bounded result.
5. The orchestrator synthesises the raw outputs into a unified final answer or system change.

## 4. Sub-Agent Definition
In Claude Code, sub-agents are defined declaratively via `.claude/agents/*.md` files. These files supply:
- A `description` (so the orchestrator knows when to invoke it).
- A `system prompt` (the specific persona/instructions for the sub-agent).
- `allowed-tools` (a strict subset of capabilities, enforcing the principle of least privilege).
- `memory` (optional, for cross-invocation persistence).

## 5. Output Contracts
Workers operate efficiently only if their output contracts are rigid. Because the Orchestrator is an LLM, it requires clean input to synthesize effectively. Sub-agent prompts must explicitly command: *"Return only the structured JSON result. Do not include a preamble. Do not explain your steps."* If a worker violates this, the Orchestrator's context window fills with redundant conversation, eventually breaking the synthesis step.

## 6. Agent Teams vs Sub-Agents
- **Agent Teams**: Best for sustained parallelism traversing multiple turns (e.g. a frontend agent and backend agent continuously coordinating over a shared workspace). They require shared memory bus mechanisms and cross-session routing.
- **Sub-Agents (Single-Session)**: Ephemeral bursts of computation. Fired off to solve one specific problem (e.g., "summarise this 800-line file"), returning the answer, and immediately terminating. Best for context-isolated, stateless tasks.

## 7. OpenClaw Comparison
OpenClaw has functional equivalents but via different mechanisms:
- Instead of an integrated `Task` tool, OpenClaw relies on `sessions_spawn` and `sessions_send` for native agent-to-agent communication.
- For practical code generation, OpenClaw orchestrates parallel "armies" via the `bash` tool with `pty:true` and `background:true`, dropping Codex/Claude instances into isolated `git worktrees`.
- OpenClaw lacks declarative `.claude/agents/*.md` definitions, relying instead on injecting separate `SOUL.md` configs into new sessions or relying entirely on bash scripts for sub-agent definitions. This project must build a robust, file-based definition system for specialists natively.

## 8. Patterns to Replicate
1. **Isolated Context Windows**: Sub-agents must always start with a clean context to maximize reasoning quality on the specific sub-task.
2. **Declarative Sub-Agent Roster**: Define specialist workers using a structured metadata file (JSON/YAML/frontmatter) indicating their purpose, tools, and system prompt.
3. **Strict Output Directives**: Enforce "no preamble, structured output only" explicitly in the sub-agent invocation payload.
4. **Git Worktree Isolation**: Replicate OpenClaw's pattern of using temporary subdirectories or git worktrees when multiple sub-agents need to make code edits simultaneously without colliding.
5. **The Dependency Heuristic**: Build an explicit decision gate into the Orchestrator's prompt directing it to analyse tasks for parallel safety before dispatching.
