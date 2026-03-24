# System Overview Diagram

Visual map of the multi-agent system. Two specialist agents are shown:
the **Email Classifying Agent** and the **UK Payroll App Agent**.
Both are built by attaching a plugin to the same reusable base agent framework.

---

## Diagram 1 — The Core Idea: How a Plugin Creates a Specialist Agent

> The base agent has no name, no purpose, no identity. A plugin is attached at spawn time
> and transforms it into a specialist. The same base agent can be reused for any purpose.

```mermaid
flowchart LR
    subgraph BASE ["🏗️ Base Agent Framework"]
        direction TB
        CORE["Base Agent\n─────────────\n• No name\n• No role\n• No skills\n• Generalist SOUL"]
    end

    subgraph PLUGIN_A ["🔌 Plugin: email-classifier"]
        direction TB
        PA_SOUL["SOUL.md\n'You are a precision\nemail triage agent'"]
        PA_MAN["manifest.json\nid · name · role · skillsDir"]
        PA_SKL["skills/\nclassify-email\nparse-attachment"]
    end

    subgraph PLUGIN_B ["🔌 Plugin: uk-payroll-processor"]
        direction TB
        PB_SOUL["SOUL.md\n'You are a UK payroll\nprocessing specialist'"]
        PB_MAN["manifest.json\nid · name · role · skillsDir"]
        PB_SKL["skills/\nprocess-starter\nimport-timesheet\ncreate-task"]
    end

    subgraph PLUGIN_C ["🔌 Plugin: uk-payroll-app-agent"]
        direction TB
        PC_SOUL["SOUL.md\n'You are an expert guide\nfor the UK Payroll App'"]
        PC_MAN["manifest.json\nid · name · role · skillsDir"]
        PC_SKL["skills/\nrag-search · mcp-query\nlookup-error-code"]
    end

    subgraph RESULT_A ["✅ Specialist: Email Classifying Agent"]
        RA["Identity: from plugin SOUL.md\nSkills: classify-email · parse-attachment\nPurpose: triage incoming emails"]
    end

    subgraph RESULT_B ["✅ Specialist: UK Payroll Processor"]
        RB["Identity: from plugin SOUL.md\nSkills: process-starter · import-timesheet · create-task\nPurpose: call UK Payroll APIs"]
    end

    subgraph RESULT_C ["✅ Specialist: UK Payroll App Agent"]
        RC["Identity: from plugin SOUL.md\nSkills: rag-search · mcp-query · lookup-error-code\nPurpose: help users navigate the app"]
    end

    CORE -->|"attach plugin at spawn time"| PLUGIN_A --> RESULT_A
    CORE -->|"attach plugin at spawn time"| PLUGIN_B --> RESULT_B
    CORE -->|"attach plugin at spawn time"| PLUGIN_C --> RESULT_C
```

---

## Diagram 2 — What Is a Skill?

> A skill is a focused capability — usually one API call. It knows the endpoint,
> the request shape, and the response shape. The agent loads a skill on demand
> and uses it to do real work.

```mermaid
flowchart LR
    subgraph SK1 ["🛠️ Skill: process-starter"]
        direction TB
        SK1_DEF["SKILL.md\n─────────────────────\nname: process-starter\ndescription: Registers a new\n  starter via UK Payroll API\nallowed-tools: http-call"]
        SK1_API["API Contract\n─────────────────────\nPOST /api/starters\nBody: employeeId, startDate,\n  payFrequency, company\nReturns: starterRef, status"]
    end

    subgraph SK2 ["🛠️ Skill: import-timesheet"]
        direction TB
        SK2_DEF["SKILL.md\n─────────────────────\nname: import-timesheet\ndescription: Imports a parsed\n  timesheet file\nallowed-tools: http-call"]
        SK2_API["API Contract\n─────────────────────\nPOST /api/timesheets/import\nBody: company, payFrequency,\n  period, rows[]\nReturns: importId, rowsAccepted"]
    end

    subgraph SK3 ["🛠️ Skill: create-task"]
        direction TB
        SK3_DEF["SKILL.md\n─────────────────────\nname: create-task\ndescription: Creates a task for\n  unrecognised emails\nallowed-tools: http-call"]
        SK3_API["API Contract\n─────────────────────\nPOST /api/tasks\nBody: title, emailBody,\n  attachments[], sourceEmail\nReturns: taskId, taskUrl"]
    end

    AGENT["UK Payroll Processor\n(sub-agent)"]
    AGENT -->|"uses when: STARTER email"| SK1
    AGENT -->|"uses when: TIMESHEET email"| SK2
    AGENT -->|"uses when: TASK email"| SK3
```

