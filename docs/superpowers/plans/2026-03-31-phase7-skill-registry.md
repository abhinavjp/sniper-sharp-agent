# Phase 7 — Skill Registry Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the skill system from DB-only, exec()-based loading to a layered resolver: filesystem system skills + per-user DB skills + per-agent HTTP hook injection, with skills resolved lazily per request.

**Architecture:** `skills/loader.py` reads `.agents/skills/*/SKILL.md` at rebuild time and caches results on `graph_registry`. `skills/resolver.py` merges hook → user DB → system at request time using `user_id` from `SupervisorState`. The specialist subgraph becomes a plain async node function (not a pre-compiled `create_react_agent`) so tools are resolved fresh on each invocation.

**Tech Stack:** Python 3.10+, FastAPI, SQLAlchemy 2.0, Alembic, LangGraph, LangChain, pytest, `httpx` (async HTTP for hook), `PyYAML` (SKILL.md frontmatter parsing), `pytest-asyncio`, `respx` (mock async HTTP in tests).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/db/models.py` | Modify | Add new columns to `Skill` and `Agent` ORM models |
| `backend/db/migrations/versions/xxxx_skill_registry_fields.py` | Create | Alembic migration adding 8 + 2 columns |
| `backend/skills/loader.py` | Create | Parse `.agents/skills/*/SKILL.md` → `list[SystemSkill]` |
| `backend/skills/hook.py` | Create | Async HTTP call to agent's `skill_hook_url` → `list[HookSkill]` |
| `backend/skills/resolver.py` | Create | Merge hook + user DB + system into `list[ResolvedSkill]` |
| `backend/skills/registry.py` | Modify | Call resolver; return `(list[Tool], list[ResolvedSkill])` tuple |
| `backend/graph/state.py` | Modify | Add `metadata: dict \| None` to `SupervisorState` |
| `backend/graph/prompt.py` | Modify | Accept `instruction_skills` param; append bodies to prompt |
| `backend/graph/specialist.py` | Modify | Change from compiled subgraph to async node with lazy tool resolution |
| `backend/graph/registry.py` | Modify | Add `system_skills: list[SystemSkill]` cache; populate at rebuild |
| `backend/api/skills.py` | Modify | Add new columns to Pydantic schemas; add `GET /api/skills/system` |
| `backend/api/agents.py` | Modify | Add `skill_hook_url` / `skill_hook_secret` to `AgentUpdate` |
| `backend/api/chat.py` | Modify | Add `metadata` to `ChatRequest`; pass it in initial state |
| `backend/tests/test_skills_loader.py` | Create | 3 loader tests |
| `backend/tests/test_skills_hook.py` | Create | 3 hook tests + HMAC test |
| `backend/tests/test_skills_resolver.py` | Create | 4 resolver tests |
| `backend/tests/test_skills_registry.py` | Modify | Update existing 4 tests + 2 new registry tests |
| `backend/tests/test_api_skills.py` | Modify | Add system endpoint test + metadata fields test |
| `backend/tests/test_api_agents.py` | Modify | Add skill hook fields test |

---

## Task 1: DB Model — new ORM columns

**Files:**
- Modify: `backend/db/models.py`

- [x] **Step 1: Add columns to `Skill` model**

Open `backend/db/models.py`. Replace the `Skill` class body:

```python
class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    input_schema: Mapped[dict] = mapped_column(JSON, nullable=False)
    implementation: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Phase 7 fields
    skill_type: Mapped[str] = mapped_column(String, nullable=False, default="executable")
    version: Mapped[str] = mapped_column(String, nullable=False, default="1.0.0")
    author: Mapped[str] = mapped_column(String, nullable=False, default="user")
    user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    allowed_tools: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    user_invocable: Mapped[bool] = mapped_column(Boolean, default=False)
    disable_model_invocation: Mapped[bool] = mapped_column(Boolean, default=False)
    context_requirements: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    agents: Mapped[list["Agent"]] = relationship(
        "Agent", secondary="agent_skills", back_populates="skills"
    )
```

- [x] **Step 2: Add columns to `Agent` model**

In the same file, add two new lines to the `Agent` class after `config_hook_secret`:

```python
    skill_hook_url: Mapped[str | None] = mapped_column(String, nullable=True)
    skill_hook_secret: Mapped[str | None] = mapped_column(String, nullable=True)
```

- [x] **Step 3: Commit model changes**

```bash
git add backend/db/models.py
git commit -m "feat(phase7): add skill_type/version/author/user_id/metadata cols to Skill; skill_hook_url/secret to Agent"
```

---

## Task 2: Alembic Migration

**Files:**
- Create: `backend/db/migrations/versions/xxxx_skill_registry_fields.py`

- [x] **Step 1: Generate migration**

```bash
cd backend
alembic revision --autogenerate -m "skill_registry_fields"
```

Expected: a new file created under `backend/db/migrations/versions/` with a name like `<hash>_skill_registry_fields.py`.

- [x] **Step 2: Verify generated migration content**

Open the generated file. Confirm it contains `add_column` calls for each new column. If autogenerate missed any, add them manually. The upgrade function must contain:

```python
def upgrade() -> None:
    op.add_column('skills', sa.Column('skill_type', sa.String(), nullable=False, server_default='executable'))
    op.add_column('skills', sa.Column('version', sa.String(), nullable=False, server_default='1.0.0'))
    op.add_column('skills', sa.Column('author', sa.String(), nullable=False, server_default='user'))
    op.add_column('skills', sa.Column('user_id', sa.String(), nullable=True))
    op.add_column('skills', sa.Column('allowed_tools', sa.JSON(), nullable=False, server_default='[]'))
    op.add_column('skills', sa.Column('user_invocable', sa.Boolean(), server_default='0'))
    op.add_column('skills', sa.Column('disable_model_invocation', sa.Boolean(), server_default='0'))
    op.add_column('skills', sa.Column('context_requirements', sa.JSON(), nullable=False, server_default='[]'))
    op.add_column('agents', sa.Column('skill_hook_url', sa.String(), nullable=True))
    op.add_column('agents', sa.Column('skill_hook_secret', sa.String(), nullable=True))
```

And the downgrade must drop each column in reverse order.

- [x] **Step 3: Apply migration**

```bash
cd backend
alembic upgrade head
```

Expected: `Running upgrade <prev> -> <new>, skill_registry_fields`

- [x] **Step 4: Commit migration**

```bash
git add backend/db/migrations/versions/
git commit -m "feat(phase7): alembic migration — skill registry fields on skills + agents"
```

---

## Task 3: `skills/loader.py` — Filesystem reader

**Files:**
- Create: `backend/skills/loader.py`
- Create: `backend/tests/test_skills_loader.py`

- [x] **Step 1: Write the three failing tests**

Create `backend/tests/test_skills_loader.py`:

```python
import textwrap
from pathlib import Path
import pytest
from skills.loader import load_system_skills, SystemSkill


@pytest.fixture
def skills_dir(tmp_path: Path) -> Path:
    return tmp_path


def _write_skill(skills_dir: Path, name: str, content: str) -> Path:
    skill_dir = skills_dir / name
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text(content)
    return skill_dir


def test_loader_parses_skill_md(skills_dir):
    _write_skill(skills_dir, "my-skill", textwrap.dedent("""\
        ---
        name: my-skill
        version: "2.0.0"
        description: "Does something useful."
        author: system
        type: instruction
        allowed-tools:
          - read_file
          - bash
        user-invocable: true
        disable-model-invocation: false
        context-requirements:
          - user_id
        ---

        ## Instructions
        Do the thing.
    """))
    skills = load_system_skills(skills_dir)
    assert len(skills) == 1
    s = skills[0]
    assert s.name == "my-skill"
    assert s.version == "2.0.0"
    assert s.description == "Does something useful."
    assert s.author == "system"
    assert s.skill_type == "instruction"
    assert s.allowed_tools == ["read_file", "bash"]
    assert s.user_invocable is True
    assert s.disable_model_invocation is False
    assert s.context_requirements == ["user_id"]
    assert "Do the thing." in s.body


def test_loader_handles_missing_optional_fields(skills_dir):
    _write_skill(skills_dir, "minimal-skill", textwrap.dedent("""\
        ---
        name: minimal-skill
        description: "Minimal."
        ---

        Body text.
    """))
    skills = load_system_skills(skills_dir)
    assert len(skills) == 1
    s = skills[0]
    assert s.version == "1.0.0"
    assert s.author == "system"
    assert s.skill_type == "instruction"
    assert s.allowed_tools == []
    assert s.user_invocable is False
    assert s.disable_model_invocation is False
    assert s.context_requirements == []


def test_loader_skips_invalid_files(skills_dir, caplog):
    # Not a directory with SKILL.md — just a stray file
    (skills_dir / "stray.txt").write_text("hello")
    # A directory with a malformed SKILL.md (no frontmatter delimiter)
    bad_dir = skills_dir / "bad-skill"
    bad_dir.mkdir()
    (bad_dir / "SKILL.md").write_text("no frontmatter here at all")
    # A valid skill alongside the bad ones
    _write_skill(skills_dir, "good-skill", textwrap.dedent("""\
        ---
        name: good-skill
        description: "Fine."
        ---
        OK.
    """))
    skills = load_system_skills(skills_dir)
    assert len(skills) == 1
    assert skills[0].name == "good-skill"
```

- [x] **Step 2: Run tests to confirm they fail**

```bash
cd backend
pytest tests/test_skills_loader.py -v
```

Expected: `ImportError` or `ModuleNotFoundError: No module named 'skills.loader'`

- [x] **Step 3: Create `backend/skills/loader.py`**

```python
import logging
from dataclasses import dataclass, field
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)

_FRONTMATTER_DELIMITER = "---"


@dataclass
class SystemSkill:
    name: str
    description: str
    version: str = "1.0.0"
    author: str = "system"
    skill_type: str = "instruction"
    allowed_tools: list[str] = field(default_factory=list)
    user_invocable: bool = False
    disable_model_invocation: bool = False
    context_requirements: list[str] = field(default_factory=list)
    body: str = ""
    source_path: str = ""


def _parse_skill_md(path: Path) -> SystemSkill | None:
    """Parse a SKILL.md file into a SystemSkill. Returns None on any parse error."""
    try:
        raw = path.read_text(encoding="utf-8")
    except Exception as exc:
        logger.warning("skills.loader: cannot read %s — %s", path, exc)
        return None

    # Must start with a frontmatter block
    if not raw.startswith(_FRONTMATTER_DELIMITER):
        logger.warning("skills.loader: no frontmatter in %s — skipping", path)
        return None

    parts = raw.split(_FRONTMATTER_DELIMITER, maxsplit=2)
    # parts[0] = "" (before first ---), parts[1] = yaml, parts[2] = body
    if len(parts) < 3:
        logger.warning("skills.loader: malformed frontmatter in %s — skipping", path)
        return None

    try:
        fm = yaml.safe_load(parts[1]) or {}
    except yaml.YAMLError as exc:
        logger.warning("skills.loader: YAML error in %s — %s", path, exc)
        return None

    if not isinstance(fm, dict):
        logger.warning("skills.loader: frontmatter is not a mapping in %s — skipping", path)
        return None

    name = fm.get("name")
    description = fm.get("description")
    if not name or not description:
        logger.warning("skills.loader: missing required name/description in %s — skipping", path)
        return None

    return SystemSkill(
        name=str(name),
        description=str(description),
        version=str(fm.get("version", "1.0.0")),
        author=str(fm.get("author", "system")),
        skill_type=str(fm.get("type", "instruction")),
        allowed_tools=list(fm.get("allowed-tools") or []),
        user_invocable=bool(fm.get("user-invocable", False)),
        disable_model_invocation=bool(fm.get("disable-model-invocation", False)),
        context_requirements=list(fm.get("context-requirements") or []),
        body=parts[2].strip(),
        source_path=str(path),
    )


def load_system_skills(skills_dir: Path) -> list[SystemSkill]:
    """
    Scan skills_dir for subdirectories containing SKILL.md.
    Returns a list of successfully parsed SystemSkill objects.
    Unparseable entries are skipped with a warning log.
    """
    results: list[SystemSkill] = []
    if not skills_dir.is_dir():
        logger.warning("skills.loader: skills_dir %s does not exist", skills_dir)
        return results

    for entry in sorted(skills_dir.iterdir()):
        if not entry.is_dir():
            continue
        skill_md = entry / "SKILL.md"
        if not skill_md.exists():
            continue
        skill = _parse_skill_md(skill_md)
        if skill is not None:
            results.append(skill)

    return results
```

- [x] **Step 4: Run tests to confirm they pass**

```bash
cd backend
pytest tests/test_skills_loader.py -v
```

Expected:
```
PASSED tests/test_skills_loader.py::test_loader_parses_skill_md
PASSED tests/test_skills_loader.py::test_loader_handles_missing_optional_fields
PASSED tests/test_skills_loader.py::test_loader_skips_invalid_files
```

- [x] **Step 5: Commit**

```bash
git add backend/skills/loader.py backend/tests/test_skills_loader.py
git commit -m "feat(phase7): skills/loader.py — parse .agents/skills/*/SKILL.md into SystemSkill list"
```

---

## Task 4: `skills/hook.py` — HTTP hook injection

**Files:**
- Create: `backend/skills/hook.py`
- Create: `backend/tests/test_skills_hook.py`

The hook module uses `httpx` for async HTTP. Check it is installed:

```bash
cd backend
pip show httpx
```

If not installed: `pip install httpx` and add to `requirements.txt`.

- [x] **Step 1: Write failing tests**

Create `backend/tests/test_skills_hook.py`:

```python
import hashlib
import hmac
import json
import pytest
import respx
import httpx
from skills.hook import fetch_hook_skills, HookSkill


