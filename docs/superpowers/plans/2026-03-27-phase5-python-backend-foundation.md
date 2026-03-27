# Phase 5: Python Backend Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stub `backend/main.py` with a production-ready FastAPI backend — SQLite database with all 7 ORM tables, Alembic setup, provider factory for 6 LangChain provider types, and full CRUD API for providers, agents, skills, routing rules, and sessions.

**Architecture:** SQLAlchemy 2.0 ORM with SQLite (single file, zero infrastructure). FastAPI routers split by resource. Provider factory maps DB rows to LangChain LLM instances. All CRUD mutations stub a `rebuild()` call that Phase 6 wires to the LangGraph registry. Tables are created at startup via `Base.metadata.create_all()`. Alembic is initialised for future schema migrations.

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy 2.0 (`mapped_column` style), Alembic, LangChain (langchain-anthropic, langchain-openai, langchain-google-genai), pytest, httpx (via FastAPI TestClient)

---

## File Map

**Create:**
- `backend/requirements.txt`
- `backend/pyproject.toml` — pytest config
- `backend/config.py`
- `backend/db/__init__.py`
- `backend/db/models.py` — 7 ORM models
- `backend/db/database.py` — engine, session factory, `get_db`
- `backend/providers/__init__.py`
- `backend/providers/factory.py`
- `backend/providers/anthropic_api_key.py`
- `backend/providers/anthropic_setup_auth.py`
- `backend/providers/openai_api_key.py`
- `backend/providers/openai_codex_oauth.py`
- `backend/providers/google_api_key.py`
- `backend/providers/custom_url.py`
- `backend/api/__init__.py`
- `backend/api/providers.py`
- `backend/api/agents.py`
- `backend/api/skills.py`
- `backend/api/routing_rules.py`
- `backend/api/sessions.py`
- `backend/api/system.py`
- `backend/graph/__init__.py` — stub only (Phase 6 fills this)
- `backend/graph/registry.py` — stub `GraphRegistry` with no-op `rebuild()`
- `backend/tests/__init__.py`
- `backend/tests/conftest.py`
- `backend/tests/test_models.py`
- `backend/tests/test_providers_factory.py`
- `backend/tests/test_api_providers.py`
- `backend/tests/test_api_skills.py`
- `backend/tests/test_api_agents.py`
- `backend/tests/test_api_routing_rules.py`
- `backend/tests/test_api_sessions.py`
- `backend/tests/test_api_system.py`

**Modify:**
- `backend/main.py` — replace stub with full FastAPI app

---

## Task 1: Project Setup

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pyproject.toml`
- Create: `backend/config.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Write `backend/requirements.txt`**

```
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
pydantic>=2.0.0
sqlalchemy>=2.0.0
alembic>=1.14.0
langchain>=0.3.0
langchain-anthropic>=0.3.0
langchain-openai>=0.2.0
langchain-google-genai>=2.0.0
langgraph>=0.2.0
chromadb>=0.6.0
httpx>=0.28.0
python-dotenv>=1.0.0
pytest>=8.0.0
pytest-asyncio>=0.24.0
```

- [ ] **Step 2: Write `backend/pyproject.toml`**

```toml
[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
asyncio_mode = "auto"
```

- [ ] **Step 3: Write `backend/config.py`**

```python
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.getenv("DB_PATH", str(Path(__file__).parent / "agent_framework.db"))
PORT = int(os.getenv("PORT", "8000"))
HOOK_TIMEOUT_SECONDS = int(os.getenv("HOOK_TIMEOUT_SECONDS", "5"))
```

- [ ] **Step 4: Create `backend/tests/__init__.py`** (empty file)

- [ ] **Step 5: Write `backend/tests/conftest.py`**

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from db.models import Base
from db.database import get_db
from main import app


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
```

- [ ] **Step 6: Install dependencies**

```bash
cd backend
pip install -r requirements.txt
```

Expected: All packages install without error.

- [ ] **Step 7: Commit**

```bash
cd backend
git add requirements.txt pyproject.toml config.py tests/__init__.py tests/conftest.py
git commit -m "chore(backend): project setup — requirements, config, test infrastructure"
```

---

## Task 2: Database Models

**Files:**
- Create: `backend/db/__init__.py`
- Create: `backend/db/models.py`
- Create: `backend/db/database.py`
- Create: `backend/tests/test_models.py`

- [ ] **Step 1: Write failing test `backend/tests/test_models.py`**

```python
from sqlalchemy import create_engine, inspect
from db.models import Base, Provider, Agent, Skill, AgentSkill, RoutingRule, Session, Memory


def test_all_tables_created():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    assert tables == {"providers", "agents", "skills", "agent_skills", "routing_rules", "sessions", "memories"}


def test_provider_columns():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    inspector = inspect(engine)
    cols = {c["name"] for c in inspector.get_columns("providers")}
    assert {"id", "name", "type", "credentials", "model", "is_default", "created_at"} <= cols


def test_agent_columns():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    inspector = inspect(engine)
    cols = {c["name"] for c in inspector.get_columns("agents")}
    assert {
        "id", "name", "persona", "rules", "provider_id", "is_supervisor",
        "memory_enabled", "memory_types", "config_hook_url", "config_hook_secret", "created_at"
    } <= cols


def test_memories_columns():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    inspector = inspect(engine)
    cols = {c["name"] for c in inspector.get_columns("memories")}
    assert {"id", "agent_id", "user_id", "type", "name", "description", "content", "chroma_id"} <= cols
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend
pytest tests/test_models.py -v
```

Expected: `ModuleNotFoundError: No module named 'db'`

- [ ] **Step 3: Create `backend/db/__init__.py`** (empty file)

- [ ] **Step 4: Write `backend/db/models.py`**

```python
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, MappedColumn, mapped_column, relationship
from sqlalchemy.types import JSON


def _uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    credentials: Mapped[dict] = mapped_column(JSON, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    agents: Mapped[list["Agent"]] = relationship("Agent", back_populates="provider")


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    persona: Mapped[str] = mapped_column(String, nullable=False)
    rules: Mapped[str | None] = mapped_column(String, nullable=True)
    provider_id: Mapped[str] = mapped_column(String, ForeignKey("providers.id"), nullable=False)
    is_supervisor: Mapped[bool] = mapped_column(Boolean, default=False)
    memory_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    memory_types: Mapped[list] = mapped_column(
        JSON, default=lambda: ["user", "feedback", "project", "reference"]
    )
    config_hook_url: Mapped[str | None] = mapped_column(String, nullable=True)
    config_hook_secret: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    provider: Mapped["Provider"] = relationship("Provider", back_populates="agents")
    skills: Mapped[list["Skill"]] = relationship(
        "Skill", secondary="agent_skills", back_populates="agents"
    )
    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="agent")
    memories: Mapped[list["Memory"]] = relationship("Memory", back_populates="agent")


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    input_schema: Mapped[dict] = mapped_column(JSON, nullable=False)
    implementation: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    agents: Mapped[list["Agent"]] = relationship(
        "Agent", secondary="agent_skills", back_populates="skills"
    )