---

## Diagram 3 — How a Sub-Agent Works (Lifecycle)

> The orchestrator spawns a sub-agent for each unit of work.
> The sub-agent runs in complete isolation, does one job, returns JSON, then stops.
> It never has a conversation — it just executes.

```mermaid
sequenceDiagram
    participant ORCH  as 🎯 Orchestrator<br/>(Email Classifying Agent)
    participant FW    as 🏗️ Base Agent Framework
    participant PLUG  as 🔌 Plugin Registry
    participant MEM   as 🧠 Memory Layer
    participant WORK  as ⚙️ Sub-Agent (Worker)
    participant API   as 🌐 UK Payroll API

    ORCH  ->> FW:   Spawn sub-agent: uk-payroll-processor
    Note over FW:   New isolated context window created
    FW    ->> PLUG: Load plugin: uk-payroll-processor
    PLUG  -->> FW:  SOUL.md + manifest.json + skills/
    FW    ->> MEM:  Bind userId context
    MEM   -->> FW:  memory/users/{userId}/session + long-term
    FW    -->> WORK: Worker is ready<br/>(identity + skills + memory bound)

    ORCH  ->> WORK: Inject task as structured prompt<br/>{ type: "STARTER", data: { employeeId, startDate, … } }
    Note over WORK: No conversation. No prose.<br/>Executes task only.
    WORK  ->> WORK: Load skill: process-starter
    WORK  ->> API:  POST /api/starters  { employeeId, startDate, … }
    API   -->> WORK: { starterRef: "S-001", status: "created" }
    WORK  -->> ORCH: Return strict JSON<br/>{ starterRef: "S-001", status: "created" }
    Note over WORK: Sub-agent context destroyed
```

---

## Diagram 4 — Full Email Processing Flow (Main Business Flow)

> An email arrives. The Email Classifying Agent (orchestrator) reads it and decides what type it is.
> It then spawns the UK Payroll Processor sub-agent with the right task.
> The sub-agent uses the matching skill to call the API and returns a result.