HOOK_URL = "https://example.com/skills-hook"


def _valid_response() -> dict:
    return {
        "skills": [
            {
                "name": "injected-skill",
                "description": "From the hook.",
                "skill_type": "executable",
                "implementation": "return {'ok': True}",
                "version": "1.0.0",
                "allowed_tools": [],
                "user_invocable": False,
                "disable_model_invocation": False,
                "context_requirements": [],
            }
        ]
    }


@pytest.mark.asyncio
async def test_hook_returns_skills():
    with respx.mock:
        respx.post(HOOK_URL).mock(
            return_value=httpx.Response(200, json=_valid_response())
        )
        skills = await fetch_hook_skills(
            hook_url=HOOK_URL,
            hook_secret=None,
            user_id="user-1",
            agent_id="agent-1",
            session_id="session-1",
            metadata={},
        )
    assert len(skills) == 1
    assert isinstance(skills[0], HookSkill)
    assert skills[0].name == "injected-skill"
    assert skills[0].skill_type == "executable"


@pytest.mark.asyncio
async def test_hook_timeout_fallback():
    with respx.mock:
        respx.post(HOOK_URL).mock(side_effect=httpx.TimeoutException("timeout"))
        skills = await fetch_hook_skills(
            hook_url=HOOK_URL,
            hook_secret=None,
            user_id="user-1",
            agent_id="agent-1",
            session_id=None,
            metadata={},
        )
    assert skills == []


