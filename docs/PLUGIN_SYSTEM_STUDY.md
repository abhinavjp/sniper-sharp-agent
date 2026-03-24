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
- **Name/Role**: "You are a generalist assistant" is overridden by "You are SniperSharpAgent, precision engineer."
- **Operating Context**: Adds domain rules (e.g. "Never use Tailwind, strictly vanilla CSS").
- **Tool Roster**: Injects new function schemas into the tool-calling API layer.
The base agent binary remains untouched; the runtime memory represents the fusion of the core + plugin context.

## 5. Skill Scope Hierarchy
Skills exist in tiered boundaries, preventing collisions and enabling overrides:
1. **Bundled**: Built-in system tools (e.g. `read_file`, `bash`).
2. **Global**: User-installed tools persisting across all workspaces (`~/.claude/skills`).
3. **Project**: Tools strictly relevant to the current repository, stored in `.claude/skills/`.
4. **Plugin**: Tools injected dynamically by a loaded specialist package.
If a Project and Bundled skill conflict, the narrower scope (Project/Plugin) shadows the generic one.

## 6. Replication Design
For this framework, the equivalent plugin mechanism will be implemented as follows:
- **Manifest Format**: A standard `plugin.json` (or `plugin.yaml`) containing the plugin's `id`, `displayName`, `roleDescription`, and references to its skill directory.
- **Context Injection**: The plugin must supply an equivalent of OpenClaw's `SOUL.md`. When the base agent initializes, it checks if a plugin is specified. If found, it swaps out default context for the plugin's `SOUL.md`.
- **Runtime Transition**: The framework's initialization phase reads the active plugin. It traverses the plugin's `skills/` directory, compiles the YAML frontmatter across all `.md` files, and constructs the agent's tool payload strictly constrained to that plugin's specialized intents.