class AgentSkill(Base):
    __tablename__ = "agent_skills"

    agent_id: Mapped[str] = mapped_column(
        String, ForeignKey("agents.id"), primary_key=True
    )
    skill_id: Mapped[str] = mapped_column(
        String, ForeignKey("skills.id"), primary_key=True
    )


class RoutingRule(Base):
    __tablename__ = "routing_rules"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    supervisor_id: Mapped[str] = mapped_column(
        String, ForeignKey("agents.id"), nullable=False
    )
    intent_label: Mapped[str] = mapped_column(String, nullable=False)
    target_agent_id: Mapped[str] = mapped_column(
        String, ForeignKey("agents.id"), nullable=False
    )
    priority: Mapped[int] = mapped_column(Integer, default=0)


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    agent_id: Mapped[str] = mapped_column(
        String, ForeignKey("agents.id"), nullable=False
    )
    history: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    agent: Mapped["Agent"] = relationship("Agent", back_populates="sessions")


class Memory(Base):
    __tablename__ = "memories"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    agent_id: Mapped[str] = mapped_column(
        String, ForeignKey("agents.id"), nullable=False
    )
    user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(String, nullable=False)
    chroma_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    agent: Mapped["Agent"] = relationship("Agent", back_populates="memories")
```

- [ ] **Step 5: Write `backend/db/database.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from config import DB_PATH
from db.models import Base

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Create all tables if they do not exist."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency: yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
cd backend
pytest tests/test_models.py -v
```

Expected:
```
PASSED tests/test_models.py::test_all_tables_created
PASSED tests/test_models.py::test_provider_columns
PASSED tests/test_models.py::test_agent_columns
PASSED tests/test_models.py::test_memories_columns
```

- [ ] **Step 7: Commit**

```bash
cd backend
git add db/__init__.py db/models.py db/database.py tests/test_models.py
git commit -m "feat(backend): SQLAlchemy ORM models — 7 tables (providers, agents, skills, agent_skills, routing_rules, sessions, memories)"
```

---

## Task 3: Alembic Setup

**Files:**
- Create: `backend/db/migrations/` (via `alembic init`)
- Modify: `backend/alembic.ini`
- Modify: `backend/db/migrations/env.py`

- [ ] **Step 1: Initialise Alembic**

```bash
cd backend
alembic init db/migrations
```

Expected: Creates `alembic.ini` and `db/migrations/` directory with `env.py`, `script.py.mako`, `versions/`.

- [ ] **Step 2: Edit `backend/alembic.ini` — set DB URL**

Find the line:
```
sqlalchemy.url = driver://user:pass@localhost/dbname
```
Replace with:
```
sqlalchemy.url = sqlite:///agent_framework.db
```

- [ ] **Step 3: Edit `backend/db/migrations/env.py` — import models so autogenerate works**

At the top of `env.py`, after the existing imports, add:
```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))  # adds backend/ to path

from db.models import Base  # noqa: E402
```

Find the line:
```python
target_metadata = None
```
Replace with:
```python
target_metadata = Base.metadata
```

- [ ] **Step 4: Generate initial migration**

```bash
cd backend
alembic revision --autogenerate -m "initial schema"
```

Expected: Creates `db/migrations/versions/<hash>_initial_schema.py` with all 7 tables in `upgrade()`.

- [ ] **Step 5: Verify the migration file lists all tables**

Open the generated file and confirm `upgrade()` contains `op.create_table("providers", ...)`, `op.create_table("agents", ...)`, etc. for all 7 tables.

- [ ] **Step 6: Commit**

```bash
cd backend
git add alembic.ini db/migrations/
git commit -m "chore(backend): Alembic setup with initial schema migration"
```

---

## Task 4: Provider Factory

**Files:**
- Create: `backend/providers/__init__.py`
- Create: `backend/providers/factory.py`
- Create: `backend/providers/anthropic_api_key.py`
- Create: `backend/providers/anthropic_setup_auth.py`
- Create: `backend/providers/openai_api_key.py`
- Create: `backend/providers/openai_codex_oauth.py`
- Create: `backend/providers/google_api_key.py`
- Create: `backend/providers/custom_url.py`
- Create: `backend/tests/test_providers_factory.py`

- [ ] **Step 1: Write failing tests `backend/tests/test_providers_factory.py`**

```python
import pytest
from unittest.mock import patch, MagicMock
from providers.factory import provider_factory
from db.models import Provider


def _make_provider(type_: str, credentials: dict, model: str = "test-model") -> Provider:
    p = Provider()
    p.id = "test-id"
    p.name = "Test"
    p.type = type_
    p.credentials = credentials
    p.model = model
    p.is_default = False
    return p


def test_anthropic_api_key_returns_chat_anthropic():
    provider = _make_provider("anthropic-api-key", {"api_key": "sk-test"}, "claude-3-5-sonnet-20241022")
    with patch("providers.anthropic_api_key.ChatAnthropic") as mock_cls:
        mock_cls.return_value = MagicMock()
        llm = provider_factory(provider)
        mock_cls.assert_called_once_with(model="claude-3-5-sonnet-20241022", api_key="sk-test")


def test_openai_api_key_returns_chat_openai():
    provider = _make_provider("openai-api-key", {"api_key": "sk-openai"}, "gpt-4o")
    with patch("providers.openai_api_key.ChatOpenAI") as mock_cls:
        mock_cls.return_value = MagicMock()
        llm = provider_factory(provider)
        mock_cls.assert_called_once_with(model="gpt-4o", api_key="sk-openai")


def test_google_api_key_returns_chat_google():
    provider = _make_provider("google-api-key", {"api_key": "goog-key"}, "gemini-1.5-pro")
    with patch("providers.google_api_key.ChatGoogleGenerativeAI") as mock_cls:
        mock_cls.return_value = MagicMock()
        llm = provider_factory(provider)
        mock_cls.assert_called_once_with(model="gemini-1.5-pro", google_api_key="goog-key")


def test_custom_url_passes_base_url():
    provider = _make_provider(
        "custom-url",
        {"base_url": "http://localhost:11434/v1", "api_key": "local"},
        "llama3"
    )
    with patch("providers.custom_url.ChatOpenAI") as mock_cls:
        mock_cls.return_value = MagicMock()
        llm = provider_factory(provider)
        mock_cls.assert_called_once_with(
            model="llama3",
            base_url="http://localhost:11434/v1",
            api_key="local",
        )