@pytest.mark.asyncio
async def test_hook_bad_response_fallback():
    with respx.mock:
        respx.post(HOOK_URL).mock(return_value=httpx.Response(500))
        skills = await fetch_hook_skills(
            hook_url=HOOK_URL,
            hook_secret=None,
            user_id="user-1",
            agent_id="agent-1",
            session_id=None,
            metadata={},
        )
    assert skills == []


@pytest.mark.asyncio
async def test_hook_hmac_signature():
    secret = "my-secret"
    captured_request: list[httpx.Request] = []

    async def capture(request: httpx.Request) -> httpx.Response:
        captured_request.append(request)
        return httpx.Response(200, json=_valid_response())

    with respx.mock:
        respx.post(HOOK_URL).mock(side_effect=capture)
        await fetch_hook_skills(
            hook_url=HOOK_URL,
            hook_secret=secret,
            user_id="user-1",
            agent_id="agent-1",
            session_id=None,
            metadata={},
        )

    assert len(captured_request) == 1
    req = captured_request[0]
    assert "X-Hook-Signature" in req.headers
    sig_header = req.headers["X-Hook-Signature"]
    assert sig_header.startswith("sha256=")
    body_bytes = req.content
    expected_sig = "sha256=" + hmac.new(
        secret.encode(), body_bytes, hashlib.sha256
    ).hexdigest()
    assert sig_header == expected_sig
```

- [x] **Step 2: Run tests to confirm they fail**

```bash
cd backend
pytest tests/test_skills_hook.py -v
```

Expected: `ModuleNotFoundError: No module named 'skills.hook'`

Also install `respx` and `pytest-asyncio` if needed:

```bash
pip install respx pytest-asyncio
```

Add `asyncio_mode = "auto"` to `pytest.ini` or `pyproject.toml` `[tool.pytest.ini_options]` section so async tests run without decorators. If `pyproject.toml` doesn't have this, add:

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

- [x] **Step 3: Create `backend/skills/hook.py`**

```python
import hashlib
import hmac
import json
import logging
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger(__name__)

_HOOK_TIMEOUT_SECONDS = 5.0


@dataclass
class HookSkill:
    name: str
    description: str
    skill_type: str = "executable"
    implementation: str = ""
    version: str = "1.0.0"
    allowed_tools: list[str] = field(default_factory=list)
    user_invocable: bool = False
    disable_model_invocation: bool = False
    context_requirements: list[str] = field(default_factory=list)


