# Implementation Conventions

Authoritative reference for all contributors (human and AI). Rules here override intuition.
Both `CLAUDE.md` and `GEMINI.md` point here — keep all three in sync.
For frontend UI styling and aesthetics, refer to `FRONTEND_DESIGN_CONVENTIONS.md`.

---

## 1. Language and Runtime

- **Primary language**: TypeScript (Node.js 20+)
- **Module system**: ESM only (`"type": "module"` in `package.json`)
- **No transpile step for scripts**: Plain `.ts` files run via `tsx` or `ts-node --esm`
- **Config files**: JSON (no JSONC, no TOML, no YAML for config — YAML is reserved for declarative agent definitions)
- **Markdown files**: UTF-8, Unix line endings (`\n`), no trailing whitespace

---

## 2. Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Plugin ID | `kebab-case` | `sniper-sharp-agent` |
| Plugin display name | `PascalCase` concatenated | `SniperSharpAgent` |
| Skill name (tool identifier) | `kebab-case` | `ast-parser`, `code-review` |
| Sub-agent definition file | `kebab-case.yaml` | `orchestrator.yaml`, `code-analyst.yaml` |
| User ID | `lowercase-alphanumeric-hyphen` | `user-abc123` |
| Framework spec files | `SCREAMING_SNAKE.md` | `SOUL.md`, `SKILL.md`, `AGENTS.md` |
| Memory data files | `kebab-case.md` or `kebab-case.json` | `long-term.md`, `preferences.json` |
| TypeScript source files | `kebab-case.ts` | `plugin-loader.ts`, `memory-router.ts` |
| Directories | `kebab-case` | `plugins/`, `long-term/`, `sub-agents/` |

---

## 3. Directory Layout Rules

```
.agents/
  skills/           ← Core (framework-level) skill definitions
  subagents/        ← Declarative worker/specialist definitions

plugins/
  {plugin-id}/
    manifest.json
    SOUL.md
    README.md
    skills/         ← Plugin-level skill definitions (shadow Core on name collision)

memory/
  shared/
    long-term/      ← Repo-wide RAG/embeddings, not user-specific
    rules/          ← System-wide operational rules
  users/
    {user-id}/
      session/      ← Ephemeral; wiped at end of conversation
      long-term/    ← Persistent per-user RAG/embeddings
      preferences/
        skills/     ← User-level skill overrides (shadow Plugin and Core)

src/               ← TypeScript runtime source
  core/            ← Framework kernel (plugin loader, memory router, orchestrator)
  types/           ← Shared TypeScript interfaces
```

**Rules:**
- Never put plugin-specific code inside `src/core/`
- Never reference a plugin by name inside any framework file (`CLAUDE.md`, `GEMINI.md`, `src/core/`)
- `memory/users/{userId}/` is the hard boundary — no code or agent may read across it
- `references/` is git-ignored and read-only — never write to it, never commit it

---

## 4. Schema Specifications

### 4.1 `manifest.json` (Plugin Manifest)

**Required fields:**
```json
{
  "id": "kebab-case-string",
  "name": "PascalCaseString",
  "version": "semver-string",
  "role": "One-sentence description of the specialist's purpose",
  "entrypoint": "SOUL.md",
  "skillsDir": "skills/"
}
```

**Known plugin IDs in this project:**

| `id` | `name` | Role |
|---|---|---|
| `email-classifier` | `EmailClassifier` | Orchestrates email triage and dispatches worker sub-agents |
| `uk-payroll-processor` | `UkPayrollProcessor` | Worker — executes UK Payroll API calls |
| `uk-payroll-app-agent` | `UkPayrollAppAgent` | Standalone — app navigation assistant via RAG and MCP |
| `sniper-sharp-agent` | `SniperSharpAgent` | High-precision software architect |
- `id` must be unique across all plugins
- `version` must be a valid semver string
- `entrypoint` must point to a file that exists within the plugin directory
- No extra fields without updating the manifest schema

### 4.2 `SKILL.md` (Skill Definition — YAML Frontmatter)

**Required frontmatter fields:**
```yaml
---
name: skill-name-in-kebab-case
description: "Precise one-to-two sentence description of WHEN and WHY to use this skill. This is what the LLM sees during progressive disclosure."
allowed-tools:
  - read_file
  - bash
---
```

**Optional frontmatter fields:**
```yaml
user-invocable: true          # Exposes as /slash-command to the human user
disable-model-invocation: true # Only callable by hooks/triggers, not the LLM directly
scope: core | plugin | user    # Informational; resolved at load time from directory position
```