def test_unknown_provider_type_raises():
    provider = _make_provider("nonexistent-type", {})
    with pytest.raises(ValueError, match="Unknown provider type"):
        provider_factory(provider)
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
pytest tests/test_providers_factory.py -v
```

Expected: `ModuleNotFoundError: No module named 'providers'`

- [ ] **Step 3: Create `backend/providers/__init__.py`** (empty file)

- [ ] **Step 4: Write `backend/providers/anthropic_api_key.py`**

```python
from langchain_anthropic import ChatAnthropic


def create(model: str, credentials: dict) -> ChatAnthropic:
    return ChatAnthropic(model=model, api_key=credentials["api_key"])
```

- [ ] **Step 5: Write `backend/providers/anthropic_setup_auth.py`**

```python
import json
from pathlib import Path

from langchain_anthropic import ChatAnthropic


def _read_claude_cli_token() -> str:
    """Read OAuth token from Claude CLI credentials file."""
    creds_path = Path.home() / ".claude" / ".credentials.json"
    if not creds_path.exists():
        raise ValueError(
            f"Claude CLI credentials not found at {creds_path}. "
            "Run `claude` to authenticate first."
        )
    data = json.loads(creds_path.read_text())
    for key in ("claudeAiOauthToken", "access_token", "token"):
        if key in data:
            return data[key]
    raise ValueError(
        f"No token field found in {creds_path}. Available keys: {list(data.keys())}"
    )


def create(model: str, credentials: dict) -> ChatAnthropic:
    token = _read_claude_cli_token()
    return ChatAnthropic(model=model, api_key=token)
```

- [ ] **Step 6: Write `backend/providers/openai_api_key.py`**

```python
from langchain_openai import ChatOpenAI


def create(model: str, credentials: dict) -> ChatOpenAI:
    return ChatOpenAI(model=model, api_key=credentials["api_key"])
```

- [ ] **Step 7: Write `backend/providers/openai_codex_oauth.py`**

```python
import json
from pathlib import Path

from langchain_openai import ChatOpenAI


def _read_codex_token() -> str:
    """Read OAuth token from OpenAI Codex CLI credentials file."""
    creds_path = Path.home() / ".codex" / "auth.json"
    if not creds_path.exists():
        raise ValueError(
            f"Codex credentials not found at {creds_path}. "
            "Authenticate with the Codex CLI first."
        )
    data = json.loads(creds_path.read_text())
    for key in ("access_token", "token", "api_key"):
        if key in data:
            return data[key]
    raise ValueError(f"No token field in {creds_path}. Keys: {list(data.keys())}")


def create(model: str, credentials: dict) -> ChatOpenAI:
    token = _read_codex_token()
    return ChatOpenAI(model=model, api_key=token)
```

- [ ] **Step 8: Write `backend/providers/google_api_key.py`**

```python
from langchain_google_genai import ChatGoogleGenerativeAI


def create(model: str, credentials: dict) -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(model=model, google_api_key=credentials["api_key"])
```

- [ ] **Step 9: Write `backend/providers/custom_url.py`**

```python
from langchain_openai import ChatOpenAI


def create(model: str, credentials: dict) -> ChatOpenAI:
    return ChatOpenAI(
        model=model,
        base_url=credentials["base_url"],
        api_key=credentials.get("api_key", "local"),
    )
```

- [ ] **Step 10: Write `backend/providers/factory.py`**

```python
from typing import Any

from db.models import Provider
from providers import (
    anthropic_api_key,
    anthropic_setup_auth,
    openai_api_key,
    openai_codex_oauth,
    google_api_key,
    custom_url,
)

_CREATORS = {
    "anthropic-api-key":    anthropic_api_key.create,
    "anthropic-setup-auth": anthropic_setup_auth.create,
    "openai-api-key":       openai_api_key.create,
    "openai-codex-oauth":   openai_codex_oauth.create,
    "google-api-key":       google_api_key.create,
    "custom-url":           custom_url.create,
}


def provider_factory(provider: Provider) -> Any:
    """Return a LangChain LLM instance from a Provider DB row."""
    creator = _CREATORS.get(provider.type)
    if creator is None:
        raise ValueError(
            f"Unknown provider type: {provider.type!r}. "
            f"Valid types: {list(_CREATORS)}"
        )
    return creator(provider.model, provider.credentials)