def _sign_body(body_bytes: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


async def fetch_hook_skills(
    hook_url: str,
    hook_secret: str | None,
    user_id: str,
    agent_id: str,
    session_id: str | None,
    metadata: dict,
) -> list[HookSkill]:
    """
    POST to hook_url with request context. Returns injected skills or [] on any failure.
    Failure is always non-blocking — errors are logged as warnings only.
    """
    payload = {
        "user_id": user_id,
        "agent_id": agent_id,
        "session_id": session_id,
        "metadata": metadata or {},
    }
    body_bytes = json.dumps(payload, separators=(",", ":")).encode()
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if hook_secret:
        headers["X-Hook-Signature"] = _sign_body(body_bytes, hook_secret)

    try:
        async with httpx.AsyncClient(timeout=_HOOK_TIMEOUT_SECONDS) as client:
            response = await client.post(hook_url, content=body_bytes, headers=headers)
    except httpx.TimeoutException:
        logger.warning("skills.hook: timeout calling %s", hook_url)
        return []
    except Exception as exc:
        logger.warning("skills.hook: request error for %s — %s", hook_url, exc)
        return []

    if response.status_code != 200:
        logger.warning(
            "skills.hook: non-200 response %d from %s", response.status_code, hook_url
        )
        return []

    try:
        data = response.json()
        raw_skills = data.get("skills", [])
    except Exception as exc:
        logger.warning("skills.hook: malformed JSON from %s — %s", hook_url, exc)
        return []

    results: list[HookSkill] = []
    for raw in raw_skills:
        if not isinstance(raw, dict):
            continue
        name = raw.get("name")
        description = raw.get("description")
        if not name or not description:
            continue
        results.append(
            HookSkill(
                name=str(name),
                description=str(description),
                skill_type=str(raw.get("skill_type", "executable")),
                implementation=str(raw.get("implementation", "")),
                version=str(raw.get("version", "1.0.0")),
                allowed_tools=list(raw.get("allowed_tools") or []),
                user_invocable=bool(raw.get("user_invocable", False)),
                disable_model_invocation=bool(raw.get("disable_model_invocation", False)),
                context_requirements=list(raw.get("context_requirements") or []),
            )
        )
    return results
```

- [x] **Step 4: Run tests to confirm they pass**

```bash
cd backend
pytest tests/test_skills_hook.py -v
```

Expected: 4 tests pass.

- [x] **Step 5: Commit**

```bash
git add backend/skills/hook.py backend/tests/test_skills_hook.py
git commit -m "feat(phase7): skills/hook.py — async HTTP hook with HMAC signing and graceful fallback"
```

---

## Task 5: `skills/resolver.py` — Priority merge

**Files:**
- Create: `backend/skills/resolver.py`
- Create: `backend/tests/test_skills_resolver.py`

- [x] **Step 1: Write failing tests**

Create `backend/tests/test_skills_resolver.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from skills.resolver import resolve_skills, ResolvedSkill
from skills.loader import SystemSkill
from skills.hook import HookSkill


def _make_agent(skill_hook_url=None, skill_hook_secret=None, skills=None):
    agent = MagicMock()
    agent.id = "agent-1"
    agent.skill_hook_url = skill_hook_url
    agent.skill_hook_secret = skill_hook_secret
    agent.skills = skills or []
    return agent


def _make_db_skill(name, skill_type="executable", user_id=None, disable_model_invocation=False):
    s = MagicMock()
    s.name = name
    s.description = f"{name} description"
    s.skill_type = skill_type
    s.implementation = f"return {{'{name}': True}}"
    s.version = "1.0.0"
    s.author = "user"
    s.user_id = user_id
    s.allowed_tools = []
    s.user_invocable = False
    s.disable_model_invocation = disable_model_invocation
    s.context_requirements = []
    return s


def _make_system_skill(name, skill_type="instruction", disable_model_invocation=False):
    return SystemSkill(
        name=name,
        description=f"{name} description",
        skill_type=skill_type,
        implementation=f"## {name}\nInstructions here.",
        disable_model_invocation=disable_model_invocation,
    )


@pytest.mark.asyncio
async def test_resolver_priority_order():
    """Hook skill wins over DB skill and system skill with the same name."""
    hook_skill = HookSkill(name="my-skill", description="from hook", implementation="return 1")
    db_skill = _make_db_skill("my-skill")
    system_skill = _make_system_skill("my-skill")

    agent = _make_agent(skill_hook_url="https://example.com/hook", skills=[db_skill])

    with patch("skills.resolver.fetch_hook_skills", new=AsyncMock(return_value=[hook_skill])):
        resolved = await resolve_skills(
            agent=agent,
            user_id="user-1",
            session_id="session-1",
            metadata={},
            system_skills=[system_skill],
            db=MagicMock(),
        )

    assert len(resolved) == 1
    assert resolved[0].source == "hook"
    assert resolved[0].description == "from hook"


@pytest.mark.asyncio
async def test_resolver_user_scoping():
    """Skill with user_id='user-A' is NOT returned when resolving for user-B."""
    db_skill_scoped = _make_db_skill("scoped-skill", user_id="user-A")
    db_skill_global = _make_db_skill("global-skill", user_id=None)

    agent = _make_agent(skills=[db_skill_scoped, db_skill_global])

    with patch("skills.resolver.fetch_hook_skills", new=AsyncMock(return_value=[])):
        resolved = await resolve_skills(
            agent=agent,
            user_id="user-B",
            session_id=None,
            metadata={},
            system_skills=[],
            db=MagicMock(),
        )

    names = [r.name for r in resolved]
    assert "global-skill" in names
    assert "scoped-skill" not in names


@pytest.mark.asyncio
async def test_resolver_disable_model_invocation():
    """Skill with disable_model_invocation=True is excluded from resolved list."""
    hidden_skill = _make_db_skill("hidden", disable_model_invocation=True)
    visible_skill = _make_db_skill("visible")

    agent = _make_agent(skills=[hidden_skill, visible_skill])

    with patch("skills.resolver.fetch_hook_skills", new=AsyncMock(return_value=[])):
        resolved = await resolve_skills(
            agent=agent,
            user_id="user-1",
            session_id=None,
            metadata={},
            system_skills=[],
            db=MagicMock(),
        )

    names = [r.name for r in resolved]
    assert "visible" in names
    assert "hidden" not in names


@pytest.mark.asyncio
async def test_resolver_instruction_and_executable_coexist():
    """Both skill_type values can appear in the resolved list."""
    db_skill = _make_db_skill("exec-skill", skill_type="executable")
    sys_skill = _make_system_skill("instr-skill", skill_type="instruction")

    agent = _make_agent(skills=[db_skill])

    with patch("skills.resolver.fetch_hook_skills", new=AsyncMock(return_value=[])):
        resolved = await resolve_skills(
            agent=agent,
            user_id="user-1",
            session_id=None,
            metadata={},
            system_skills=[sys_skill],
            db=MagicMock(),
        )

    types = {r.name: r.skill_type for r in resolved}
    assert types["exec-skill"] == "executable"
    assert types["instr-skill"] == "instruction"
```

- [x] **Step 2: Run tests to confirm they fail**

```bash
cd backend
pytest tests/test_skills_resolver.py -v
```

Expected: `ModuleNotFoundError: No module named 'skills.resolver'`

- [x] **Step 3: Create `backend/skills/resolver.py`**

```python
import logging
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from db.models import Agent
from skills.hook import HookSkill, fetch_hook_skills
from skills.loader import SystemSkill

logger = logging.getLogger(__name__)


@dataclass
class ResolvedSkill:
    name: str
    description: str
    skill_type: str
    implementation: str
    version: str
    author: str
    allowed_tools: list[str] = field(default_factory=list)
    user_invocable: bool = False
    disable_model_invocation: bool = False
    context_requirements: list[str] = field(default_factory=list)
    source: str = "system"  # "hook" | "user" | "system"


def _from_hook(skill: HookSkill) -> ResolvedSkill:
    return ResolvedSkill(
        name=skill.name,
        description=skill.description,
        skill_type=skill.skill_type,
        implementation=skill.implementation,
        version=skill.version,
        author="hook",
        allowed_tools=skill.allowed_tools,
        user_invocable=skill.user_invocable,
        disable_model_invocation=skill.disable_model_invocation,
        context_requirements=skill.context_requirements,
        source="hook",
    )


def _from_db(skill: object) -> ResolvedSkill:
    return ResolvedSkill(
        name=skill.name,  # type: ignore[attr-defined]
        description=skill.description,  # type: ignore[attr-defined]
        skill_type=getattr(skill, "skill_type", "executable"),
        implementation=skill.implementation,  # type: ignore[attr-defined]
        version=getattr(skill, "version", "1.0.0"),
        author=getattr(skill, "author", "user"),
        allowed_tools=list(getattr(skill, "allowed_tools", None) or []),
        user_invocable=bool(getattr(skill, "user_invocable", False)),
        disable_model_invocation=bool(getattr(skill, "disable_model_invocation", False)),
        context_requirements=list(getattr(skill, "context_requirements", None) or []),
        source="user",
    )


def _from_system(skill: SystemSkill) -> ResolvedSkill:
    return ResolvedSkill(
        name=skill.name,
        description=skill.description,
        skill_type=skill.skill_type,
        implementation=skill.body,
        version=skill.version,
        author=skill.author,
        allowed_tools=skill.allowed_tools,
        user_invocable=skill.user_invocable,
        disable_model_invocation=skill.disable_model_invocation,
        context_requirements=skill.context_requirements,
        source="system",
    )


async def resolve_skills(
    agent: Agent,
    user_id: str | None,
    session_id: str | None,
    metadata: dict | None,
    system_skills: list[SystemSkill],
    db: Session,
) -> list[ResolvedSkill]:
    """
    Merge skills from three sources in priority order: hook > user DB > system.
    Skills with disable_model_invocation=True are excluded from the result.
    On name collision, the higher-priority source wins.
    """
    seen: set[str] = set()
    results: list[ResolvedSkill] = []

    def _add(skill: ResolvedSkill) -> None:
        if skill.disable_model_invocation:
            return
        if skill.name not in seen:
            seen.add(skill.name)
            results.append(skill)

    # 1. Hook skills (highest priority)
    if agent.skill_hook_url:
        hook_skills = await fetch_hook_skills(
            hook_url=agent.skill_hook_url,
            hook_secret=agent.skill_hook_secret,
            user_id=user_id or "",
            agent_id=agent.id,
            session_id=session_id,
            metadata=metadata or {},
        )
        for hs in hook_skills:
            _add(_from_hook(hs))

    # 2. DB skills attached to this agent, filtered by user_id
    for db_skill in agent.skills:
        skill_user_id = getattr(db_skill, "user_id", None)
        if skill_user_id is not None and skill_user_id != user_id:
            continue  # scoped to a different user
        _add(_from_db(db_skill))

    # 3. System filesystem skills (lowest priority)
    for sys_skill in system_skills:
        _add(_from_system(sys_skill))

    return results
```

- [x] **Step 4: Run tests to confirm they pass**

```bash
cd backend
pytest tests/test_skills_resolver.py -v
```

Expected: 4 tests pass.

- [x] **Step 5: Commit**

```bash
git add backend/skills/resolver.py backend/tests/test_skills_resolver.py
git commit -m "feat(phase7): skills/resolver.py — hook > user > system priority merge"
```

---

## Task 6: Update `skills/registry.py`

**Files:**
- Modify: `backend/skills/registry.py`
- Modify: `backend/tests/test_skills_registry.py`

- [x] **Step 1: Update existing tests and add two new ones**

Replace `backend/tests/test_skills_registry.py` entirely:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from langchain_core.tools import Tool
from skills.registry import build_tools_for_agent
from skills.resolver import ResolvedSkill


def _make_resolved(name: str, skill_type: str = "executable", implementation: str = "return {'ok': True}") -> ResolvedSkill:
    return ResolvedSkill(
        name=name,
        description=f"{name} description",
        skill_type=skill_type,
        implementation=implementation,
        version="1.0.0",
        author="user",
        source="user",
    )


def _make_agent():
    agent = MagicMock()
    agent.id = "agent-1"
    agent.skill_hook_url = None
    agent.skill_hook_secret = None
    agent.skills = []
    return agent


@pytest.mark.asyncio
async def test_build_tools_returns_tools_for_executable_skills():
    agent = _make_agent()
    resolved = [_make_resolved("echo", skill_type="executable", implementation="return {'echo': input.get('x', '')}")]

    with patch("skills.registry.resolve_skills", new=AsyncMock(return_value=resolved)):
        tools, instruction_skills = await build_tools_for_agent(agent=agent, user_id="u1", db=MagicMock())

    assert len(tools) == 1
    assert isinstance(tools[0], Tool)
    assert tools[0].name == "echo"
    assert instruction_skills == []


@pytest.mark.asyncio
async def test_build_tools_excludes_instruction_skills_from_tools():
    agent = _make_agent()
    resolved = [_make_resolved("my-guide", skill_type="instruction", implementation="## Guide\nDo this.")]

    with patch("skills.registry.resolve_skills", new=AsyncMock(return_value=resolved)):
        tools, instruction_skills = await build_tools_for_agent(agent=agent, user_id="u1", db=MagicMock())

    assert tools == []
    assert len(instruction_skills) == 1
    assert instruction_skills[0].name == "my-guide"


@pytest.mark.asyncio
async def test_build_tools_tool_is_callable():
    agent = _make_agent()
    resolved = [_make_resolved("add", implementation="return {'result': input['a'] + input['b']}")]

    with patch("skills.registry.resolve_skills", new=AsyncMock(return_value=resolved)):
        tools, _ = await build_tools_for_agent(agent=agent, user_id="u1", db=MagicMock())

    result = tools[0].func({"a": 2, "b": 3})
    assert result == {"result": 5}


@pytest.mark.asyncio
async def test_build_tools_empty_when_no_skills():
    agent = _make_agent()

    with patch("skills.registry.resolve_skills", new=AsyncMock(return_value=[])):
        tools, instruction_skills = await build_tools_for_agent(agent=agent, user_id="u1", db=MagicMock())

    assert tools == []
    assert instruction_skills == []


@pytest.mark.asyncio
async def test_build_tools_execution_error_returns_error_dict():
    agent = _make_agent()
    resolved = [_make_resolved("bad", implementation="raise ValueError('boom')")]

    with patch("skills.registry.resolve_skills", new=AsyncMock(return_value=resolved)):
        tools, _ = await build_tools_for_agent(agent=agent, user_id="u1", db=MagicMock())

    result = tools[0].func({})
    assert result["status"] == "error"
    assert "boom" in result["message"]


@pytest.mark.asyncio
async def test_build_tools_mixed_types_split_correctly():
    agent = _make_agent()
    resolved = [
        _make_resolved("exec-skill", skill_type="executable"),
        _make_resolved("instr-skill", skill_type="instruction"),
    ]

    with patch("skills.registry.resolve_skills", new=AsyncMock(return_value=resolved)):
        tools, instruction_skills = await build_tools_for_agent(agent=agent, user_id="u1", db=MagicMock())

    assert len(tools) == 1
    assert tools[0].name == "exec-skill"
    assert len(instruction_skills) == 1
    assert instruction_skills[0].name == "instr-skill"
```

- [x] **Step 2: Run tests to confirm they fail**

```bash
cd backend
pytest tests/test_skills_registry.py -v
```

Expected: failures because `build_tools_for_agent` still has the old signature.

- [x] **Step 3: Replace `backend/skills/registry.py`**

```python
import logging
from typing import Any

from langchain_core.tools import Tool
from sqlalchemy.orm import Session

from db.models import Agent
from skills.loader import SystemSkill
from skills.resolver import ResolvedSkill, resolve_skills

logger = logging.getLogger(__name__)

# Allowlist of safe builtins available inside executable skill implementations.
_SAFE_BUILTINS = {
    "len": len,
    "range": range,
    "enumerate": enumerate,
    "zip": zip,
    "map": map,
    "filter": filter,
    "sorted": sorted,
    "list": list,
    "dict": dict,
    "str": str,
    "int": int,
    "float": float,
    "bool": bool,
    "None": None,
    "True": True,
    "False": False,
    "isinstance": isinstance,
    "print": print,
    "ValueError": ValueError,
    "TypeError": TypeError,
    "KeyError": KeyError,
    "IndexError": IndexError,
    "RuntimeError": RuntimeError,
    "Exception": Exception,
}


def _make_executor(implementation: str):
    """
    Return a callable that executes the skill's Python implementation body.
    The implementation string is wrapped in a function so `return` works.
    Only _SAFE_BUILTINS is available (no __builtins__ access).
    """
    wrapped = "def _skill_fn(input):\n" + "\n".join(
        f"    {line}" for line in implementation.splitlines()
    )

    def safe_execute(input: dict[str, Any]) -> Any:
        ns: dict[str, Any] = {"__builtins__": _SAFE_BUILTINS}
        try:
            exec(wrapped, ns)  # noqa: S102
            return ns["_skill_fn"](input)
        except Exception as e:
            return {"status": "error", "message": str(e)}

    return safe_execute


async def build_tools_for_agent(
    agent: Agent,
    user_id: str | None = None,
    session_id: str | None = None,
    metadata: dict | None = None,
    system_skills: list[SystemSkill] | None = None,
    db: Session | None = None,
) -> tuple[list[Tool], list[ResolvedSkill]]:
    """
    Resolve all skills for this agent+user and split into:
    - list[Tool]: LangChain tools built from skill_type='executable' skills
    - list[ResolvedSkill]: skill_type='instruction' skills for system prompt injection

    Calls resolver.resolve_skills() which merges hook > user DB > system sources.
    """
    resolved = await resolve_skills(
        agent=agent,
        user_id=user_id,
        session_id=session_id,
        metadata=metadata,
        system_skills=system_skills or [],
        db=db,
    )

    tools: list[Tool] = []
    instruction_skills: list[ResolvedSkill] = []

    for skill in resolved:
        if skill.skill_type == "instruction":
            instruction_skills.append(skill)
        else:
            executor = _make_executor(skill.implementation)
            tools.append(
                Tool(
                    name=skill.name,
                    description=skill.description,
                    func=executor,
                )
            )

    return tools, instruction_skills
```

- [x] **Step 4: Run tests to confirm they pass**

```bash
cd backend
pytest tests/test_skills_registry.py -v
```

Expected: 6 tests pass.

- [x] **Step 5: Commit**

```bash
git add backend/skills/registry.py backend/tests/test_skills_registry.py
git commit -m "feat(phase7): skills/registry.py — returns (tools, instruction_skills) tuple via resolver"
```

---

## Task 7: Update `graph/prompt.py`

**Files:**
- Modify: `backend/graph/prompt.py`

- [x] **Step 1: Write failing test**

Add this test to `backend/tests/test_graph_state.py` (or create `backend/tests/test_graph_prompt.py`):

```python
from unittest.mock import MagicMock
from skills.resolver import ResolvedSkill
from graph.prompt import build_system_prompt


def _make_agent(persona="I am an agent.", rules=None):
    agent = MagicMock()
    agent.persona = persona
    agent.rules = rules
    return agent


def _make_instr_skill(name: str, body: str) -> ResolvedSkill:
    return ResolvedSkill(
        name=name,
        description="test",
        skill_type="instruction",
        implementation=body,
        version="1.0.0",
        author="system",
        source="system",
    )


def test_build_system_prompt_no_skills():
    agent = _make_agent(persona="I am an agent.", rules="Be helpful.")
    prompt = build_system_prompt(agent)
    assert "I am an agent." in prompt
    assert "Be helpful." in prompt


def test_build_system_prompt_appends_instruction_skills():
    agent = _make_agent(persona="I am an agent.")
    skills = [_make_instr_skill("read-file", "Read files carefully.")]
    prompt = build_system_prompt(agent, instruction_skills=skills)
    assert "## read-file" in prompt
    assert "Read files carefully." in prompt


def test_build_system_prompt_multiple_skills():
    agent = _make_agent(persona="Agent.")
    skills = [
        _make_instr_skill("skill-a", "Do A."),
        _make_instr_skill("skill-b", "Do B."),
    ]
    prompt = build_system_prompt(agent, instruction_skills=skills)
    assert "## skill-a" in prompt
    assert "Do A." in prompt
    assert "## skill-b" in prompt
    assert "Do B." in prompt
```

- [x] **Step 2: Run tests to confirm they fail**

```bash
cd backend
pytest tests/test_graph_prompt.py -v
```

Expected: `TypeError` because `build_system_prompt` doesn't accept `instruction_skills`.

- [x] **Step 3: Update `backend/graph/prompt.py`**

```python
from __future__ import annotations

from typing import TYPE_CHECKING

from db.models import Agent

if TYPE_CHECKING:
    from skills.resolver import ResolvedSkill


def build_system_prompt(
    agent: Agent,
    instruction_skills: list[ResolvedSkill] | None = None,
) -> str:
    """
    Assemble the system prompt for an agent from DB fields and instruction skills.

    Order:
      1. persona     (always present — SOUL.md equivalent)
      2. rules       (if set — AGENTS.md equivalent)
      3. instruction skills (injected as named ## sections, one per skill)
    """
    sections = [agent.persona]

    if agent.rules:
        sections.append("\n\n## Operating Rules\n\n" + agent.rules)

    if instruction_skills:
        for skill in instruction_skills:
            sections.append(f"\n\n## {skill.name}\n\n{skill.implementation}")

    return "\n".join(sections)
```

- [x] **Step 4: Run tests to confirm they pass**

```bash
cd backend
pytest tests/test_graph_prompt.py -v
```

Expected: 3 tests pass.

- [x] **Step 5: Commit**

```bash
git add backend/graph/prompt.py backend/tests/test_graph_prompt.py
git commit -m "feat(phase7): graph/prompt.py — append instruction_skills as named sections"
```

---

## Task 8: Update `graph/state.py` and `api/chat.py`

**Files:**
- Modify: `backend/graph/state.py`
- Modify: `backend/api/chat.py`

- [x] **Step 1: Add `metadata` to `SupervisorState`**

Replace `backend/graph/state.py`:

```python
from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class SupervisorState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    user_id: str
    session_id: str
    intent: str | None    # set by classifier node; drives conditional routing
    response: str | None  # set by specialist subgraph; returned to caller
    metadata: dict | None # forwarded from chat request to hook; optional free-form context
```

- [x] **Step 2: Add `metadata` to `ChatRequest` and pass it in initial state**

In `backend/api/chat.py`, update `ChatRequest` and the initial state construction:

```python
class ChatRequest(BaseModel):
    session_id: str
    message: str
    metadata: dict | None = None   # forwarded to skill hook

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("message must not be empty")
        return v.strip()
```

And update the initial state block in the `chat` handler:

```python
    initial_state: SupervisorState = {
        "messages": history_messages + [HumanMessage(content=body.message)],
        "user_id": session.user_id,
        "session_id": session.id,
        "intent": None,
        "response": None,
        "metadata": body.metadata,
    }
```

- [x] **Step 3: Verify existing chat tests still pass**

```bash
cd backend
pytest tests/test_api_chat.py -v
```

Expected: all existing chat tests still pass (metadata is optional, defaults to None).

- [x] **Step 4: Commit**

```bash
git add backend/graph/state.py backend/api/chat.py
git commit -m "feat(phase7): add metadata field to SupervisorState and ChatRequest"
```

---

## Task 9: Update `graph/specialist.py` and `graph/registry.py`

**Files:**
- Modify: `backend/graph/specialist.py`
- Modify: `backend/graph/registry.py`

This is the key architectural change: specialist becomes a lazy async node; registry caches `system_skills`.

- [x] **Step 1: Update `backend/graph/registry.py`**

```python
import asyncio
import logging
from pathlib import Path
from typing import Any

from db.models import Agent, RoutingRule
from skills.loader import SystemSkill, load_system_skills

logger = logging.getLogger(__name__)

# Canonical location of system skill packages relative to project root
_SKILLS_DIR = Path(__file__).resolve().parent.parent.parent / ".agents" / "skills"


class GraphRegistry:
    """
    Holds the compiled LangGraph supervisor graph and cached system skills.

    rebuild() is called:
    - Once at app startup (in main.py lifespan)
    - After every CRUD mutation to agents, skills, providers, or routing rules

    The graph is replaced atomically — in-flight requests use the previous graph,
    the next request gets the new one.
    """

    def __init__(self) -> None:
        self._graph: Any | None = None
        self._lock = asyncio.Lock()
        self.system_skills: list[SystemSkill] = []

    async def rebuild(self, db: Any = None) -> None:
        """Recompile the supervisor graph from current DB state."""
        if db is None:
            return  # called without DB context (e.g. during testing stubs)

        # Reload system skills from filesystem on every rebuild
        self.system_skills = load_system_skills(_SKILLS_DIR)
        logger.info("graph_registry: loaded %d system skills", len(self.system_skills))

        from graph.supervisor import build_supervisor_graph

        supervisor = db.query(Agent).filter_by(is_supervisor=True).first()
        if not supervisor:
            self._graph = None
            return

        specialists = db.query(Agent).filter_by(is_supervisor=False).all()
        routing_rules = (
            db.query(RoutingRule)
            .filter_by(supervisor_id=supervisor.id)
            .order_by(RoutingRule.priority)
            .all()
        )

        async with self._lock:
            self._graph = build_supervisor_graph(supervisor, specialists, routing_rules)

    async def get(self) -> Any | None:
        """Return the compiled graph, or None if not yet built."""
        return self._graph

    def is_compiled(self) -> bool:
        return self._graph is not None


# Module-level singleton shared across the application
graph_registry = GraphRegistry()
```

- [x] **Step 2: Update `backend/graph/specialist.py`**

```python
from typing import Any, Callable

from langchain_core.language_models import BaseChatModel
from langgraph.prebuilt import create_react_agent

from db.models import Agent
from graph.prompt import build_system_prompt
from graph.state import SupervisorState
from providers.factory import provider_factory
from skills.registry import build_tools_for_agent


def build_specialist_node(agent: Agent) -> Callable:
    """
    Return an async node function for a specialist agent.

    Unlike the previous approach (pre-compiled create_react_agent subgraph),
    this function resolves skills lazily at invocation time using user_id and
    metadata from the graph state. This is required because skill resolution
    depends on per-request context (user identity, hook injection).

    The LLM is instantiated once (at graph compile time) and reused across requests.
    """
    llm: BaseChatModel = provider_factory(agent.provider)

    async def specialist_node(state: SupervisorState) -> dict[str, Any]:
        from db.database import SessionLocal
        from graph.registry import graph_registry

        user_id: str | None = state.get("user_id")
        session_id: str | None = state.get("session_id")
        metadata: dict | None = state.get("metadata")

        db = SessionLocal()
        try:
            tools, instruction_skills = await build_tools_for_agent(
                agent=agent,
                user_id=user_id,
                session_id=session_id,
                metadata=metadata,
                system_skills=graph_registry.system_skills,
                db=db,
            )
        finally:
            db.close()

        system_prompt = build_system_prompt(agent, instruction_skills)
        react_agent = create_react_agent(
            model=llm,
            tools=tools,
            prompt=system_prompt,
        )
        result = await react_agent.ainvoke(state)
        return result

    return specialist_node
```

- [x] **Step 3: Update `graph/supervisor.py` to use `build_specialist_node`**

In `backend/graph/supervisor.py`, change the import and node construction:

```python
from graph.specialist import build_specialist_node  # was build_specialist_subgraph
```

And in `build_supervisor_graph`, change:

```python
    for agent in specialists:
        node_fn = build_specialist_node(agent)   # was build_specialist_subgraph(agent)
        graph.add_node(agent.id, node_fn)
        graph.add_edge(agent.id, END)
```

- [x] **Step 4: Run all existing tests**

```bash
cd backend
pytest -v --tb=short
```

Expected: all 58 existing tests still pass (graph tests may need mocking updates — see below). If `test_graph_state.py` fails because it tests the old `SupervisorState`, update it to include `metadata`.

- [x] **Step 5: Commit**

```bash
git add backend/graph/specialist.py backend/graph/registry.py backend/graph/supervisor.py
git commit -m "feat(phase7): specialist becomes lazy async node; registry caches system_skills"
```

---

## Task 10: API schema updates — skills and agents

**Files:**
- Modify: `backend/api/skills.py`
- Modify: `backend/api/agents.py`

- [x] **Step 1: Write failing API tests**

Add to `backend/tests/test_api_skills.py` (append, do not replace existing tests):

```python
def test_api_skill_metadata_fields(client):
    """Creating a skill with new fields returns them in GET response."""
    # Create a provider and agent first (required for seeded DB)
    # Create skill with new fields
    resp = client.post("/api/skills", json={
        "name": "typed-skill",
        "description": "A typed skill.",
        "implementation": "return {'ok': True}",
        "input_schema": {},
        "skill_type": "executable",
        "version": "2.0.0",
        "author": "test-author",
        "allowed_tools": ["bash"],
        "user_invocable": True,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["skill_type"] == "executable"
    assert data["version"] == "2.0.0"
    assert data["author"] == "test-author"
    assert data["allowed_tools"] == ["bash"]
    assert data["user_invocable"] is True
    assert data["disable_model_invocation"] is False
    assert data["context_requirements"] == []


def test_api_skills_system_endpoint(client):
    """GET /api/skills/system returns a list (may be empty in test env)."""
    resp = client.get("/api/skills/system")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
```

Add to `backend/tests/test_api_agents.py`:

```python
def test_agent_skill_hook_fields(client):
    """Updating agent with skill_hook_url/secret returns them in GET response."""
    # Create provider
    prov = client.post("/api/providers", json={
        "name": "hook-test-provider",
        "type": "anthropic_api_key",
        "credentials": {"api_key": "test"},
        "model": "claude-3-haiku-20240307",
    }).json()

    # Create agent
    agent = client.post("/api/agents", json={
        "name": "hook-test-agent",
        "persona": "I am a test agent.",
        "provider_id": prov["id"],
        "is_supervisor": False,
    }).json()

    # Update with hook fields
    resp = client.put(f"/api/agents/{agent['id']}", json={
        "skill_hook_url": "https://example.com/hook",
        "skill_hook_secret": "my-secret",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["skill_hook_url"] == "https://example.com/hook"
    assert data["skill_hook_secret"] == "my-secret"
```

- [x] **Step 2: Run new tests to confirm they fail**

```bash
cd backend
pytest tests/test_api_skills.py::test_api_skill_metadata_fields tests/test_api_skills.py::test_api_skills_system_endpoint tests/test_api_agents.py::test_agent_skill_hook_fields -v
```

Expected: failures because schemas don't have the new fields yet.

- [x] **Step 3: Update `backend/api/skills.py`**

```python
from datetime import datetime
from typing import Any

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
    skill_type: str = "executable"
    version: str = "1.0.0"
    author: str = "user"
    user_id: str | None = None
    allowed_tools: list[str] = []
    user_invocable: bool = False
    disable_model_invocation: bool = False
    context_requirements: list[str] = []


class SkillUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    input_schema: dict | None = None
    implementation: str | None = None
    skill_type: str | None = None
    version: str | None = None
    author: str | None = None
    user_id: str | None = None
    allowed_tools: list[str] | None = None
    user_invocable: bool | None = None
    disable_model_invocation: bool | None = None
    context_requirements: list[str] | None = None


class SkillOut(BaseModel):
    id: str
    name: str
    description: str
    input_schema: dict
    implementation: str
    created_at: datetime
    skill_type: str
    version: str
    author: str
    user_id: str | None
    allowed_tools: list[Any]
    user_invocable: bool
    disable_model_invocation: bool
    context_requirements: list[Any]
    model_config = ConfigDict(from_attributes=True)


class SystemSkillOut(BaseModel):
    name: str
    description: str
    version: str
    author: str
    skill_type: str
    allowed_tools: list[str]
    user_invocable: bool
    disable_model_invocation: bool
    context_requirements: list[str]
    body: str
    source_path: str


@router.get("/system", response_model=list[SystemSkillOut])
def list_system_skills():
    """Return system skills loaded from .agents/skills/ at last graph rebuild."""
    return [
        SystemSkillOut(
            name=s.name,
            description=s.description,
            version=s.version,
            author=s.author,
            skill_type=s.skill_type,
            allowed_tools=s.allowed_tools,
            user_invocable=s.user_invocable,
            disable_model_invocation=s.disable_model_invocation,
            context_requirements=s.context_requirements,
            body=s.body,
            source_path=s.source_path,
        )
        for s in graph_registry.system_skills
    ]


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

- [x] **Step 4: Update `backend/api/agents.py` — add skill hook fields to `AgentOut` and `AgentUpdate`**

Open `backend/api/agents.py`. Add to `AgentOut`:
```python
    skill_hook_url: str | None
    skill_hook_secret: str | None
```

Add to `AgentUpdate`:
```python
    skill_hook_url: str | None = None
    skill_hook_secret: str | None = None
```

- [x] **Step 5: Run all failing tests**

```bash
cd backend
pytest tests/test_api_skills.py tests/test_api_agents.py -v
```

Expected: all tests pass including the new ones.

- [x] **Step 6: Commit**

```bash
git add backend/api/skills.py backend/api/agents.py
git commit -m "feat(phase7): API schemas — skill metadata fields, GET /api/skills/system, agent skill hook fields"
```

---

## Task 11: Full test suite + review checkpoint

**Files:** None (verification only)

- [x] **Step 1: Run the full test suite**

```bash
cd backend
pytest -v --tb=short 2>&1 | tail -30
```

Expected: all tests pass. The count should be ≥ 73 (58 existing + 15 new).

- [x] **Step 2: Fix any failures**

Common issues:
- `test_graph_state.py` — if it asserts the exact keys of `SupervisorState`, add `metadata`.
- `test_api_skills.py` existing tests — they now receive extra fields in the response; `assert` on specific fields rather than exact dict equality will pass.
- Import cycles — if you see circular import, move the `from graph.registry import graph_registry` inside the function body (it is already done that way in `specialist.py`).

- [x] **Step 3: Run linting**

```bash
cd backend
python -m flake8 skills/ graph/ api/ --max-line-length=120 --extend-ignore=E501,W503
```

Fix any `F401` (unused import) or `E302` (missing blank lines) warnings.

- [x] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(phase7): complete skill registry redesign — all tests passing"
```

---

## Checkpoint Review

After Task 11, the following spec requirements should all be satisfied. Verify each:

| Spec requirement | Verified by |
|---|---|
| System skills load from `.agents/skills/*/SKILL.md` | `test_loader_*` (3 tests) |
| Missing frontmatter fields default gracefully | `test_loader_handles_missing_optional_fields` |
| Hook called with user_id + metadata, returns skills | `test_hook_returns_skills` |
| Hook timeout returns `[]`, never raises | `test_hook_timeout_fallback` |
| Hook 500 returns `[]` with warning | `test_hook_bad_response_fallback` |
| Request signed with HMAC when secret set | `test_hook_hmac_signature` |
| hook > user > system priority | `test_resolver_priority_order` |
| user_id scoping enforced | `test_resolver_user_scoping` |
| disable_model_invocation excludes skill | `test_resolver_disable_model_invocation` |
| instruction skills excluded from tools | `test_resolver_instruction_excluded_from_tools` (via registry tests) |
| instruction skills appear in system prompt | `test_build_system_prompt_appends_instruction_skills` |
| `GET /api/skills/system` endpoint exists | `test_api_skills_system_endpoint` |
| Skill metadata fields in create/get | `test_api_skill_metadata_fields` |
| Agent skill_hook_url/secret fields | `test_agent_skill_hook_fields` |
| metadata in chat request + state | verified by existing chat tests not breaking |
