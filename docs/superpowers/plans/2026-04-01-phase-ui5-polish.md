# Phase UI-5 Polish — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the UI-5 polish pass — expose Phase 7's new API surface (skill hook fields, system skills), fix a dark-mode colour bug in ProvidersView, standardise design tokens across all six views, and add attach/detach loading feedback in AgentsView.

**Architecture:** All changes are in `ui/src/`. No new routes, no new dependencies. `client.ts` is updated first (B1) because every subsequent task imports from it. Tasks B2–B5 are independent of each other and can be done in any order after B1.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS 4, react-router-dom v7.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `ui/src/api/client.ts` | Modify | Add `skill_hook_*` to `Agent`; add `SystemSkill` type + `listSystemSkills()` |
| `ui/src/views/AgentsView.tsx` | Modify | Rename Config Hook → Skill Hook; add "Attaching…"/"Removing…" feedback |
| `ui/src/views/SkillsView.tsx` | Modify | Add User-Defined / System tab switcher; submit button hover; label font-weight |
| `ui/src/views/ProvidersView.tsx` | Modify | Fix dark-mode-only select (add light-mode bg/border/text) |
| `ui/src/views/RoutingRulesView.tsx` | Modify | Fix readonly field contrast; add submit button hover scale |
| `ui/src/views/ChatView.tsx` | Modify | Standardise error class to `text-rose-400 text-sm` |
| `ui/src/views/SystemView.tsx` | Modify | Standardise error class to `text-rose-400 text-sm` (if any) |
| `docs/ROADMAP.md` | Modify | Tick remaining UI-5 checkboxes |

---

## Task 1: API client — Phase 7 types and endpoint (`client.ts`)

**Files:**
- Modify: `ui/src/api/client.ts`

**Why first:** `AgentsView` and `SkillsView` both need types from this file. Do this before touching any view.

- [ ] **Step 1: Add `skill_hook_url`/`skill_hook_secret` to the `Agent` interface**

Open `ui/src/api/client.ts`. The `Agent` interface currently ends at line 41 with `skills: Skill[]`. Add two fields after `config_hook_secret`:

```typescript
export interface Agent {
  id: string;
  name: string;
  persona: string;
  rules: string | null;
  provider_id: string;
  is_supervisor: boolean;
  memory_enabled: boolean;
  memory_types: string[];
  config_hook_url: string | null;
  config_hook_secret: string | null;
  skill_hook_url: string | null;
  skill_hook_secret: string | null;
  created_at: string;
  skills: Skill[];
}
```

- [ ] **Step 2: Add `SystemSkill` type after the `Agent` interface**

```typescript
export interface SystemSkill {
  name: string;
  description: string;
  version: string;
  author: string;
  skill_type: string;
  allowed_tools: string[];
  user_invocable: boolean;
  body: string;
}
```

- [ ] **Step 3: Add `skill_hook_*` fields to `updateAgent` body type and `createAgent`**

In the `updateAgent` call (around line 157), add to the `Partial<{...}>` body:

```typescript
  updateAgent: (
    id: string,
    body: Partial<{
      name: string;
      persona: string;
      provider_id: string;
      is_supervisor: boolean;
      rules: string;
      memory_enabled: boolean;
      memory_types: string[];
      config_hook_url: string;
      config_hook_secret: string;
      skill_hook_url: string;
      skill_hook_secret: string;
    }>,
  ) => put<Agent>(`/api/agents/${id}`, body),
```

- [ ] **Step 4: Add `listSystemSkills()` to the Skills section of the api object**

After `deleteSkill`, add:

```typescript
  listSystemSkills: () => get<SystemSkill[]>('/api/skills/system'),
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd ui
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add ui/src/api/client.ts
git commit -m "feat(ui5): add skill_hook fields to Agent type; add SystemSkill + listSystemSkills"
```

---

## Task 2: AgentsView — skill hook fields + attach/detach feedback

**Files:**
- Modify: `ui/src/views/AgentsView.tsx`

**Changes:** (a) Rename the "Config Hook URL" and "Hook Secret" form fields to "Skill Hook URL" and "Skill Hook Secret", wired to `skill_hook_url`/`skill_hook_secret`. (b) Show "Attaching…" / "Removing…" text on the relevant button during async operations.

- [ ] **Step 1: Update `FormState` interface and `EMPTY_FORM`**

At the top of the file, replace the `FormState` interface and `EMPTY_FORM`:

```typescript
interface FormState {
  name: string;
  persona: string;
  rules: string;
  provider_id: string;
  is_supervisor: boolean;
  memory_enabled: boolean;
  config_hook_url: string;
  config_hook_secret: string;
  skill_hook_url: string;
  skill_hook_secret: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  persona: '',
  rules: '',
  provider_id: '',
  is_supervisor: false,
  memory_enabled: false,
  config_hook_url: '',
  config_hook_secret: '',
  skill_hook_url: '',
  skill_hook_secret: '',
};
```

- [ ] **Step 2: Update `handleEdit` to populate the new fields**

In `handleEdit`, replace the `setForm` call:

```typescript
  const handleEdit = (agent: Agent) => {
    setEditingId(agent.id);
    setForm({
      name: agent.name,
      persona: agent.persona,
      rules: agent.rules ?? '',
      provider_id: agent.provider_id,
      is_supervisor: agent.is_supervisor,
      memory_enabled: agent.memory_enabled,
      config_hook_url: agent.config_hook_url ?? '',
      config_hook_secret: agent.config_hook_secret ?? '',
      skill_hook_url: agent.skill_hook_url ?? '',
      skill_hook_secret: agent.skill_hook_secret ?? '',
    });
    setError(null);
  };
```

- [ ] **Step 3: Update `handleSubmit` body to send skill hook fields**

In `handleSubmit`, replace the `body` const:

```typescript
    const body = {
      name: form.name,
      persona: form.persona,
      rules: form.rules || undefined,
      provider_id: form.provider_id,
      is_supervisor: form.is_supervisor,
      memory_enabled: form.memory_enabled,
      config_hook_url: form.config_hook_url || undefined,
      config_hook_secret: form.config_hook_secret || undefined,
      skill_hook_url: form.skill_hook_url || undefined,
      skill_hook_secret: form.skill_hook_secret || undefined,
    };
```

- [ ] **Step 4: Add a `skillBusyId` state to track which agent is busy**

Replace the existing `skillBusy` state declaration with a more specific one that tracks which agent row is performing an operation:

```typescript
  const [skillBusyAgentId, setSkillBusyAgentId] = useState<string | null>(null);
```

Update `handleAttach`:

```typescript
  const handleAttach = async (agentId: string, skillId: string) => {
    if (!skillId) return;
    setSkillBusyAgentId(agentId);
    try {
      await api.attachSkill(agentId, skillId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attach failed');
    } finally {
      setSkillBusyAgentId(null);
    }
  };
```

Update `handleDetach`:

```typescript
  const handleDetach = async (agentId: string, skillId: string) => {
    setSkillBusyAgentId(agentId);
    try {
      await api.detachSkill(agentId, skillId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detach failed');
    } finally {
      setSkillBusyAgentId(null);
    }
  };
```

- [ ] **Step 5: Update the skill panel JSX to use `skillBusyAgentId`**

In the skill panel (the `expandedAgentId === agent.id` block), replace the `skillBusy` references. The Detach button:

```tsx
                            <button
                              disabled={skillBusyAgentId === agent.id}
                              onClick={() => { void handleDetach(agent.id, sk.id); }}
                              className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                            >
                              {skillBusyAgentId === agent.id ? 'Removing…' : 'Detach'}
                            </button>
```

The attach select dropdown:

```tsx
                            <select
                              disabled={skillBusyAgentId === agent.id}
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) void handleAttach(agent.id, e.target.value);
                                e.target.value = '';
                              }}
                              className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-40 transition-all shadow-sm"
                            >
                              <option value="">
                                {skillBusyAgentId === agent.id ? 'Attaching…' : '+ Attach a skill…'}
                              </option>
                              {attachable.map((sk) => (
                                <option key={sk.id} value={sk.id}>{sk.name}</option>
                              ))}
                            </select>
```

- [ ] **Step 6: Replace the Config Hook form fields with Skill Hook fields**

Find the `grid grid-cols-2 gap-4` block containing "Config Hook URL" (around line 326) and replace both fields:

```tsx
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Skill Hook URL <span className="font-normal text-slate-400 dark:text-slate-600">(optional)</span>
              </label>
              <input
                type="url"
                value={form.skill_hook_url}
                onChange={(e) => setForm({ ...form, skill_hook_url: e.target.value })}
                placeholder="https://example.com/skills-hook"
                className={INPUT_CLS}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Skill Hook Secret <span className="font-normal text-slate-400 dark:text-slate-600">(optional)</span>
              </label>
              <input
                type="password"
                value={form.skill_hook_secret}
                onChange={(e) => setForm({ ...form, skill_hook_secret: e.target.value })}
                placeholder="HMAC signing secret"
                className={INPUT_CLS}
              />
            </div>
          </div>
```

- [ ] **Step 7: Standardise label class on all AgentsView labels**

All `<label>` elements in the form must use:
```
className="text-xs font-medium text-slate-500 dark:text-slate-400"
```