```

- [ ] **Step 11: Run tests — expect PASS**

```bash
cd backend
pytest tests/test_providers_factory.py -v
```

Expected:
```
PASSED tests/test_providers_factory.py::test_anthropic_api_key_returns_chat_anthropic
PASSED tests/test_providers_factory.py::test_openai_api_key_returns_chat_openai
PASSED tests/test_providers_factory.py::test_google_api_key_returns_chat_google
PASSED tests/test_providers_factory.py::test_custom_url_passes_base_url
PASSED tests/test_providers_factory.py::test_unknown_provider_type_raises
```

- [ ] **Step 12: Commit**

```bash
cd backend
git add providers/ tests/test_providers_factory.py
git commit -m "feat(backend): provider factory — 6 LangChain provider types (anthropic, openai, google, custom-url)"
```

---

## Task 5: Graph Registry Stub + FastAPI App

**Files:**
- Create: `backend/graph/__init__.py`
- Create: `backend/graph/registry.py`
- Create: `backend/api/__init__.py`
- Modify: `backend/main.py`
- Create: `backend/tests/test_api_system.py`

- [ ] **Step 1: Write failing test `backend/tests/test_api_system.py`**

```python
def test_health_ok(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "graph_compiled" in data


def test_graph_status(client):
    resp = client.get("/api/graph/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "agent_count" in data
    assert "skill_count" in data
    assert "routing_rule_count" in data


def test_force_rebuild(client):
    resp = client.post("/api/graph/rebuild")
    assert resp.status_code == 204
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend
pytest tests/test_api_system.py -v
```

Expected: `ImportError` or connection error (main.py is still the old stub).

- [ ] **Step 3: Create `backend/graph/__init__.py`** (empty file)

- [ ] **Step 4: Write `backend/graph/registry.py`** (stub — Phase 6 completes this)

```python
from typing import Any


class GraphRegistry:
    """
    Stub for Phase 5. Phase 6 replaces this with a real LangGraph registry.
    All mutation API routes call rebuild() after DB changes.
    """

    _compiled: bool = False

    async def rebuild(self, db: Any = None) -> None:
        """No-op in Phase 5. Phase 6 compiles the LangGraph supervisor graph here."""
        self._compiled = True

    def is_compiled(self) -> bool:
        return self._compiled


# Module-level singleton shared across the application
graph_registry = GraphRegistry()
```

- [ ] **Step 5: Create `backend/api/__init__.py`** (empty file)

- [ ] **Step 6: Write `backend/api/system.py`**

```python
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Agent, Skill, RoutingRule
from graph.registry import graph_registry

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"status": "ok", "graph_compiled": graph_registry.is_compiled()}


@router.get("/graph/status")
def graph_status(db: Session = Depends(get_db)):
    return {
        "agent_count": db.query(Agent).count(),
        "skill_count": db.query(Skill).count(),
        "routing_rule_count": db.query(RoutingRule).count(),
    }


@router.post("/graph/rebuild", status_code=204)
async def force_rebuild(db: Session = Depends(get_db)):
    await graph_registry.rebuild(db)
    return Response(status_code=204)
```

- [ ] **Step 7: Replace `backend/main.py`**

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.database import init_db
from api.system import router as system_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Agent Framework API",
    description="LangGraph-powered multi-agent framework",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system_router)
```

- [ ] **Step 8: Run tests — expect PASS**

```bash
cd backend
pytest tests/test_api_system.py -v
```

Expected:
```
PASSED tests/test_api_system.py::test_health_ok
PASSED tests/test_api_system.py::test_graph_status
PASSED tests/test_api_system.py::test_force_rebuild
```

- [ ] **Step 9: Commit**

```bash
cd backend
git add graph/__init__.py graph/registry.py api/__init__.py api/system.py main.py tests/test_api_system.py
git commit -m "feat(backend): FastAPI app with lifespan, CORS, system routes (health/status/rebuild) and GraphRegistry stub"
```

---

## Task 6: Providers API

**Files:**
- Create: `backend/api/providers.py`
- Create: `backend/tests/test_api_providers.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write failing tests `backend/tests/test_api_providers.py`**

```python
def _create_provider(client, **overrides):
    payload = {
        "name": "Test Anthropic",
        "type": "anthropic-api-key",
        "credentials": {"api_key": "sk-test"},
        "model": "claude-3-5-sonnet-20241022",
        "is_default": False,
        **overrides,
    }
    return client.post("/api/providers", json=payload)


def test_create_provider(client):
    resp = _create_provider(client)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Anthropic"
    assert data["type"] == "anthropic-api-key"
    assert data["model"] == "claude-3-5-sonnet-20241022"
    assert "id" in data
    assert "credentials" not in data  # never returned


def test_list_providers_empty(client):
    resp = client.get("/api/providers")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_providers(client):
    _create_provider(client)
    resp = client.get("/api/providers")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_get_provider(client):
    created = _create_provider(client).json()
    resp = client.get(f"/api/providers/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_get_provider_not_found(client):
    resp = client.get("/api/providers/nonexistent-id")
    assert resp.status_code == 404


def test_update_provider(client):
    created = _create_provider(client).json()
    resp = client.put(f"/api/providers/{created['id']}", json={"model": "claude-opus-4-6"})
    assert resp.status_code == 200
    assert resp.json()["model"] == "claude-opus-4-6"


def test_delete_provider(client):
    created = _create_provider(client).json()
    resp = client.delete(f"/api/providers/{created['id']}")
    assert resp.status_code == 204
    assert client.get(f"/api/providers/{created['id']}").status_code == 404


def test_duplicate_name_rejected(client):
    _create_provider(client)
    resp = _create_provider(client)
    assert resp.status_code == 409
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend
pytest tests/test_api_providers.py -v
```

Expected: All tests fail with 404 (route not registered yet).

- [ ] **Step 3: Write `backend/api/providers.py`**

```python
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Provider
from graph.registry import graph_registry

router = APIRouter(prefix="/api/providers", tags=["providers"])

VALID_TYPES = Literal[
    "anthropic-api-key",
    "anthropic-setup-auth",
    "openai-api-key",
    "openai-codex-oauth",
    "google-api-key",
    "custom-url",
]


class ProviderCreate(BaseModel):
    name: str
    type: VALID_TYPES
    credentials: dict[str, str]
    model: str
    is_default: bool = False


class ProviderUpdate(BaseModel):
    name: str | None = None
    credentials: dict[str, str] | None = None
    model: str | None = None
    is_default: bool | None = None


class ProviderOut(BaseModel):
    id: str
    name: str
    type: str
    model: str
    is_default: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=list[ProviderOut])
def list_providers(db: Session = Depends(get_db)):
    return db.query(Provider).all()


@router.get("/{id}", response_model=ProviderOut)
def get_provider(id: str, db: Session = Depends(get_db)):
    p = db.get(Provider, id)
    if not p:
        raise HTTPException(404, "Provider not found")
    return p


@router.post("", response_model=ProviderOut, status_code=201)
async def create_provider(body: ProviderCreate, db: Session = Depends(get_db)):
    p = Provider(**body.model_dump())
    db.add(p)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, f"Provider name {body.name!r} already exists")
    db.refresh(p)
    await graph_registry.rebuild(db)
    return p


@router.put("/{id}", response_model=ProviderOut)
async def update_provider(id: str, body: ProviderUpdate, db: Session = Depends(get_db)):
    p = db.get(Provider, id)
    if not p:
        raise HTTPException(404, "Provider not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    await graph_registry.rebuild(db)
    return p


@router.delete("/{id}", status_code=204)
async def delete_provider(id: str, db: Session = Depends(get_db)):
    p = db.get(Provider, id)
    if not p:
        raise HTTPException(404, "Provider not found")
    db.delete(p)
    db.commit()
    await graph_registry.rebuild(db)
    return Response(status_code=204)
```

- [ ] **Step 4: Register the router in `backend/main.py`**

Add after the existing imports and before `app = FastAPI(...)`:
```python
from api.providers import router as providers_router
```

Add after `app.include_router(system_router)`:
```python
app.include_router(providers_router)
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd backend
pytest tests/test_api_providers.py -v
```

Expected: All 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd backend
git add api/providers.py tests/test_api_providers.py main.py
git commit -m "feat(backend): providers CRUD API — GET/POST/PUT/DELETE /api/providers"
```

---

## Task 7: Skills API

**Files:**
- Create: `backend/api/skills.py`
- Create: `backend/tests/test_api_skills.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write failing tests `backend/tests/test_api_skills.py`**

```python
def _create_skill(client, **overrides):
    payload = {
        "name": "http-call",
        "description": "Make an outbound HTTP request",
        "input_schema": {"type": "object", "properties": {"url": {"type": "string"}}},
        "implementation": "import httpx\nreturn httpx.get(input['url']).text",
        **overrides,
    }
    return client.post("/api/skills", json=payload)


def test_create_skill(client):
    resp = _create_skill(client)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "http-call"
    assert "id" in data


def test_list_skills_empty(client):
    assert client.get("/api/skills").json() == []


def test_list_skills(client):
    _create_skill(client)
    assert len(client.get("/api/skills").json()) == 1


def test_get_skill(client):
    created = _create_skill(client).json()
    resp = client.get(f"/api/skills/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_get_skill_not_found(client):
    assert client.get("/api/skills/missing").status_code == 404


def test_update_skill(client):
    created = _create_skill(client).json()
    resp = client.put(f"/api/skills/{created['id']}", json={"description": "Updated description"})
    assert resp.status_code == 200
    assert resp.json()["description"] == "Updated description"


def test_delete_skill(client):
    created = _create_skill(client).json()
    assert client.delete(f"/api/skills/{created['id']}").status_code == 204
    assert client.get(f"/api/skills/{created['id']}").status_code == 404


def test_duplicate_name_rejected(client):
    _create_skill(client)
    assert _create_skill(client).status_code == 409
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend
pytest tests/test_api_skills.py -v
```

Expected: All tests fail (route not registered).

- [ ] **Step 3: Write `backend/api/skills.py`**

```python
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Skill
from graph.registry import graph_registry

router = APIRouter(prefix="/api/skills", tags=["skills"])


class SkillCreate(BaseModel):
    name: str
    description: str
    input_schema: dict
    implementation: str


class SkillUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    input_schema: dict | None = None
    implementation: str | None = None


class SkillOut(BaseModel):
    id: str
    name: str
    description: str
    input_schema: dict
    implementation: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=list[SkillOut])
def list_skills(db: Session = Depends(get_db)):
    return db.query(Skill).all()


@router.get("/{id}", response_model=SkillOut)
def get_skill(id: str, db: Session = Depends(get_db)):
    s = db.get(Skill, id)
    if not s:
        raise HTTPException(404, "Skill not found")
    return s


@router.post("", response_model=SkillOut, status_code=201)
async def create_skill(body: SkillCreate, db: Session = Depends(get_db)):
    s = Skill(**body.model_dump())
    db.add(s)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, f"Skill name {body.name!r} already exists")
    db.refresh(s)
    await graph_registry.rebuild(db)
    return s


