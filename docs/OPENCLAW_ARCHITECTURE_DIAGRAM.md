# OpenClaw Architecture Diagram

```mermaid
flowchart TD
    %% External Interfaces
    subgraph Channels [External Messaging Channels]
        Slack[Slack]
        WhatsApp[WhatsApp]
        Telegram[Telegram]
    end

    %% Control Plane
    subgraph ControlPlane [Gateway - WebSocket Control Plane]
        Router[Channel Routing & DM Policy]
        SessionMgr[Session Manager]
        ToolExec[Tool Executor / Docker Sandbox]
    end

    %% Agent Core
    subgraph AgentLoop [Pi Agent]
        Context[Context Builder]
        LLM[LLM Reasoning Engine]
    end

    %% Agent Configuration
    subgraph Config [Agent Configuration Workspace]
        SOUL[SOUL.md<br/>Identity & Vibe]
        AGENTS[AGENTS.md<br/>Operating Rules]
        HEART[HEARTBEAT.md<br/>Daemon Wakeup]
    end

    %% Memory and Skills
    subgraph State [Memory & Capabilities]
        Memory[Session & Long-term Memory<br/>~/.openclaw/sessions/]
        Skills[Skills Loader<br/>Progressive Disclosure via SKILL.md]
    end

    %% Local Ops
    CLI[CLI / openclaw]

    %% Relationships
    Slack -->|Inbound Msg| Router
    WhatsApp -->|Inbound Msg| Router
    Telegram -->|Inbound Msg| Router
    
    CLI -->|Local Cmds| Router

    Router -->|Validates paired sender| SessionMgr
    SessionMgr <--> Memory
    
    SessionMgr -->|Pushes Prompt + Config| Context
    Config -.-> Context
    Skills -.-> Context
    
    Context --> LLM
    LLM -->|Request Tool| ToolExec
    ToolExec -->|Tool Result| LLM
    
    LLM -->|Final Response| SessionMgr
    SessionMgr -->|Outbound Msg| Router
    Router -->|Dispatch| Channels
```

## Legend

* **Channels**: Inbound connection points bringing user messages from external networks.
* **Gateway (Control Plane)**: The core node running at `ws://127.0.0.1:18789`. It enforces DM pairing policies, manages discrete session isolation, and executes system tools (using Docker sandboxing for non-main sessions).
* **Pi Agent**: The fundamental reasoning loop. It never touches the network directly, relying on the Gateway for physical execution.
* **Config**: The text-based files (`SOUL.md`, `AGENTS.md`) injected into the Pi Agent's system prompt to transform it into a specific persona with behavioural boundaries.
* **Skills Loader**: Reads YAML frontmatter of `SKILL.md` files for quick discovery, passing short descriptions to the agent and revealing full bodies only upon tool invocation.
* **Memory**: File-backed storage for sessions and conversational history (`~/.openclaw/sessions/`), periodically compressed to maintain context constraints.