```mermaid
flowchart TD
    EMAIL["📧 Incoming Email\n──────────────────────────────\nFrom:    payroll@clientco.com\nSubject: New Starter — John Smith\nBody:    Start date 01/04/2026...\nAttachment: starter_form.pdf"]

    subgraph ECA ["🎯 Email Classifying Agent\n(Orchestrator)\nPlugin: email-classifier"]
        direction TB
        CLASSIFY["Skill: classify-email\n──────────────────────────\nReads: subject, body, sender,\n  attachment name & type\nOutputs: classification label\n  + extracted data"]

        DECISION{{"Classification\nResult"}}

        NOTE_D1["📋 Starter Email\n─────────────────────────────\nTriggers when:\n• Subject contains 'starter'\n• Attachment = starter form\n\nExtracted:\nemployeeId, startDate,\npayFrequency, company"]

        NOTE_D2["📋 Timesheet Email\n─────────────────────────────\nTriggers when:\n• Attachment = CSV/XLSX\n• Body mentions pay period\n\nExtracted:\ncompany, payFrequency,\nperiod dates, rows[]"]

        NOTE_D3["📋 Task Email\n─────────────────────────────\nTriggers when:\n• Does not match above\n• Needs human review\n\nExtracted:\ntitle from subject,\nfull email body + attachments"]
    end

    subgraph SPAWN ["🔄 Sub-Agent Spawn\n(orchestrator hands off work)"]
        direction TB
        SPAWN_NOTE["Base Agent Framework\nspawns new isolated context\n\nAttaches plugin:\nuk-payroll-processor\n\nInjects task as structured\nprompt (JSON, not prose)\n\nBinds userId memory"]
    end

    subgraph WORKER ["⚙️ UK Payroll Processor Sub-Agent\n(Worker)\nPlugin: uk-payroll-processor"]
        direction TB

        subgraph SKILLS ["Skills (loaded on demand — progressive disclosure)"]
            direction LR
            SK_S["🛠️ process-starter\n──────────────────\nPOST /api/starters\nReturns: starterRef"]
            SK_T["🛠️ import-timesheet\n──────────────────\nPOST /api/timesheets/import\nReturns: importId, rows"]
            SK_K["🛠️ create-task\n──────────────────\nPOST /api/tasks\nReturns: taskId, taskUrl"]
        end

        WORKER_EXEC["Executes chosen skill\n──────────────────────────\n• Calls API\n• Handles response\n• Returns strict JSON\n  (no prose, no markdown)"]
    end

    RESULT["📋 Orchestrator receives JSON result\n─────────────────────────────────────\nLogs outcome to memory/users/{userId}/session\nReturns structured summary to caller"]

    UMEM["🧠 memory/users/{userId}/\nsession/ · long-term/"]

    EMAIL --> CLASSIFY
    CLASSIFY --> DECISION

    DECISION -->|"STARTER"| NOTE_D1
    DECISION -->|"TIMESHEET"| NOTE_D2
    DECISION -->|"TASK"| NOTE_D3

    NOTE_D1 --> SPAWN
    NOTE_D2 --> SPAWN
    NOTE_D3 --> SPAWN

    SPAWN --> WORKER

    WORKER -->|"STARTER task injected"| SK_S
    WORKER -->|"TIMESHEET task injected"| SK_T
    WORKER -->|"TASK task injected"| SK_K

    SK_S --> WORKER_EXEC
    SK_T --> WORKER_EXEC
    SK_K --> WORKER_EXEC

    WORKER_EXEC -->|"JSON result"| RESULT
    RESULT --> UMEM
```

---

## Diagram 5 — UK Payroll App Agent (Separate Agent — UI Assistance)

> This agent is completely separate from the email pipeline.
> Users ask questions about the app and it helps them navigate and understand it,
> using a knowledge base (RAG) and live app context (MCP).

```mermaid
flowchart TD
    USER_Q["💬 User Question\n──────────────────────────────────\n'Where do I find the P60 report?'\n'What does error E-104 mean?'\n'How do I add a new employee?'"]

    subgraph PAA ["🎯 UK Payroll App Agent\n(Orchestrator)\nPlugin: uk-payroll-app-agent"]
        direction TB

        INTENT["Understand intent\n──────────────────────────────\n• Navigation question?\n• Error explanation?\n• How-to guide?"]

        subgraph PARALLEL ["Parallel Sub-Agent Dispatch\n(both run at the same time)"]
            direction LR

            subgraph SA1 ["⚙️ Sub-Agent: screen-context-reader"]
                direction TB
                SA1_DESC["Skill: mcp-query\n──────────────────────\nQueries MCP server for:\n• Current screen name\n• Active record\n• Visible fields\nReturns: { screen, record }"]
            end

            subgraph SA2 ["⚙️ Sub-Agent: knowledge-retriever"]
                direction TB
                SA2_DESC["Skill: rag-search\n──────────────────────\nSemantic search over:\n• App documentation\n• HMRC guides\n• Error catalogue\n• Release notes\nReturns: [{ snippet, source }]"]
            end
        end

        COMPOSE["⚙️ Sub-Agent: answer-composer\n──────────────────────────────────────\nCombines: screen context + doc snippets\nFormats: step-by-step if navigational\n          plain explanation if conceptual\nReturns: { answer, sources, steps[] }"]

        DELIVER["📋 Orchestrator delivers answer\nSaves Q&A to user long-term memory\nUpdates shared KB if new learning"]
    end

    subgraph KB ["📚 Knowledge Sources"]
        direction LR
        RAG_STORE["RAG / Vector Store\nmemory/shared/long-term/\n──────────────────────\nApp docs · HMRC guides\nError catalogue · FAQs"]
        MCP_SRV["MCP Server\n(live app context)\n──────────────────────\nCurrent screen state\nActive record data\nUser permissions"]
    end

    UMEM2["🧠 memory/users/{userId}/\nlong-term/ · session/ · preferences/"]

    USER_Q --> INTENT
    INTENT --> PARALLEL
    SA1 & SA2 --> COMPOSE
    COMPOSE --> DELIVER
    DELIVER --> UMEM2

    MCP_SRV -.->|"live context"| SA1
    RAG_STORE -.->|"doc search"| SA2
```