@router.put("/{id}", response_model=SkillOut)
async def update_skill(id: str, body: SkillUpdate, db: Session = Depends(get_db)):
    s = db.get(Skill, id)
    if not s:
        raise HTTPException(404, "Skill not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    await graph_registry.rebuild(db)
    return s


@router.delete("/{id}", status_code=204)
async def delete_skill(id: str, db: Session = Depends(get_db)):
    s = db.get(Skill, id)
    if not s:
        raise HTTPException(404, "Skill not found")
    db.delete(s)
    db.commit()
    await graph_registry.rebuild(db)
    return Response(status_code=204)
```

- [ ] **Step 4: Register router in `backend/main.py`**

Add import:
```python
from api.skills import router as skills_router
```
Add after existing `include_router` calls:
```python
app.include_router(skills_router)
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd backend
pytest tests/test_api_skills.py -v
```

Expected: All 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd backend
git add api/skills.py tests/test_api_skills.py main.py
git commit -m "feat(backend): skills CRUD API — GET/POST/PUT/DELETE /api/skills"
```

---

## Task 8: Agents API

**Files:**
- Create: `backend/api/agents.py`
- Create: `backend/tests/test_api_agents.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write failing tests `backend/tests/test_api_agents.py`**

```python
def _create_provider(client):
    return client.post("/api/providers", json={
        "name": "Anthropic",
        "type": "anthropic-api-key",
        "credentials": {"api_key": "sk-test"},
        "model": "claude-3-5-sonnet-20241022",
    }).json()


def _create_skill(client):
    return client.post("/api/skills", json={
        "name": "http-call",
        "description": "HTTP",
        "input_schema": {"type": "object"},
        "implementation": "pass",
    }).json()


def _create_agent(client, provider_id, **overrides):
    payload = {
        "name": "TestAgent",
        "persona": "You are a test agent.",
        "provider_id": provider_id,
        "is_supervisor": False,
        **overrides,
    }
    return client.post("/api/agents", json=payload)


def test_create_agent(client):
    provider = _create_provider(client)
    resp = _create_agent(client, provider["id"])
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "TestAgent"
    assert data["provider_id"] == provider["id"]
    assert "id" in data


def test_list_agents(client):
    provider = _create_provider(client)
    _create_agent(client, provider["id"])
    assert len(client.get("/api/agents").json()) == 1


def test_get_agent(client):
    provider = _create_provider(client)
    created = _create_agent(client, provider["id"]).json()
    resp = client.get(f"/api/agents/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_get_agent_not_found(client):
    assert client.get("/api/agents/missing").status_code == 404


def test_update_agent(client):
    provider = _create_provider(client)
    created = _create_agent(client, provider["id"]).json()
    resp = client.put(f"/api/agents/{created['id']}", json={"persona": "Updated persona."})
    assert resp.status_code == 200
    assert resp.json()["persona"] == "Updated persona."


def test_delete_agent(client):
    provider = _create_provider(client)
    created = _create_agent(client, provider["id"]).json()
    assert client.delete(f"/api/agents/{created['id']}").status_code == 204
    assert client.get(f"/api/agents/{created['id']}").status_code == 404


def test_attach_and_detach_skill(client):
    provider = _create_provider(client)
    agent = _create_agent(client, provider["id"]).json()
    skill = _create_skill(client)

    # attach
    resp = client.post(f"/api/agents/{agent['id']}/skills/{skill['id']}")
    assert resp.status_code == 204

    # verify agent has skill
    agent_data = client.get(f"/api/agents/{agent['id']}").json()
    assert any(s["id"] == skill["id"] for s in agent_data["skills"])

    # detach
    resp = client.delete(f"/api/agents/{agent['id']}/skills/{skill['id']}")
    assert resp.status_code == 204

    # verify skill removed
    agent_data = client.get(f"/api/agents/{agent['id']}").json()
    assert not any(s["id"] == skill["id"] for s in agent_data["skills"])


def test_attach_skill_invalid_agent(client):
    skill = _create_skill(client)
    assert client.post(f"/api/agents/bad-id/skills/{skill['id']}").status_code == 404


def test_attach_skill_invalid_skill(client):
    provider = _create_provider(client)
    agent = _create_agent(client, provider["id"]).json()
    assert client.post(f"/api/agents/{agent['id']}/skills/bad-id").status_code == 404
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend
pytest tests/test_api_agents.py -v
```

Expected: All tests fail (route not registered).

- [ ] **Step 3: Write `backend/api/agents.py`**

```python
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Agent, Skill
from graph.registry import graph_registry

router = APIRouter(prefix="/api/agents", tags=["agents"])


class AgentCreate(BaseModel):
    name: str
    persona: str
    rules: str | None = None
    provider_id: str
    is_supervisor: bool = False
    memory_enabled: bool = False
    memory_types: list[str] = ["user", "feedback", "project", "reference"]
    config_hook_url: str | None = None
    config_hook_secret: str | None = None


class AgentUpdate(BaseModel):
    name: str | None = None
    persona: str | None = None
    rules: str | None = None
    provider_id: str | None = None
    is_supervisor: bool | None = None
    memory_enabled: bool | None = None
    memory_types: list[str] | None = None
    config_hook_url: str | None = None
    config_hook_secret: str | None = None


class SkillSummary(BaseModel):
    id: str
    name: str
    description: str
    model_config = ConfigDict(from_attributes=True)


class AgentOut(BaseModel):
    id: str
    name: str
    persona: str
    rules: str | None
    provider_id: str
    is_supervisor: bool
    memory_enabled: bool
    memory_types: list[str]
    config_hook_url: str | None
    created_at: datetime
    skills: list[SkillSummary]
    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=list[AgentOut])
def list_agents(db: Session = Depends(get_db)):
    return db.query(Agent).all()


@router.get("/{id}", response_model=AgentOut)
def get_agent(id: str, db: Session = Depends(get_db)):
    a = db.get(Agent, id)
    if not a:
        raise HTTPException(404, "Agent not found")
    return a


@router.post("", response_model=AgentOut, status_code=201)
async def create_agent(body: AgentCreate, db: Session = Depends(get_db)):
    a = Agent(**body.model_dump())
    db.add(a)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, f"Agent name {body.name!r} already exists")
    db.refresh(a)
    await graph_registry.rebuild(db)
    return a


