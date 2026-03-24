# Proposed Architecture Diagrams

## Diagram A — Plugin Lifecycle: Base Agent → Specialist

This diagram shows how the base framework initialises as a Generalist, detects an attached plugin,
mutates its identity, and handles a user request as a Specialist.
**This same lifecycle applies to every agent in the system — orchestrators and workers alike.**

```mermaid
sequenceDiagram
    participant Boot   as System Boot
    participant Base   as Base Agent (Generalist)
    participant Plugin as Plugin Registry
    participant Memory as User Context Layer

    Boot  ->> Base:   Start Framework
    Base  ->> Base:   Load Core Skills (read_file, http_call, bash…)
    Base  ->> Base:   Load default generalist SOUL.md
    Base  ->> Plugin: Scan plugins/ directory

    alt Plugin Found (e.g. email-classifier)
        Plugin -->> Base: manifest.json  →  id, name, role
        Plugin -->> Base: SOUL.md        →  override persona & behavioural rules
        Plugin -->> Base: skills/        →  register domain skills (progressive disclosure)
        Base  ->> Base:   STATE CHANGE: Generalist → Specialist
        Note over Base: Agent is now "Email Classifying Agent"
    end

    Note over Base: Waiting for a request…

    Boot  ->> Memory: Incoming Request (userId = "user-a")
    Memory -->> Base: Attach memory/users/user-a/ bounds
    Base  ->> Base:   Load user-a session + preferences/skills/ overrides
    Note over Base: Ready — operating inside User A's isolated context
```

**Written Explanation**: The agent always starts entirely generic — an empty vessel.
The Plugin Registry injects defining traits (name, SOUL, localised skills).
Once the identity transformation is complete, the agent enters a ready state,
strictly within the isolated bounds of whatever `userId` context is passed on each request.
**Workers follow this exact same lifecycle** — the orchestrator spawns a fresh base agent
and attaches the appropriate plugin before injecting the task.

---

## Diagram B — Workers are also Base Agents + Plugins

This diagram clarifies the key architectural principle: **there is no special "worker agent type".**
A worker sub-agent is simply a base agent with a plugin attached, running in an isolated context window.

```mermaid
flowchart LR
    subgraph ORCHESTRATOR ["🎯 Orchestrator\n(Base Agent + email-classifier plugin)"]
        ORCH["Classifies email\nDecides which worker to spawn\nSynthesises result"]
    end

    subgraph SPAWN ["🔄 Spawn: base agent + uk-payroll-processor plugin"]
        direction TB
        BASE_W["Base Agent\n(blank slate)"]
        PLUG_W["Plugin: uk-payroll-processor\nSOUL.md · manifest.json · skills/"]
        WORKER["UK Payroll Processor\n(specialised worker)"]
        BASE_W -->|"plugin attached"| PLUG_W --> WORKER
    end

    subgraph SKILLS ["Skills available to worker"]
        direction LR
        SK1["process-starter\n(POST /api/starters)"]
        SK2["import-timesheet\n(POST /api/timesheets/import)"]
        SK3["create-task\n(POST /api/tasks)"]
    end

    ORCH -->|"spawn + inject task as JSON"| SPAWN
    WORKER -->|"loads skill on demand"| SKILLS
    SKILLS -->|"API call + result"| WORKER
    WORKER -->|"returns strict JSON\ncontext destroyed"| ORCH
```

**Written Explanation**: The orchestrator spawns the worker exactly like any agent is spawned —
base agent + plugin. The plugin gives the worker its identity and skills.
The worker executes, calls the API via its skill, and returns **only JSON** to the orchestrator.
Then the worker's context window is destroyed. There is no persistent worker process.

---

## Diagram C — Multi-User + Sub-Agent Architecture

This diagram shows how the system isolates multiple users simultaneously, while allowing the
orchestrator to spawn worker sub-agents to execute tasks in parallel or sequentially.