---

## Diagram 6 — Multi-User Isolation

> Multiple users can use the system at the same time.
> Each user's memory is completely isolated. No user can ever see another user's data.
> Only shared rules and the shared knowledge base are accessible by all users.

```mermaid
flowchart TD
    subgraph REQUESTS ["Simultaneous Requests"]
        direction LR
        R1["User A\n'Process this starter email'"]
        R2["User B\n'Where is the P60 screen?'"]
        R3["User C\n'Import these timesheets'"]
    end

    GW["🚪 Gateway / Router\n─────────────────────────────\nAttaches userId to every request\nRoutes to correct plugin\nEnforces authentication"]

    subgraph ISOLATED ["🔒 Isolated User Contexts — strictly no cross-access"]
        direction LR

        subgraph UA ["User A"]
            direction TB
            UA_MEM["memory/users/user-a/\nsession/ · long-term/\npreferences/"]
            UA_AGT["Email Classifying Agent\n(Plugin: email-classifier)\nSpawns: uk-payroll-processor\nsub-agent bound to user-a"]
        end

        subgraph UB ["User B"]
            direction TB
            UB_MEM["memory/users/user-b/\nsession/ · long-term/\npreferences/"]
            UB_AGT["UK Payroll App Agent\n(Plugin: uk-payroll-app-agent)\nSub-agents bound to user-b"]
        end

        subgraph UC ["User C"]
            direction TB
            UC_MEM["memory/users/user-c/\nsession/ · long-term/\npreferences/"]
            UC_AGT["Email Classifying Agent\n(Plugin: email-classifier)\nSpawns: uk-payroll-processor\nsub-agent bound to user-c"]
        end
    end

    SHARED["📚 memory/shared/\n──────────────────────────────────\nrules/      ← system-wide operational rules\nlong-term/  ← shared RAG / knowledge base\n(read-only — no user data ever written here)"]

    R1 --> GW
    R2 --> GW
    R3 --> GW

    GW -->|"userId = user-a"| UA
    GW -->|"userId = user-b"| UB
    GW -->|"userId = user-c"| UC

    SHARED -.->|"shared knowledge\n(read only)"| UA
    SHARED -.->|"shared knowledge\n(read only)"| UB
    SHARED -.->|"shared knowledge\n(read only)"| UC

    UA_MEM -.->|"❌ NO ACCESS"| UB_MEM
    UB_MEM -.->|"❌ NO ACCESS"| UC_MEM
```

---

## Diagram 7 — Complete Picture: Everything Together

