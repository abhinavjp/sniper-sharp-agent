# Phase 7 Bug-Fix + UI-5 Polish — Design Spec

**Date:** 2026-04-01
**Status:** Approved
**Approach:** Parallel subagents — Track A (backend Python) and Track B (frontend TypeScript) are independent and run simultaneously.

---

## Context

Phase 7 (Skill Registry Redesign) was implemented and all 77 tests pass, but a post-implementation code review identified five backend defects — two of which are blocking for correct multi-turn chat. Phase UI-5 established the design conventions and created the `frontend-design` skill, but the polish pass, Phase 7 API surface exposure, and design consistency work were not completed.

Both tracks are fully independent: no shared files, no ordering dependency. The only coordination point is the API field names `skill_hook_url` and `skill_hook_secret`, which both tracks must use consistently.

---

## Track A — Backend Bug Fixes

### Scope

Five targeted fixes to `backend/`. All changes follow TDD: failing test written first, then implementation fixed.

### A1 — AIMessage history reconstruction (`chat.py`)

**Problem:** `POST /api/chat` reconstructs conversation history from the session's stored turns but only creates `HumanMessage` objects. Assistant turns are silently discarded, meaning the LLM sees no prior assistant responses on turn 2+.

**Fix:** Add `elif turn["role"] == "assistant": history_messages.append(AIMessage(content=turn["content"]))` in the history loop.

**Test:** Add `test_chat_preserves_assistant_history` to `test_api_chat.py`. Send turn 1, mock a response, send turn 2, assert that the graph receives both the human and assistant messages from turn 1 in its initial state.

### A2 — Specialist node must set `response` field (`graph/specialist.py`)

**Problem:** The lazy specialist node calls `create_react_agent` and returns its result dict directly. That dict only contains `messages`; the `response` key is never set. `chat.py` falls back to extracting the last AIMessage silently, which masks any node failure.

**Fix:** After the `create_react_agent` invocation, extract the content of the last `AIMessage` from the result messages and return it as `{"messages": ..., "response": extracted_text}` explicitly.

**Test:** Update existing chat API tests in `test_api_chat.py` to assert `result["response"]` is a non-empty string in the returned state. There is no dedicated `test_graph_specialist.py` — specialist coverage is via the chat integration tests.

### A3 — `user_id` type in `SupervisorState` (`graph/state.py`)

**Problem:** `user_id: str` is declared as required, but the resolver, specialist, and hook all treat it as `str | None`. This creates a type mismatch that mypy and runtime edge cases expose.

**Fix:** Change declaration to `user_id: str | None`.

**Test:** Existing tests cover this implicitly; verify no regressions.

### A4 — `AgentOut` missing `config_hook_url`/`config_hook_secret` (`api/agents.py`)

**Problem:** `AgentOut` exposes `skill_hook_url` and `skill_hook_secret` (added in Phase 7) but not the older `config_hook_url` and `config_hook_secret`. API consumers cannot see the existing config hook fields, creating an asymmetric response model.

**Fix:** Add `config_hook_url: str | None` and `config_hook_secret: str | None` to `AgentOut`.

**Test:** Update `test_api_agents.py` — assert both `config_hook_*` fields appear in the GET response.

### A5 — Missing test: instruction skills injected into system prompt (`tests/test_skills_registry.py`)

**Problem:** No test explicitly verifies that `instruction`-type skills have their body text appended to the system prompt during specialist invocation. The integration is implemented but untested.

**Fix:** Add `test_instruction_skills_injected_into_prompt` — create a mock instruction skill with a known body string, call `build_tools_for_agent`, assert the body string appears in the prompt passed to the specialist.

### A6 — Doc update

At the end of Track A: append a "Bug-Fix Addendum" section to `docs/superpowers/plans/2026-03-31-phase7-skill-registry.md` listing the five fixes with checkbox status. Mark Phase 7 complete (`✅`) in `docs/ROADMAP.md`.

---

## Track B — Frontend UI-5 Polish

### Scope

Six groups of changes across `ui/src/`. All changes preserve the glassmorphism + indigo/blue design language from `docs/FRONTEND_DESIGN_CONVENTIONS.md`.

### B1 — API client: Phase 7 fields + system skills (`api/client.ts`)

**Changes:**
- Add `skill_hook_url: string | null` and `skill_hook_secret: string | null` to the `Agent` interface.
- Add `SystemSkill` type: `{ name, description, version, author, skill_type, allowed_tools, user_invocable, body }`.
- Add `listSystemSkills(): Promise<SystemSkill[]>` calling `GET /api/skills/system`.

### B2 — AgentsView: skill hook fields + attach/detach feedback (`AgentsView.tsx`)