Check lines 278, 288, 304, 316 (Name, Provider, Persona, Rules labels) — they currently use `"text-xs text-slate-400"`. Update them all.

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd ui
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add ui/src/views/AgentsView.tsx
git commit -m "feat(ui5): rename config hook to skill hook; add attach/detach loading feedback"
```

---

## Task 3: SkillsView — system skills tab + design polish

**Files:**
- Modify: `ui/src/views/SkillsView.tsx`

**Changes:** Add a "User-Defined" / "System" tab switcher. System tab shows read-only cards from `GET /api/skills/system`. Fix submit button (missing hover scale). Fix label font-weight.

- [ ] **Step 1: Add imports and state**

At the top of `SkillsView.tsx`, update the import line:

```typescript
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Skill, SystemSkill } from '../api/client';
```

After the existing `useState` declarations, add:

```typescript
  type Tab = 'user' | 'system';
  const [activeTab, setActiveTab] = useState<Tab>('user');
  const [systemSkills, setSystemSkills] = useState<SystemSkill[]>([]);
  const [systemLoading, setSystemLoading] = useState(false);
```

- [ ] **Step 2: Load system skills when the System tab is activated**

After the existing `useEffect` that calls `load()`, add:

```typescript
  useEffect(() => {
    if (activeTab === 'system') {
      setSystemLoading(true);
      void api.listSystemSkills()
        .then(setSystemSkills)
        .catch(() => setSystemSkills([]))
        .finally(() => setSystemLoading(false));
    }
  }, [activeTab]);
```

- [ ] **Step 3: Add the tab bar to the JSX, immediately after the `<h2>` heading**

Replace:
```tsx
      <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-200 tracking-tight">Skills</h2>

      {/* List */}
```

With:
```tsx
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-200 tracking-tight">Skills</h2>
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-white/5 rounded-xl">
          {(['user', 'system'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {tab === 'user' ? 'User-Defined' : 'System'}
            </button>
          ))}
        </div>
      </div>

      {/* User-Defined list */}
```

- [ ] **Step 4: Wrap the existing user-defined list in a conditional**

Wrap the existing `{/* List */}` block and everything up to `{error !== null && ...}` in:

```tsx
      {activeTab === 'user' && (
        <>
          {/* existing user-defined list div */}
          {/* existing error paragraph */}
          {/* existing create/edit form div */}
        </>
      )}