@router.put("/{id}", response_model=AgentOut)
async def update_agent(id: str, body: AgentUpdate, db: Session = Depends(get_db)):
    a = db.get(Agent, id)
    if not a:
        raise HTTPException(404, "Agent not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(a, k, v)
    db.commit()
    db.refresh(a)
    await graph_registry.rebuild(db)
    return a


@router.delete("/{id}", status_code=204)
async def delete_agent(id: str, db: Session = Depends(get_db)):
    a = db.get(Agent, id)
    if not a:
        raise HTTPException(404, "Agent not found")
    db.delete(a)
    db.commit()
    await graph_registry.rebuild(db)
    return Response(status_code=204)


@router.post("/{agent_id}/skills/{skill_id}", status_code=204)
async def attach_skill(agent_id: str, skill_id: str, db: Session = Depends(get_db)):
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    skill = db.get(Skill, skill_id)
    if not skill:
        raise HTTPException(404, "Skill not found")
    if skill not in agent.skills:
        agent.skills.append(skill)
        db.commit()
    await graph_registry.rebuild(db)
    return Response(status_code=204)


@router.delete("/{agent_id}/skills/{skill_id}", status_code=204)
async def detach_skill(agent_id: str, skill_id: str, db: Session = Depends(get_db)):
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    skill = db.get(Skill, skill_id)
    if not skill:
        raise HTTPException(404, "Skill not found")
    if skill in agent.skills:
        agent.skills.remove(skill)
        db.commit()
    await graph_registry.rebuild(db)
    return Response(status_code=204)
```

- [ ] **Step 4: Register router in `backend/main.py`**

Add import:
```python
from api.agents import router as agents_router
```
Add:
```python
app.include_router(agents_router)
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd backend
pytest tests/test_api_agents.py -v
```

Expected: All 9 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd backend
git add api/agents.py tests/test_api_agents.py main.py
git commit -m "feat(backend): agents CRUD API — GET/POST/PUT/DELETE /api/agents + skill attach/detach"
```

---

## Task 9: Routing Rules API

**Files:**
- Create: `backend/api/routing_rules.py`
- Create: `backend/tests/test_api_routing_rules.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write failing tests `backend/tests/test_api_routing_rules.py`**

```python
def _setup(client):
    """Returns (supervisor_id, worker_id) — both agents seeded in DB."""
    provider = client.post("/api/providers", json={
        "name": "Anthropic",
        "type": "anthropic-api-key",
        "credentials": {"api_key": "sk-test"},
        "model": "claude-3-5-sonnet-20241022",
    }).json()
    supervisor = client.post("/api/agents", json={
        "name": "Supervisor",
        "persona": "You route emails.",
        "provider_id": provider["id"],
        "is_supervisor": True,
    }).json()
    worker = client.post("/api/agents", json={
        "name": "Worker",
        "persona": "You process payroll.",
        "provider_id": provider["id"],
    }).json()
    return supervisor["id"], worker["id"]


def _create_rule(client, supervisor_id, worker_id, label="starter-processing"):
    return client.post("/api/routing-rules", json={
        "supervisor_id": supervisor_id,
        "intent_label": label,
        "target_agent_id": worker_id,
        "priority": 0,
    })


def test_create_routing_rule(client):
    sup_id, wrk_id = _setup(client)
    resp = _create_rule(client, sup_id, wrk_id)
    assert resp.status_code == 201
    data = resp.json()
    assert data["intent_label"] == "starter-processing"
    assert data["target_agent_id"] == wrk_id


def test_list_routing_rules(client):
    sup_id, wrk_id = _setup(client)
    _create_rule(client, sup_id, wrk_id)
    assert len(client.get("/api/routing-rules").json()) == 1


def test_get_routing_rule(client):
    sup_id, wrk_id = _setup(client)
    created = _create_rule(client, sup_id, wrk_id).json()
    resp = client.get(f"/api/routing-rules/{created['id']}")
    assert resp.status_code == 200


def test_update_routing_rule(client):
    sup_id, wrk_id = _setup(client)
    created = _create_rule(client, sup_id, wrk_id).json()
    resp = client.put(f"/api/routing-rules/{created['id']}", json={"priority": 5})
    assert resp.status_code == 200
    assert resp.json()["priority"] == 5


def test_delete_routing_rule(client):
    sup_id, wrk_id = _setup(client)
    created = _create_rule(client, sup_id, wrk_id).json()
    assert client.delete(f"/api/routing-rules/{created['id']}").status_code == 204
    assert client.get(f"/api/routing-rules/{created['id']}").status_code == 404
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend
pytest tests/test_api_routing_rules.py -v
```

Expected: All tests fail (route not registered).

- [ ] **Step 3: Write `backend/api/routing_rules.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import RoutingRule
from graph.registry import graph_registry

router = APIRouter(prefix="/api/routing-rules", tags=["routing-rules"])


class RoutingRuleCreate(BaseModel):
    supervisor_id: str
    intent_label: str
    target_agent_id: str
    priority: int = 0


class RoutingRuleUpdate(BaseModel):
    intent_label: str | None = None
    target_agent_id: str | None = None
    priority: int | None = None


class RoutingRuleOut(BaseModel):
    id: str
    supervisor_id: str
    intent_label: str
    target_agent_id: str
    priority: int
    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=list[RoutingRuleOut])
def list_routing_rules(db: Session = Depends(get_db)):
    return db.query(RoutingRule).all()


@router.get("/{id}", response_model=RoutingRuleOut)
def get_routing_rule(id: str, db: Session = Depends(get_db)):
    r = db.get(RoutingRule, id)
    if not r:
        raise HTTPException(404, "Routing rule not found")
    return r


