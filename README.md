# Sniper Sharp Agent

A generic, plugin-driven AI agent framework. The backend exposes a LangGraph supervisor graph that classifies incoming messages and routes them to specialist sub-agents. The React frontend lets you chat with agents, manage providers, skills, and routing rules — all without touching config files.

---

## What's Running

| Layer | Tech | Status |
|---|---|---|
| Backend API | Python 3.10+, FastAPI, LangGraph, SQLAlchemy | ✅ Phases 1–6 complete, 58 tests passing |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4 | ✅ Phase UI-1 complete |
| Database | SQLite (file-based, auto-created) | ✅ Alembic migrations |

---

## Combined Start (Recommended)

If you've already set up your backend virtual environment and installed UI dependencies, you can start both in one go:

### Option 1: PowerShell Script (Windows)

Launch both in separate, auto-focusing windows:

```powershell
.\start-dev.ps1
```

### Option 2: NPM (Cross-platform)

Launch both in a single terminal session (logs will be interleaved):

```bash
# First time only (installs concurrently)
npm install

# Start both
npm run dev
```

---

## Quick Start (Manual)

You need **two terminals** — one for the backend, one for the frontend.

### Terminal 1 — Backend

```bash
cd backend

# 1. Create and activate a virtual environment
python -m venv venv

# Windows
.\venv\Scripts\Activate

# macOS / Linux
source venv/bin/activate

# 2. Install all dependencies
pip install -r requirements.txt

# 3. Seed the database with starter agents and skills
python seed.py

# 4. Start the API server (port 8000, auto-reload on save)
uvicorn main:app --reload --port 8000
```

The backend is ready when you see:
```
INFO:     Application startup complete.
```

Verify it's healthy:
```bash
curl http://localhost:8000/api/health
# → {"status":"ok","graph_compiled":true}
```

`graph_compiled: true` means the LangGraph supervisor loaded the seeded agents successfully.

---

### Terminal 2 — Frontend

```bash
cd ui

# 1. Install Node dependencies
npm install

# 2. Start the Vite dev server (port 5173)
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Using the App

### Chat (default view `/`)

1. Select an agent from the dropdown — `EmailClassifier ★` is the supervisor
2. Press **New Session** to start a conversation
3. Type a message and press **Enter** or **Send**
4. Each assistant reply shows an **intent badge** (e.g. `starter-processing`) indicating which routing rule matched

The sidebar footer shows a live **Graph ready** / **Graph not compiled** indicator.

### Providers (`/providers`)

Add LLM providers before creating agents. Supported types:

| Type | Credentials needed |
|---|---|
| `anthropic-api-key` | Anthropic API key |
| `anthropic-setup-auth` | None — uses local `claude` CLI OAuth token |
| `openai-api-key` | OpenAI API key |
| `openai-codex-oauth` | None — uses local Codex OAuth token |
| `google-api-key` | Google AI API key |
| `custom-url` | Base URL (Ollama, LM Studio, etc.) |

The seed script pre-creates one provider (`anthropic-setup-auth`, `claude-opus-4-6`). To use a different provider, add one here then re-assign agents to it via the API.

### Agents, Skills, Routing Rules

Management views for Agents, Skills, and Routing Rules are stubs — they display "Coming in Phase UI-2/3". Use the REST API directly in the meantime:

```bash
# List agents
curl http://localhost:8000/api/agents | python -m json.tool

# List skills
curl http://localhost:8000/api/skills | python -m json.tool

# List routing rules
curl http://localhost:8000/api/routing-rules | python -m json.tool
```

---

## Seeded Data

`backend/seed.py` is idempotent — safe to run multiple times. It creates:

| Type | Name | Role |
|---|---|---|
| Provider | Anthropic Setup Auth | `anthropic-setup-auth`, `claude-opus-4-6` |
| Agent | EmailClassifier | Supervisor — classifies intent |
| Agent | PayrollWorker | Specialist — handles payroll tasks |
| Skill | classify-email | Attached to EmailClassifier |
| Skill | process-starter | Attached to PayrollWorker |
| Skill | import-timesheet | Attached to PayrollWorker |
| Skill | create-task | Attached to PayrollWorker |
| Skill | http-call | Attached to PayrollWorker |
| Routing Rule | starter-processing → PayrollWorker | Priority 1 |
| Routing Rule | timesheet-import → PayrollWorker | Priority 2 |
| Routing Rule | task-creation → PayrollWorker | Priority 3 |
| Routing Rule | FALLBACK → EmailClassifier | Priority 99 |

---

## Running Tests (Backend)

```bash
cd backend
pytest -v
# 58 tests, all passing
```

---

## Project Structure

```
backend/               Python FastAPI + LangGraph backend
  main.py              FastAPI app entry point
  seed.py              Idempotent DB seeder
  config.py            Env vars (DB_PATH, PORT, HOOK_TIMEOUT_SECONDS)
  db/                  SQLAlchemy ORM models + Alembic migrations
  api/                 REST route handlers (providers, agents, skills, chat…)
  graph/               LangGraph: state, classifier, specialist, supervisor, registry
  providers/           LangChain LLM factory (6 provider types)
  skills/              Sandboxed skill executor → LangChain Tools
  tests/               pytest test suite

ui/                    React 19 + Vite + TypeScript + Tailwind CSS 4 frontend
  src/
    api/client.ts      Typed fetch wrappers for all 27 backend endpoints
    components/        Layout, Sidebar
    views/             ChatView, ProvidersView (+ stubs for Agents/Skills/Routing/System)

docs/                  Architecture docs, plans, roadmap
  ROADMAP.md           Phase-by-phase task status
  CONVENTIONS.md       Authoritative implementation rules
  superpowers/plans/   Detailed implementation plans per phase
```

---

## Environment Variables (optional)

Create `backend/.env` to override defaults:

```env
DB_PATH=./agent_framework.db        # SQLite file path
PORT=8000                           # API server port
HOOK_TIMEOUT_SECONDS=5              # Config hook timeout
```

---

## What's Next

| Phase | Track | Description |
|---|---|---|
| UI-2 | Frontend | AgentsView — full CRUD + skill attachment |
| UI-3 | Frontend | SkillsView + RoutingRulesView |
| UI-4 | Frontend | System dashboard + graph rebuild button |
| 7 | Backend | Memory system — ChromaDB RAG, per-user memories |
| 8 | Backend | Email classification pipeline end-to-end |
| 9 | Backend | Config hook — dynamic persona injection |
| 10 | Backend | Integration + load tests |

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for full status.