```mermaid
flowchart TD
    subgraph USERS ["👥 Users"]
        direction LR
        U1["User A\nPayroll Ops"]
        U2["User B\nApp User"]
    end

    GW2["🚪 Gateway\nAttach userId · Route · Auth"]

    subgraph FW ["🏗️ Base Agent Framework (Reusable Core)"]
        direction LR
        BASE2["Base Agent\n(no identity)"]
        PREG["Plugin Registry\nplugins/ directory"]
        SREG["Sub-Agent Registry\n.agents/subagents/"]
        BASE2 --- PREG
        BASE2 --- SREG
    end

    subgraph EMAIL_PIPELINE ["📧 Email Pipeline (User A)"]
        direction TB

        subgraph ORCH_ECA ["🎯 Email Classifying Agent\nPlugin: email-classifier"]
            SKILL_CLS["Skill: classify-email"]
        end

        subgraph WORKER_PP ["⚙️ UK Payroll Processor Sub-Agent\nPlugin: uk-payroll-processor\n(spawned by orchestrator · isolated context)"]
            direction LR
            W_SK1["Skill: process-starter"]
            W_SK2["Skill: import-timesheet"]
            W_SK3["Skill: create-task"]
        end

        SKILL_CLS -->|"classified · task injected as JSON"| WORKER_PP
        WORKER_PP -->|"result JSON · context destroyed"| SKILL_CLS
    end

    subgraph APP_PIPELINE ["🖥️ App Assistance (User B)"]
        direction TB

        subgraph ORCH_APP ["🎯 UK Payroll App Agent\nPlugin: uk-payroll-app-agent"]
            direction LR
            APP_SK1["Sub-Agent:\nscreen-context-reader\n(Skill: mcp-query)"]
            APP_SK2["Sub-Agent:\nknowledge-retriever\n(Skill: rag-search)"]
            APP_SK3["Sub-Agent:\nanswer-composer"]
        end
    end

    subgraph MEM_LAYER ["🧠 Memory Layer"]
        direction LR
        MA2["memory/users/user-a/\n(isolated)"]
        MB2["memory/users/user-b/\n(isolated)"]
        SH2["memory/shared/\nrules/ · long-term/\n(read-only)"]
    end

    PAYROLL_API["🌐 UK Payroll App API\n/api/starters\n/api/timesheets/import\n/api/tasks"]
    MCP2["🔗 MCP Server\n(live screen context)"]
    RAG2["📚 RAG Store\n(app docs · HMRC guides)"]

    U1 -->|"email + userId"| GW2
    U2 -->|"question + userId"| GW2

    GW2 --> FW

    FW -->|"spawn + attach plugin: email-classifier"| ORCH_ECA
    FW -->|"spawn + attach plugin: uk-payroll-app-agent"| ORCH_APP

    ORCH_ECA <--> MA2
    ORCH_APP <--> MB2
    SH2 -.-> ORCH_ECA
    SH2 -.-> ORCH_APP

    WORKER_PP -->|"API calls"| PAYROLL_API
    APP_SK1 <-->|"live context"| MCP2
    APP_SK2 <-->|"semantic search"| RAG2
```

---

## Summary: Key Concepts at a Glance

| Concept | What it is | Where it lives |
|---|---|---|
| **Base Agent** | Reusable framework with no identity — a blank slate | `src/core/` |
| **Plugin** | Specialisation package: SOUL + manifest + skills. Attached at spawn time. | `plugins/{name}/` |
| **SOUL.md** | Defines the agent's persona, tone, hard rules, and purpose | `plugins/{name}/SOUL.md` |
| **Skill** | One focused capability — usually one API call. Loaded on demand. | `plugins/{name}/skills/{skill}/SKILL.md` |
| **Orchestrator** | The agent that receives the task, decides what to do, spawns sub-agents | Any agent when acting as coordinator |
| **Sub-Agent (Worker)** | Spawned by orchestrator. Isolated context. Executes one task. Returns JSON only. | `.agents/subagents/{name}.yaml` |
| **Sub-Agent Plugin** | The worker is also a base agent with a plugin attached — same pattern | `plugins/{name}/` |
| **User Memory** | Fully isolated per user — session, long-term, preferences | `memory/users/{userId}/` |
| **Shared Memory** | Rules and knowledge base readable by all users (read-only) | `memory/shared/` |
| **MCP Server** | Provides live screen/record context to the App Agent | External sidecar process |
| **RAG Store** | Semantic search over app docs, HMRC guides, error catalogue | `memory/shared/long-term/` + vector DB |

### The One Rule That Ties It All Together

> **Plugin = Identity.** A base agent without a plugin is nothing.
> A base agent with a plugin is a specialist.
> Every agent in this system — orchestrators and workers alike — is a base agent with a plugin attached.