@router.post("", response_model=RoutingRuleOut, status_code=201)
async def create_routing_rule(body: RoutingRuleCreate, db: Session = Depends(get_db)):
    r = RoutingRule(**body.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    await graph_registry.rebuild(db)
    return r


@router.put("/{id}", response_model=RoutingRuleOut)
async def update_routing_rule(id: str, body: RoutingRuleUpdate, db: Session = Depends(get_db)):
    r = db.get(RoutingRule, id)
    if not r:
        raise HTTPException(404, "Routing rule not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    await graph_registry.rebuild(db)
    return r


@router.delete("/{id}", status_code=204)
async def delete_routing_rule(id: str, db: Session = Depends(get_db)):
    r = db.get(RoutingRule, id)
    if not r:
        raise HTTPException(404, "Routing rule not found")
    db.delete(r)
    db.commit()
    await graph_registry.rebuild(db)
    return Response(status_code=204)
```

- [ ] **Step 4: Register router in `backend/main.py`**

Add import:
```python
from api.routing_rules import router as routing_rules_router
```
Add:
```python
app.include_router(routing_rules_router)
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd backend
pytest tests/test_api_routing_rules.py -v
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd backend
git add api/routing_rules.py tests/test_api_routing_rules.py main.py
git commit -m "feat(backend): routing rules CRUD API — GET/POST/PUT/DELETE /api/routing-rules"
```

---

## Task 10: Sessions API

**Files:**
- Create: `backend/api/sessions.py`
- Create: `backend/tests/test_api_sessions.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write failing tests `backend/tests/test_api_sessions.py`**

```python
def _setup(client):
    provider = client.post("/api/providers", json={
        "name": "Anthropic",
        "type": "anthropic-api-key",
        "credentials": {"api_key": "sk-test"},
        "model": "claude-3-5-sonnet-20241022",
    }).json()
    agent = client.post("/api/agents", json={
        "name": "Supervisor",
        "persona": "You route.",
        "provider_id": provider["id"],
        "is_supervisor": True,
    }).json()
    return agent["id"]


def test_create_session(client):
    agent_id = _setup(client)
    resp = client.post("/api/sessions", json={"user_id": "user-123", "agent_id": agent_id})
    assert resp.status_code == 201
    data = resp.json()
    assert data["user_id"] == "user-123"
    assert data["agent_id"] == agent_id
    assert "id" in data


def test_create_session_invalid_agent(client):
    resp = client.post("/api/sessions", json={"user_id": "user-123", "agent_id": "bad-id"})
    assert resp.status_code == 404


def test_delete_session(client):
    agent_id = _setup(client)
    session = client.post("/api/sessions", json={"user_id": "user-123", "agent_id": agent_id}).json()
    resp = client.delete(f"/api/sessions/{session['id']}")
    assert resp.status_code == 204


def test_delete_session_not_found(client):
    assert client.delete("/api/sessions/missing").status_code == 404
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend
pytest tests/test_api_sessions.py -v
```

Expected: All tests fail (route not registered).

- [ ] **Step 3: Write `backend/api/sessions.py`**

```python
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session as DbSession

from db.database import get_db
from db.models import Agent, Session

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class SessionCreate(BaseModel):
    user_id: str
    agent_id: str


class SessionOut(BaseModel):
    id: str
    user_id: str
    agent_id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


@router.post("", response_model=SessionOut, status_code=201)
def create_session(body: SessionCreate, db: DbSession = Depends(get_db)):
    agent = db.get(Agent, body.agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    s = Session(user_id=body.user_id, agent_id=body.agent_id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{id}", status_code=204)
def delete_session(id: str, db: DbSession = Depends(get_db)):
    s = db.get(Session, id)
    if not s:
        raise HTTPException(404, "Session not found")
    db.delete(s)
    db.commit()
    return Response(status_code=204)
```

- [ ] **Step 4: Register router in `backend/main.py`**

Add import:
```python
from api.sessions import router as sessions_router
```
Add:
```python
app.include_router(sessions_router)
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd backend
pytest tests/test_api_sessions.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd backend
git add api/sessions.py tests/test_api_sessions.py main.py
git commit -m "feat(backend): sessions API — POST /api/sessions, DELETE /api/sessions/{id}"
```

---

## Task 11: Seed Initial Data

**Files:**
- Create: `backend/seed.py`

- [ ] **Step 1: Write `backend/seed.py`**

```python
"""
Seed the database with initial agents, skills, and routing rules.
Run from the backend/ directory: python seed.py

Safe to run multiple times — skips rows that already exist by name.
"""
from db.database import SessionLocal, init_db
from db.models import Agent, Provider, Skill, RoutingRule

PROVIDER = {
    "name": "Anthropic (Setup Auth)",
    "type": "anthropic-setup-auth",
    "credentials": {},
    "model": "claude-opus-4-6",
    "is_default": True,
}

SKILLS = [
    {
        "name": "http-call",
        "description": "Make an outbound HTTP GET or POST request to an external URL.",
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "The URL to call"},
                "method": {"type": "string", "enum": ["GET", "POST"], "default": "GET"},
                "body": {"type": "object", "description": "JSON body for POST requests"},
            },
            "required": ["url"],
        },
        "implementation": (
            "import httpx\n"
            "method = input.get('method', 'GET').upper()\n"
            "if method == 'POST':\n"
            "    resp = httpx.post(input['url'], json=input.get('body', {}))\n"
            "else:\n"
            "    resp = httpx.get(input['url'])\n"
            "return {'status_code': resp.status_code, 'body': resp.text}"
        ),
    },
    {
        "name": "classify-email",
        "description": "Classify an incoming email and return the intent label for routing.",
        "input_schema": {
            "type": "object",
            "properties": {
                "subject": {"type": "string"},
                "body": {"type": "string"},
                "sender": {"type": "string"},
            },
            "required": ["subject", "body"],
        },
        "implementation": "return {'intent': 'FALLBACK', 'confidence': 0.0}",
    },
    {
        "name": "process-starter",
        "description": "Submit a new starter employee record to the UK Payroll API.",
        "input_schema": {
            "type": "object",
            "properties": {
                "first_name": {"type": "string"},
                "last_name": {"type": "string"},
                "start_date": {"type": "string", "format": "date"},
                "ni_number": {"type": "string"},
            },
            "required": ["first_name", "last_name", "start_date"],
        },
        "implementation": (
            "import httpx\n"
            "resp = httpx.post('http://localhost:9000/api/starters', json=input)\n"
            "return {'status_code': resp.status_code, 'result': resp.json()}"
        ),
    },
    {
        "name": "import-timesheet",
        "description": "Import a timesheet record into the UK Payroll system.",
        "input_schema": {
            "type": "object",
            "properties": {
                "employee_id": {"type": "string"},
                "period_start": {"type": "string", "format": "date"},
                "period_end": {"type": "string", "format": "date"},
                "hours": {"type": "number"},
            },
            "required": ["employee_id", "period_start", "period_end", "hours"],
        },
        "implementation": (
            "import httpx\n"
            "resp = httpx.post('http://localhost:9000/api/timesheets/import', json=input)\n"
            "return {'status_code': resp.status_code, 'result': resp.json()}"
        ),
    },
    {
        "name": "create-task",
        "description": "Create a task in the UK Payroll system for manual follow-up.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "assigned_to": {"type": "string"},
                "due_date": {"type": "string", "format": "date"},
            },
            "required": ["title", "description"],
        },
        "implementation": (
            "import httpx\n"
            "resp = httpx.post('http://localhost:9000/api/tasks', json=input)\n"
            "return {'status_code': resp.status_code, 'result': resp.json()}"
        ),
    },
]

AGENTS = [
    {
        "name": "EmailClassifier",
        "persona": (
            "You are the EmailClassifier — a precision email triage agent for UK payroll operations.\n"
            "Your sole responsibility is to read incoming emails and determine which specialist "
            "agent should handle them.\n\n"
            "When classifying, output ONLY the intent label — no explanation, no preamble.\n"
            "Valid intent labels: starter-processing, timesheet-import, task-creation, FALLBACK"
        ),
        "rules": (
            "1. Never attempt to process payroll operations yourself — always delegate.\n"
            "2. If uncertain, use FALLBACK.\n"
            "3. Return a single intent label as plain text."
        ),
        "is_supervisor": True,
        "memory_enabled": False,
        "skill_names": ["classify-email"],
    },
    {
        "name": "PayrollWorker",
        "persona": (
            "You are the PayrollWorker — a specialist worker that executes UK Payroll API operations.\n"
            "You receive structured task inputs and must return structured JSON results.\n"
            "Never produce conversational prose. Always return valid JSON."
        ),
        "rules": (
            "1. Return only valid JSON — no markdown, no explanation.\n"
            "2. If an API call fails, return {\"status\": \"error\", \"message\": \"<reason>\"}.\n"
            "3. Never make decisions outside your assigned task."
        ),
        "is_supervisor": False,
        "memory_enabled": False,
        "skill_names": ["process-starter", "import-timesheet", "create-task", "http-call"],
    },
]

ROUTING_RULES = [
    {"intent_label": "starter-processing", "target_agent": "PayrollWorker", "priority": 0},
    {"intent_label": "timesheet-import",   "target_agent": "PayrollWorker", "priority": 0},
    {"intent_label": "task-creation",      "target_agent": "PayrollWorker", "priority": 0},
    {"intent_label": "FALLBACK",           "target_agent": "EmailClassifier", "priority": 99},
]


def seed():
    init_db()
    db = SessionLocal()
    try:
        # Provider
        provider = db.query(Provider).filter_by(name=PROVIDER["name"]).first()
        if not provider:
            provider = Provider(**PROVIDER)
            db.add(provider)
            db.commit()
            db.refresh(provider)
            print(f"  Created provider: {provider.name}")
        else:
            print(f"  Skipped provider (exists): {provider.name}")

        # Skills
        skill_map: dict[str, Skill] = {}
        for s_data in SKILLS:
            skill = db.query(Skill).filter_by(name=s_data["name"]).first()
            if not skill:
                skill = Skill(**s_data)
                db.add(skill)
                db.commit()
                db.refresh(skill)
                print(f"  Created skill: {skill.name}")
            else:
                print(f"  Skipped skill (exists): {skill.name}")
            skill_map[skill.name] = skill

        # Agents
        agent_map: dict[str, Agent] = {}
        for a_data in AGENTS:
            skill_names = a_data.pop("skill_names")
            agent = db.query(Agent).filter_by(name=a_data["name"]).first()
            if not agent:
                agent = Agent(**a_data, provider_id=provider.id)
                agent.skills = [skill_map[n] for n in skill_names if n in skill_map]
                db.add(agent)
                db.commit()
                db.refresh(agent)
                print(f"  Created agent: {agent.name}")
            else:
                print(f"  Skipped agent (exists): {agent.name}")
            agent_map[agent.name] = agent

        # Routing rules
        supervisor = agent_map["EmailClassifier"]
        for r_data in ROUTING_RULES:
            target = agent_map[r_data["target_agent"]]
            existing = db.query(RoutingRule).filter_by(
                supervisor_id=supervisor.id,
                intent_label=r_data["intent_label"],
            ).first()
            if not existing:
                rule = RoutingRule(
                    supervisor_id=supervisor.id,
                    intent_label=r_data["intent_label"],
                    target_agent_id=target.id,
                    priority=r_data["priority"],
                )
                db.add(rule)
                db.commit()
                print(f"  Created routing rule: {r_data['intent_label']} → {r_data['target_agent']}")
            else:
                print(f"  Skipped routing rule (exists): {r_data['intent_label']}")

        print("\nSeed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
```

- [ ] **Step 2: Run the seed script**

```bash
cd backend
python seed.py
```

Expected:
```
  Created provider: Anthropic (Setup Auth)
  Created skill: http-call
  Created skill: classify-email
  Created skill: process-starter
  Created skill: import-timesheet
  Created skill: create-task
  Created agent: EmailClassifier
  Created agent: PayrollWorker
  Created routing rule: starter-processing → PayrollWorker
  Created routing rule: timesheet-import → PayrollWorker
  Created routing rule: task-creation → PayrollWorker
  Created routing rule: FALLBACK → EmailClassifier

Seed complete.
```

- [ ] **Step 3: Verify via API**

Start the server:
```bash
cd backend
uvicorn main:app --reload --port 8000
```

In a second terminal:
```bash
curl -s http://localhost:8000/api/agents | python -m json.tool
```

Expected: JSON array with two agents (`EmailClassifier`, `PayrollWorker`), each with skills attached.

```bash
curl -s http://localhost:8000/api/routing-rules | python -m json.tool
```

Expected: JSON array with 4 routing rules.

```bash
curl -s http://localhost:8000/api/graph/status | python -m json.tool
```

Expected: `{"agent_count": 2, "skill_count": 5, "routing_rule_count": 4}`

- [ ] **Step 4: Run full test suite — all passing**

```bash
cd backend
pytest -v
```

Expected: All tests PASS (no failures).

- [ ] **Step 5: Commit**

```bash
cd backend
git add seed.py
git commit -m "feat(backend): seed script — EmailClassifier supervisor + PayrollWorker specialist + 5 skills + 4 routing rules"
```

---

## Final Verification

- [ ] **Run complete test suite one last time**

```bash
cd backend
pytest -v --tb=short
```

Expected: All tests PASS. No warnings about missing modules.

- [ ] **Start server and verify OpenAPI docs**

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Open `http://localhost:8000/docs` in a browser. Confirm all routes are visible:
- `GET/POST /api/providers`
- `GET/POST /api/agents` + skill attachment routes
- `GET/POST /api/skills`
- `GET/POST /api/routing-rules`
- `POST/DELETE /api/sessions`
- `GET /api/health`, `GET /api/graph/status`, `POST /api/graph/rebuild`