```mermaid
flowchart TD
    %% Users
    subgraph Users ["👥 External Users"]
        UserA[User A]
        UserB[User B]
        UserN[User N]
    end

    %% Gateway
    GW["🚪 Gateway / Router\nAttaches userId · Routes to plugin · Enforces auth"]

    %% Memory Layer
    subgraph MemSpace ["🧠 Memory Segmentation"]
        MemA["memory/users/user-a/\nsession/ · long-term/ · preferences/"]
        MemB["memory/users/user-b/\nsession/ · long-term/ · preferences/"]
        SharedMem["memory/shared/\nrules/ · long-term/ (read-only)"]
    end

    %% Agent Core
    subgraph AgentSystem ["🏗️ Base Agent Framework"]
        direction LR
        PluginReg["Plugin Registry\nplugins/ directory"]
        Orchestrator["Orchestrator\n(base agent + active plugin)"]
    end

    %% Sub-Agents (Workers)
    subgraph Workers ["⚙️ Worker Sub-Agents\n(each = base agent + plugin, isolated context)"]
        direction LR
        Worker1["Worker 1\nbase agent + uk-payroll-processor\n→ strict JSON output"]
        Worker2["Worker 2\nbase agent + uk-payroll-processor\n→ strict JSON output"]
        Worker3["Worker 3\nbase agent + uk-payroll-processor\n→ strict JSON output"]
    end

    %% Flow
    UserA -->|"request + userId"| GW
    UserB -->|"request + userId"| GW
    UserN -->|"request + userId"| GW

    GW -->|"userId=user-a → bind MemA"| MemA
    GW -->|"userId=user-b → bind MemB"| MemB

    MemA --> Orchestrator
    PluginReg -->|"inject SOUL + skills"| Orchestrator
    SharedMem -.->|"shared rules & RAG\n(read-only)"| Orchestrator

    Orchestrator -->|"parallel or sequential dispatch"| Worker1
    Orchestrator --> Worker2
    Orchestrator --> Worker3

    Worker1 -->|"{ status, result }"| Orchestrator
    Worker2 -->|"{ status, result }"| Orchestrator
    Worker3 -->|"{ status, result }"| Orchestrator

    Orchestrator -->|"synthesise + save to MemA"| MemA
    MemA -->|"final response"| UserA
```

**Written Explanation**:
The `Base Agent Framework` is fully stateless between requests. When `User A` sends a message,
they are routed through their isolated memory (`/users/user-a/`). The `Orchestrator` inherits
its specialist persona from the active plugin. When solving the task, it decomposes and spawns
`Workers` in pristine context windows — each worker is also a base agent with a plugin attached.
Workers return raw structured JSON. The Orchestrator synthesises and saves the final context
strictly to `User A`'s memory. User B and User N remain entirely walled off.

---

## Diagram D — Email Processing Pipeline (End-to-End)

This diagram shows the full email classification and processing flow using the concrete business case.

```mermaid
flowchart TD
    EMAIL["📧 Incoming Email\n(subject · body · attachments)"]

    subgraph ECA ["🎯 Email Classifying Agent\nBase Agent + Plugin: email-classifier"]
        CLASSIFY["Skill: classify-email\nReads subject, body, attachments\nOutputs: STARTER | TIMESHEET | TASK"]
        DECISION{{"Classification\nResult"}}
    end

    subgraph SPAWN_BLOCK ["🔄 Orchestrator Spawns Worker Sub-Agent\nBase Agent + Plugin: uk-payroll-processor\n(fresh isolated context, userId bound)"]
        direction LR
        TASK_IN["Task injected as JSON\n{ type, data }"]
    end

    subgraph WORKER ["⚙️ UK Payroll Processor\n(Worker Sub-Agent)"]
        direction TB
        SK_S["Skill: process-starter\nPOST /api/starters"]
        SK_T["Skill: import-timesheet\nPOST /api/timesheets/import"]
        SK_K["Skill: create-task\nPOST /api/tasks"]
    end

    RESULT["📋 Orchestrator receives JSON\nLogs to memory/users/{userId}/\nReturns summary to caller"]

    EMAIL --> CLASSIFY
    CLASSIFY --> DECISION
    DECISION -->|"STARTER"| SPAWN_BLOCK
    DECISION -->|"TIMESHEET"| SPAWN_BLOCK
    DECISION -->|"TASK"| SPAWN_BLOCK

    SPAWN_BLOCK --> TASK_IN
    TASK_IN -->|"type=STARTER"| SK_S
    TASK_IN -->|"type=TIMESHEET"| SK_T
    TASK_IN -->|"type=TASK"| SK_K

    SK_S --> RESULT
    SK_T --> RESULT
    SK_K --> RESULT
```