```

- [ ] **Step 5: Add the System tab panel after the conditional**

After the closing `)}` of the `activeTab === 'user'` block, add:

```tsx
      {activeTab === 'system' && (
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
          {systemLoading ? (
            <p className="p-8 text-slate-500 dark:text-slate-400 text-sm text-center">
              Loading system skills…
            </p>
          ) : systemSkills.length === 0 ? (
            <p className="p-8 text-slate-500 dark:text-slate-400 text-sm text-center">
              No system skills found. Add{' '}
              <code className="bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded-md font-mono">
                SKILL.md
              </code>{' '}
              files under{' '}
              <code className="bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded-md font-mono">
                .agents/skills/
              </code>
              .
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {systemSkills.map((skill) => (
                <li key={skill.name} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 dark:text-slate-200 truncate">
                          {skill.name}
                        </p>
                        <span
                          className={`shrink-0 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                            skill.skill_type === 'instruction'
                              ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                              : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                          }`}
                        >
                          {skill.skill_type}
                        </span>
                        <span className="shrink-0 text-[10px] font-mono text-slate-400 dark:text-slate-500">
                          v{skill.version}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {skill.description}
                      </p>
                      {skill.allowed_tools.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {skill.allowed_tools.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] font-mono bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] italic text-slate-400 dark:text-slate-500 pt-1">
                      read-only
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
```

- [ ] **Step 6: Fix the submit button — add hover/active scale**

Find the submit button in the form (currently around line 215):

```tsx
              className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
```

Replace with:

```tsx
              className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd ui
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add ui/src/views/SkillsView.tsx
git commit -m "feat(ui5): add system skills tab to SkillsView; polish submit button and labels"
```

---

## Task 4: ProvidersView — fix dark-mode-only select

**Files:**
- Modify: `ui/src/views/ProvidersView.tsx`

**Problem:** The Provider Type `<select>` (around line 180) uses `bg-black/40 border-white/10 text-slate-200` with no light-mode fallback, making it invisible in light theme.

- [ ] **Step 1: Find the broken select**

The broken className is:
```
"w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
```

- [ ] **Step 2: Replace with the standard pattern used by all other inputs**

```tsx
              className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm"
```

- [ ] **Step 3: Standardise all label classes in ProvidersView**

The labels in ProvidersView use `"text-xs text-slate-400"`. Update all `<label>` elements in the form to the standard:

```
className="text-xs font-medium text-slate-500 dark:text-slate-400"
```

Check: Name (line ~153), Model (line ~162), Provider Type (line ~174), API Key (line ~190), Base URL (line ~204) — update any that are missing `font-medium` or use `dark:text-slate-400` without the light-mode `text-slate-500`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd ui
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add ui/src/views/ProvidersView.tsx
git commit -m "fix(ui5): restore light-mode styling on provider type select; standardise labels"
```

---

## Task 5: Design consistency pass (RoutingRulesView + error tokens)

**Files:**
- Modify: `ui/src/views/RoutingRulesView.tsx`
- Modify: `ui/src/views/SkillsView.tsx` (error message already handled in Task 3 — verify)
- Modify: `ui/src/views/ChatView.tsx` (if error uses `text-rose-500`)
- Modify: `ui/src/views/SystemView.tsx` (if error uses `text-rose-500`)

**Standard tokens:**
- Error messages: `className="text-rose-400 text-sm"`
- Submit button: `className="... hover:scale-[1.01] active:scale-[0.99] disabled:hover:scale-100"`
- Readonly field: replace `opacity-60` with explicit muted text colour

- [ ] **Step 1: Fix RoutingRulesView submit button (line ~280)**

Current:
```tsx
              className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
```

Replace with:
```tsx
              className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
```

- [ ] **Step 2: Fix RoutingRulesView readonly supervisor field (line ~201)**

Current:
```tsx
              <div className={`${INPUT_CLS} opacity-60 cursor-not-allowed`}>
```

Replace with:
```tsx
              <div className={`${INPUT_CLS} cursor-not-allowed !text-slate-400 dark:!text-slate-500`}>
```

This uses explicit colour instead of inherited opacity, ensuring WCAG AA contrast in both modes.

- [ ] **Step 3: Fix RoutingRulesView error message (line ~179)**

Current: `<p className="text-rose-500 text-sm">`

Replace: `<p className="text-rose-400 text-sm">`

- [ ] **Step 4: Fix SkillsView error message (line ~154) — confirm from Task 3**

Current: `<p className="text-rose-500 text-sm">`

Replace: `<p className="text-rose-400 text-sm">`

(May already be fixed in Task 3 — check before editing.)

- [ ] **Step 5: Audit ChatView and SystemView error messages**

Search both files for `text-rose-` and ensure all error paragraphs use `text-rose-400 text-sm`. If any use `text-rose-500` or `text-xs`, update them.

In `ChatView.tsx` look for the error render (around line 157):
```tsx
{error && <p className="text-rose-400 text-xs">{error}</p>}
```
Update `text-xs` → `text-sm`:
```tsx
{error && <p className="text-rose-400 text-sm">{error}</p>}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd ui
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add ui/src/views/RoutingRulesView.tsx ui/src/views/ChatView.tsx ui/src/views/SystemView.tsx ui/src/views/SkillsView.tsx
git commit -m "fix(ui5): standardise error tokens, submit button hover scale, readonly field contrast"
```

---

## Task 6: Update ROADMAP.md and create plan record

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Tick remaining UI-5 checklist items in ROADMAP.md**

Find the `## Phase UI-5` section and update the three remaining unchecked items:

```markdown
## Phase UI-5 — UI Polish and Aesthetics

- [x] Establish `FRONTEND_DESIGN_CONVENTIONS.md` following modern, elegant, minimalistic principles
- [x] Create `frontend-design` skill to ensure AI adherence to UI standards
- [x] Refactor and polish existing `ChatView`, `ProvidersView`, and `AgentsView` components using the new conventions
- [x] Ensure full dark and light mode compatibility with glassmorphism touches
- [x] Add staggered load animations and refined hover micro-interactions
- [x] Complete UI consistency review
```

- [ ] **Step 2: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: mark Phase UI-5 complete in roadmap"
```

---

## Final verification

- [ ] **TypeScript compile check**

```bash
cd ui
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Visual check list (manual)**

Start the dev server (`cd ui && npm run dev`) and verify:
1. **Light mode** — ProvidersView: "Provider Type" dropdown has a visible background
2. **AgentsView form** — shows "Skill Hook URL" and "Skill Hook Secret" fields (not "Config Hook")
3. **AgentsView skill panel** — "Detach" button shows "Removing…" during async; attach dropdown shows "Attaching…" when busy
4. **SkillsView** — "User-Defined" and "System" tabs visible; "System" tab shows read-only cards (requires `.agents/skills/` entries) or empty state
5. **All views** — error messages are the same colour and size
6. **SkillsView + RoutingRulesView** — submit buttons scale on hover
