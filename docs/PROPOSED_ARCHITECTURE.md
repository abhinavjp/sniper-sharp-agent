# Proposed Architecture

## 1. Plugin System Design
The framework defaults to a capable generalist but transitions into a specialist upon plugin initialization.

**Plugin Manifest Format (`manifest.json`)**:
```json
{
  "id": "sniper-sharp-agent",
  "name": "SniperSharpAgent",
  "version": "1.0.0",
  "role": "High-precision single-purpose software architect",
  "entrypoint": "SOUL.md",
  "skillsDir": "skills/"
}
```

- **Plugin Obligations**: A plugin must supply a `manifest.json`, a `SOUL.md` (defining identity, vibe, and behavioural constraints), and its own isolated `skills/` directory containing `SKILL.md` definitions.
- **Detection & Transition**: Upon boot, the base agent scans the `plugins/` directory (or a configured active plugin pointer). If a plugin is found, its `manifest.json` overrides the base name, its `SOUL.md` overrides the base system prompt persona, and its `skills/` are appended to the available tool manifest.

**Example: SniperSharpAgent Plugin Directory**
```
plugins/
  sniper-sharp-agent/
    manifest.json
    SOUL.md
    README.md
    skills/
      code-analysis/
        SKILL.md
        ...
```

## 2. Multi-User Memory Model
To support multiple users simultaneously while retaining shared operational logic, memory is segmented strictly.

**Proposed Directory Structure**:
```
memory/
  shared/
    long-term/        # RAG / embeddings available to all users (e.g. repo knowledge)
    rules/            # System-wide operational rules (AGENTS.md equivalent)
  users/
    {user-id}/
      session/        # Ephemeral context for current conversation
      long-term/      # Per-user persistent RAG/embeddings
      preferences/    # User-specific config overrides
```
- **Identification & Routing**: Every incoming request to the framework must include a `userId`. The Gateway/Router maps the request context to `memory/users/{userId}`. 
- **Isolation**: Sub-agents inherit only the specific `{user-id}` memory path required for the task. The LLM cannot accidentally query cross-user data due to hardcoded directory scoping in the tools.

## 3. Sub-Agent Orchestration Design
Sub-agent orchestration treats the primary LLM session as an Orchestrator and spawned sessions as Workers.

- **Decomposition & Dispatch**: An Orchestrator receives a complex prompt, breaks it down into explicit sub-tasks, and invokes the `dispatch_worker` tool.
- **Parallel Dispatch**: If tasks share no dependency graph and alter no shared state (e.g. read-only analysis of distinct modules), the Orchestrator fires multiple workers concurrently via background processes.
- **Sequential Chaining**: If Task B requires Task A's output, they are chained. Worker A runs; its output is injected into Worker B's isolated prompt.
- **Result Synthesis**: Workers run in isolated context windows. They must reply strictly with structured output (e.g. JSON results, no conversational filler). The Orchestrator aggregates these payloads into a consolidated final response.
- **Sub-Agent Definitions**: Specialist worker prompts and permissions are defined declaratively in `.agents/subagents/{agent-name}.yaml`, ensuring the orchestrator doesn't have to invent a prompt from scratch every time it dispatches.

## 4. Skill Scope Model
Skills are resolved through a tiered hierarchy, allowing higher-specificity scopes to shadow lower ones.

1. **Core (Base tier)**: Built-in framework capabilities (`read_file`, `write_file`, `run_bash`).
2. **Plugin (Specialist tier)**: Skills injected dynamically by the active plugin. E.g., `sniper-sharp-agent` might inject a custom `ast_parser` skill. If it names a skill identically to a Core skill, the Plugin skill wins.
3. **User (Individual tier)**: Residing in `memory/users/{user-id}/preferences/skills/`. A user's personal overrides or custom scripts that shadow Plugin and Core skills. 

## 5. Agent Lifecycle State Machine
The agent execution loop moves through 5 discrete states.

- **State 1: Generalist**: System boots. No plugin specified. The agent loads the base generalist `SOUL.md` and Core skills.
- **State 2: Plugin Detection**: System scans for an active plugin directory. `manifest.json` is parsed.
- **State 3: Specialist Transformation**: The generalist prompt is swapped for the plugin's `SOUL.md`. The agent name and role change. Plugin skills are registered.
- **State 4: User Context Loading**: An incoming request attaches a `userId`. The agent sets its working memory boundaries to `memory/users/{user-id}/` and loads the active session history.
- **State 5: Sub-Agent Dispatch (Optional)**: If the orchestrator detects excessive complexity or parallelism, it pauses the primary session, delegates bounded tasks to workers, waits for results, and resumes.
