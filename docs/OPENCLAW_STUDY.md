# OpenClaw Architecture Study

## 1. Architecture Overview
OpenClaw operates a local-first star architecture centred on a Gateway (WebSocket control plane at `ws://127.0.0.1:18789`). The Gateway routes all inbound traffic from external messaging channels (WhatsApp, Telegram, Slack, etc.) to the core AI reasoning loop (the Pi agent via RPC). The CLI (`openclaw ...`), macOS app, and mobile companion nodes connect to this same Gateway. This decoupled design ensures the Pi agent focuses solely on reasoning, while the Gateway handles tool execution, presence, session management, and external I/O routing.

## 2. Agent Identity System
Identity is entirely configuration-driven rather than hardcoded. 
- **`SOUL.md`**: Defines personality ("Core Truths", "Boundaries", "Vibe"). It explicitly instructs the agent that it is "becoming someone" and that it should be "genuinely helpful, not performatively helpful."
- **`TOOLS.md` / `IDENTITY.md`**: Supplements basic configuration by declaring the agent's specific role and scope inside `~/.openclaw/workspace/`.

## 3. Skills System
Skills are text documents (`SKILL.md`) living in `extensions/*`, `.agents/skills/`, or a user's `~/.openclaw/workspace/skills/`. 
They use YAML frontmatter for progressive disclosure: `name`, `description`, and `metadata.openclaw.requires` are parsed at startup. The agent only reads the full file when executing the skill. A centralized registry (ClawHub) enables discovering skills dynamically.

## 4. Memory Management
Memory is segmented by session.
- **Session Memory**: Handled by Pi agent sessions living in `~/.openclaw/sessions/` (non-configurable base path).
- **Long-term/RAG**: `src/memory` reveals a layered architecture supporting LanceDB, Voyage, OpenAI, and local embeddings.
- **Context Management**: Sustained sessions use an explicit `/compact` command to compress the context window, preventing infinite token bloat.

## 5. Heartbeat and Proactive Scheduling
`HEARTBEAT.md` configures cron-like proactive execution. An empty `HEARTBEAT.md` explicitly skips heartbeat API calls, saving resources. If populated, it defines checks the agent must perform periodically (e.g., checking an inbox or running a status probe). The daemon lifecycle is managed by `openclaw gateway --port 18789` running in the background.

## 6. Operating Rules
`AGENTS.md` sets the hard behavioural boundaries. It defines repo-root relative paths, strict "do not edit" zones (like `CODEOWNERS` files), multi-agent safety rules (e.g., "do not create/apply/drop git stash unless explicitly requested"), and strict commit/PR processes. It ensures the assistant operates safely within a developer's repository.

## 7. Channel Routing
External messages are ingested by channel connectors. The Gateway relies on DM pairing (`dmPolicy="pairing"`) to ensure unknown senders are blocked behind a pairing code. Once paired, messages flow through to isolated agent workspaces. Group chats are gated by mention checks (`requireMention: true`), preventing the bot from replying to every message inappropriately.

## 8. Multi-agent Patterns
OpenClaw orchestrates sub-agents in two primary ways:
1. **The `sessions_*` Tools**: `sessions_spawn`, `sessions_send`, and `sessions_list` allow the main agent to spin up pure OpenClaw worker sessions and pass messages between them.
2. **The `coding-agent` Skill**: For heavy code generation, OpenClaw uses a pure `bash` tool with `pty:true` and `background:true`. It spawns CLI agents like Codex or Claude inside `git worktrees` (e.g., for batch PR reviews). The orchestrator uses `process action:log` and `process action:poll` to monitor the sub-agents asynchronously.

## 9. Multi-user Analysis
OpenClaw is fundamentally a **single-user system**. The documentation explicitly states it is a "personal AI assistant you run on your own devices." The single-user assumption is baked into:
- The global settings path `~/.openclaw/openclaw.json`.
- The single workspace path `~/.openclaw/workspace/`.
- `sessions/` directories not being segmented by user ID.
To support multi-user isolated state, the framework must intercept incoming requests, identify the channel/user, and dynamically map to entirely separate `/memory/users/{user-id}/` working directories.

## 10. Security Model
The default execution model is highly privileged: tools run on the host for the **main** session.
To protect against untrusted input from public channels, OpenClaw defaults to `agents.defaults.sandbox.mode: "non-main"`. This forces non-main group/channel sessions to run tools (like `bash`) inside per-session Docker containers (`Dockerfile.sandbox`). Elevated commands (`/elevated on`) can override this if explicitly authorized by the owner.

## 11. Key Patterns to Replicate
1. **Gateway/Agent Decoupling**: Separate the message routing/tool execution layer from the LLM reasoning loop to support multiple channels cleanly.
2. **Configuration-Driven Identity (`SOUL.md`)**: Ensure the base agent is a blank slate, deriving its persona and limits purely from injected markdown.
3. **Progressive Skill Disclosure**: Parse YAML frontmatter for cheap tool discovery, loading full `SKILL.md` context only when the tool is selected.
4. **Agent File Isolation (Workdirs)**: Always spawn sub-agents in dedicated isolated directories (like `coding-agent` using git worktrees) so they cannot cross-contaminate state or read unrelated configs.
5. **Background Process Monitoring**: Use asynchronous task spawning returning a `sessionId`, with `poll`, `log`, and `kill` actions for non-blocking sub-agent orchestration.
6. **Explicit Output Contracts**: Use immediate wake triggers (like OpenClaw's `system event --text "Done"`) in sub-agent prompts to report completion proactively without waiting for a heartbeat.