- `name` must be globally unique within the resolved skill roster for a given session
- `description` is the LLM's only signal during progressive disclosure — make it precise
- `allowed-tools` must follow least-privilege: only list what the skill actually needs

### 4.3 Sub-Agent Definition (`.agents/subagents/{name}.yaml`)

> **Key principle**: A worker sub-agent is a base agent with a plugin attached — the same
> pattern as any other agent. The `plugin` field below specifies which plugin is attached
> when the orchestrator spawns this worker.

```yaml
name: agent-name-kebab-case
description: "One sentence: when the orchestrator should dispatch this worker."
plugin: plugin-id-kebab-case       # Plugin to attach when spawning this worker
system_prompt: |
  You are a specialist worker. [Full persona and task instructions here.]
  IMPORTANT: Return ONLY valid JSON. No preamble. No explanation. No markdown wrapping.
allowed_tools:
  - read_file
output_contract:
  type: object
  required: [status, result]
  properties:
    status:
      type: string
      enum: [success, error]
    result:
      type: object          # Define the actual payload shape here
    error:
      type: string          # Present only when status == "error"
```

- Every sub-agent MUST include `output_contract`
- Every sub-agent MUST include `plugin` — the worker's identity comes from the plugin, never from `system_prompt` alone
- `system_prompt` MUST end with the no-preamble JSON-only directive
- `allowed_tools` must be a strict subset of the parent orchestrator's permissions

---

## 5. Sub-Agent Output Contract

All worker sub-agents return **only** this envelope — no exceptions:

```json
{
  "status": "success",
  "result": { ...task-specific payload... }
}
```

Or on failure:

```json
{
  "status": "error",
  "error": "Concise description of what failed and why."
}
```

**Forbidden in worker output:**
- Prose explanations or reasoning
- Markdown formatting or code fences
- Partial JSON or truncated output
- Fields not declared in the definition's `output_contract`

---

## 6. Memory Access Rules

1. **Always scope reads/writes to `memory/users/{userId}/`** — the userId comes from the request context, never from the agent's reasoning
2. **Session memory** (`session/`) is ephemeral — never persist decisions there that need to survive conversation restart
3. **Long-term memory** (`long-term/`) is persistent — only write distilled, durable facts (not raw conversation history)
4. **Shared memory** (`shared/`) is read-mostly — agents may read it freely but writes require explicit orchestration-level permission
5. **Cross-user reads are forbidden** — no code path may construct a path like `memory/users/` without a bound `{userId}`

---

## 7. Skill Scope Resolution (Precedence Order)

When two skills share the same `name`, the higher-specificity scope wins:

```
User > Plugin > Core
```

Resolution happens at session initialisation. The resolved roster is immutable for the session's lifetime.

---

## 8. Implementation Order Rules

Follow this sequence within every phase — do not skip steps:

1. **Study first**: If a Phase starts with research, complete all study documents before writing any code or scaffold
2. **Scaffold structure**: Create the directory layout and empty placeholder files before filling content
3. **Schema before implementation**: Define and document all file schemas before writing the loader/parser
4. **Core before Plugin before User**: Implement the base tier fully before adding Plugin-tier capabilities
5. **Tests alongside**: Write a validation test for each schema or loader as it is built — not deferred to the end

---

## 9. Forbidden Patterns

These are hard constraints — raise them as blockers if encountered:

| Pattern | Why Forbidden |
|---|---|
| Hardcoding a plugin name in `src/core/` or framework markdown | Breaks plugin-agnostic principle; changing plugin name requires framework edits |
| Reading `memory/users/` without a bound `userId` | Risk of cross-user data leakage |
| Worker sub-agent returning prose | Breaks Orchestrator synthesis; fills context with noise |
| Worker sub-agent making architectural decisions | Workers execute, Orchestrators decide |
| Lazy loading skipped (dumping all skills at boot) | Violates progressive disclosure; inflates context window for every request |
| Committing anything under `references/` | Reference material is read-only study material |
| YAML for runtime config | YAML is reserved for declarative agent definitions; config uses JSON |

---

## 10. Commit and Branch Conventions

- **Commits**: Conventional Commits format — `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
- **Scope**: Use the phase or component — e.g., `docs(phase-2):`, `feat(plugin-loader):`
- **Docs changes**: Always `docs:` prefix — never `feat:` for pure documentation
- **No direct commits to `main`**: All implementation work via feature branches; `master` is the working branch until `main` is established

---

## 11. UK English Requirement

All documentation, comments, variable names (where readable), and error messages must use **UK English** spelling:

| Use | Not |
|---|---|
| behaviour | behavior |
| initialise | initialize |
| recognise | recognize |
| colour | color |
| licence (noun) | license (noun) |