**Changes:**
- Rename the two existing "Config Hook" form fields to "Skill Hook" — update labels, field names, and state keys to use `skill_hook_url`/`skill_hook_secret`.
- During skill attach: change button text to "Attaching…" and disable. During detach: change button text to "Removing…" and disable. Both revert on completion or error.

### B3 — SkillsView: system skills tab + design polish (`SkillsView.tsx`)

**Changes:**
- Add a tab bar: "User-Defined" (existing CRUD list) | "System" (read-only list from `listSystemSkills()`).
- System tab renders read-only cards showing: name, description, version badge, type badge (`instruction` / `executable`), and `allowed_tools` chips.
- Submit button: add `hover:scale-[1.01] active:scale-[0.99]` transition.
- Form label class: add `font-medium` to match `text-xs font-medium text-slate-500 dark:text-slate-400` standard.

### B4 — ProvidersView: dark mode fix (`ProvidersView.tsx`)

**Problem:** The provider-type select element hardcodes `bg-black/40 border-white/10 text-slate-200` with no light-mode equivalent, breaking the light theme.

**Fix:** Replace with the standard pattern: `bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200`.

### B5 — Design consistency pass (all six views)

Standardise across `ChatView`, `ProvidersView`, `AgentsView`, `SkillsView`, `RoutingRulesView`, `SystemView`:

| Token | Standard value |
|---|---|
| Error message | `text-rose-400 text-sm` |
| Form label | `text-xs font-medium text-slate-500 dark:text-slate-400` |
| Submit button hover | `hover:scale-[1.01] active:scale-[0.99]` |

`RoutingRulesView` only: readonly supervisor field — replace `opacity-60` with explicit `text-slate-400 dark:text-slate-500` to maintain WCAG AA contrast without relying on opacity inheritance.

### B6 — Doc update

At the end of Track B: create `docs/superpowers/plans/2026-04-01-phase-ui5-polish.md` as a completed plan (all tasks checked). Tick all remaining UI-5 items in `docs/ROADMAP.md`.

---

## File Map

### Track A

| File | Change |
|---|---|
| `backend/api/chat.py` | Add AIMessage reconstruction in history loop |
| `backend/graph/specialist.py` | Extract response text and set `response` field explicitly |
| `backend/graph/state.py` | `user_id: str | None` |
| `backend/api/agents.py` | Add `config_hook_url`/`config_hook_secret` to `AgentOut` |
| `backend/tests/test_api_chat.py` | New: `test_chat_preserves_assistant_history`; update existing chat tests to assert `response` key is set |
| `backend/tests/test_api_agents.py` | Update: assert `config_hook_*` in GET response |
| `backend/tests/test_skills_registry.py` | New: `test_instruction_skills_injected_into_prompt` |
| `docs/superpowers/plans/2026-03-31-phase7-skill-registry.md` | Append bug-fix addendum |
| `docs/ROADMAP.md` | Mark Phase 7 `✅` |

### Track B

| File | Change |
|---|---|
| `ui/src/api/client.ts` | Add `skill_hook_*` to Agent type; add `SystemSkill` type + `listSystemSkills()` |
| `ui/src/views/AgentsView.tsx` | Rename config→skill hook fields; add attach/detach loading states |
| `ui/src/views/SkillsView.tsx` | Add system/user tab switcher; design polish |
| `ui/src/views/ProvidersView.tsx` | Fix dark mode select styling |
| `ui/src/views/RoutingRulesView.tsx` | Fix readonly contrast; add button hover scale |
| `ui/src/views/ChatView.tsx` | Standardise error/label tokens (consistency pass) |
| `ui/src/views/SystemView.tsx` | Standardise error/label tokens (consistency pass) |
| `docs/superpowers/plans/2026-04-01-phase-ui5-polish.md` | Create completed plan |
| `docs/ROADMAP.md` | Tick UI-5 remaining items |

---

## Success Criteria

### Track A
- All 77+ tests pass (new tests added: 3 new, 2 updated)
- Multi-turn chat preserves assistant context across turns
- `response` field is always explicitly set by the specialist node
- `AgentOut` exposes all four hook fields symmetrically

### Track B
- Light mode: no hardcoded dark-only colours in any view
- System skills visible in SkillsView under "System" tab
- Skill hook fields visible and correctly labelled in AgentsView
- Error messages, labels, and button hover states are identical across all six views
- `FRONTEND_DESIGN_CONVENTIONS.md` tokens fully applied

---

## Out of Scope

- Phase 8 (Memory System) — separate roadmap item
- `memory_types` UI field in AgentsView — deferred to Phase 8 when memory is implemented
- Session GET/list endpoints — not part of Phase 7 scope
- Empty routing-rules edge case test — deferred to Phase 11 integration tests
