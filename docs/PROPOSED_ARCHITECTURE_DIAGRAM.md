# Proposed Architecture Diagrams

## Diagram A — Plugin Lifecycle

This diagram demonstrates how the base framework initializes as a Generalist, detects an attached plugin, mutates its identity, and subsequently handles a user request as a Specialist.

```mermaid
sequenceDiagram
    participant Boot as System Boot
    participant Core as Base Agent (Generalist)
    participant Plugin as Plugin System (Manifest/SOUL)
    participant Memory as User Context Layer
    
    Boot->>Core: Start Framework
    Core->>Core: Load Core Skills & Default Identity
    Core->>Plugin: Scan for active plugins
    
    alt Plugin Found (e.g. SniperSharpAgent)
        Plugin-->>Core: Return manifest.json & SOUL.md & Skills
        Core->>Core: STATE CHANGE: Generalist -> Specialist
        Core->>Core: Override Name, Role, Rules
        Core->>Core: Register Plugin Skills
    end
    
    Note over Core: Agent is now fully defined
    
    Boot->>Memory: Incoming Request (User A)
    Memory-->>Core: Attach memory/users/{UserA}/ bounds
    Core->>Core: Execute reasoning inside User A bounds
```

**Written Explanation**: The agent always starts entirely generic. It acts like an empty vessel until the `Plugin System` injects defining traits (Name, SOUL, localized skills). Once the identity transformation is complete, the framework enters a "listening" state, ready to apply its specialized Persona strictly within the isolated bounds of whatever User Memory context is passed to it dynamically on a per-request basis.

---

## Diagram B — Multi-User + Sub-Agent Architecture

This diagram demonstrates how the system isolates numerous users simultaneously, while allowing the core Orchestrator to spawn bounded, parallel sub-agents to execute a complex task cleanly.

```mermaid
flowchart TD
    %% Users
    subgraph Users [External Clients]
        UserA[User A]
        UserB[User B]
        UserN[User N]
    end

    %% Memory Layer
    subgraph MemSpace [Memory Segmentation]
        MemA[memory/users/User A/]
        MemB[memory/users/User B/]
        MemN[memory/users/User N/]
        SharedMem[memory/shared/Rules, RAG]
    end

    %% Agent Core
    subgraph AgentSystem [Base Framework Core]
        Identity["Specialist Persona (via Plugin)"]
        Router[Task Router & Orchestrator]
    end

    %% Sub-Agents (Workers)
    subgraph Workers [Isolated Sub-Agent Executions]
        Worker1[Worker 1<br/>Strict Output Contract]
        Worker2[Worker 2<br/>Strict Output Contract]
        Worker3[Worker 3<br/>Strict Output Contract]
    end

    %% Flow
    UserA -->|Task Request| MemA
    MemA --> Router
    
    UserB --> MemB
    UserN --> MemN
    
    SharedMem -.-> Router
    Identity -.-> Router
    
    Router -->|Decompose & Dispatch| Worker1
    Router -->|Decompose & Dispatch| Worker2
    Router -->|Decompose & Dispatch| Worker3
    
    Worker1 -->|Structured Result| Router
    Worker2 -->|Structured Result| Router
    Worker3 -->|Structured Result| Router
    
    Router -->|Synthesise Results| MemA
    MemA -->|Final Response| UserA
```

**Written Explanation**: 
The `Agent Core` is fully stateless between requests. When `User A` sends a message, they are routed through their isolated `MemSpace` (`/users/{User A}/`). The `Router` inherits the `Specialist Persona` shared system-wide. When solving the task, the `Router` acts as an Orchestrator: it decomposes the task and spawns parallel `Workers` in pristine context windows. The `Workers` return raw structured data. The `Router` synthesises this data and saves the final context strictly back to `User A`'s memory before delivering the result string to the user. User B and User N remain entirely unaffected and walled off.
