# Plugin System Study

## 1. Plugin Structure
In the Claude Code architecture, a plugin is a self-contained bundle that alters the agent's capabilities and context. It typically functions as an installed package or a local directory containing:
- Specific `*.js`/`*.ts` script files for executing logic.
- A `CLAUDE.md` context file providing domain-specific instructions or project styling rules.
- `SKILL.md` (or equivalent tool configuration) defining what external tools are available.
The plugin is discovered via configuration maps (like `package.json` dependencies or `.claude.json` local maps) and is dynamically bolted onto the core agent at startup.

## 2. Skill Discovery and Loading
Agent context windows are strictly finite. Instead of loading every possible tool and rule into the system prompt continuously, discovery relies on **Progressive Disclosure**:
- **Startup / Idle State**: The orchestrator is fed only the tool names and a concise JSON/YAML summary description of what each skill does.
- **On-Demand Loading**: When the orchestrator decides a task requires a specific skill, it invokes an intermediary loading function. The system then resolves and loads the full `SKILL.md` details, underlying tool schemas, and execution code.

## 3. SKILL.md Frontmatter
Skills are defined using YAML frontmatter to support static analysis without parsing the entire markdown body:
- `name`: The explicit tool identifier the LLM uses to invoke it.
- `description`: A tight, exact summary detailing *when* and *why* to use the skill. This is what the LLM sees during progressive disclosure.
- `disable-model-invocation`: If true, restricts the skill to being called by triggers/hooks rather than the reasoning LLM directly.
- `user-invocable`: Exposes the skill natively as a `/slash` command for the human user.
- `allowed-tools`: Dictates which nested capabilities the skill itself (or sub-agents spawned by it) is permitted to access, ensuring the principle of least privilege.

## 4. Identity Transformation via Plugin
A plugin fundamentally rewires the agent. By attaching a plugin, the agent's core system prompt is mutated at runtime:
- **Name/Role**: "You are a generalist assistant" is overridden by the plugin's SOUL — e.g. "You are EmailClassifier, a precision email triage agent."
- **Operating Context**: Adds domain rules specific to the plugin's purpose.
- **Tool Roster**: Injects new function schemas (skills) into the tool-calling layer.
The base agent binary remains untouched; the runtime memory represents the fusion of the core + plugin context.

**This applies to workers too.** When an orchestrator spawns a sub-agent, it spawns a fresh base agent
and attaches the appropriate plugin. The worker's identity, rules, and skills all come from that plugin —
not from the orchestrator, and not from any hardcoded worker definition.

## 5. Skill Scope Hierarchy
Skills exist in tiered boundaries, preventing collisions and enabling overrides:
1. **Bundled**: Built-in system tools (e.g. `read_file`, `bash`).
2. **Global**: User-installed tools persisting across all workspaces (`~/.claude/skills`).
3. **Project**: Tools strictly relevant to the current repository, stored in `.claude/skills/`.
4. **Plugin**: Tools injected dynamically by a loaded specialist package.
If a Project and Bundled skill conflict, the narrower scope (Project/Plugin) shadows the generic one.

## 6. Replication Design
For this framework, the plugin mechanism is implemented as follows:
- **Manifest Format**: `manifest.json` (JSON, not YAML — YAML is reserved for declarative agent definitions). Contains `id` (kebab-case), `name` (PascalCase), `version` (semver), `role`, `entrypoint`, and `skillsDir`. See `docs/CONVENTIONS.md` §4.1 for the full schema.
- **Context Injection**: The plugin supplies a `SOUL.md`. When the base agent initialises, it checks for a plugin. If found, it swaps out the default generalist context for the plugin's `SOUL.md`.
- **Runtime Transition**: The framework's initialisation phase reads the active plugin. It traverses the plugin's `skills/` directory, compiles the YAML frontmatter from all `SKILL.md` files, and constructs the agent's tool payload constrained to that plugin's specialised intents (progressive disclosure — names only at boot, full schema on demand).
- **Worker Sub-Agents**: The same mechanism applies when the orchestrator spawns a worker. It spawns a base agent, attaches the designated plugin (specified in the `.agents/subagents/{name}.yaml` definition), binds the user memory context, and injects the task as a structured JSON prompt.
