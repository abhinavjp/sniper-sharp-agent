# Phase UI-3: SkillsView + RoutingRulesView Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two remaining stub views — SkillsView and RoutingRulesView — with fully functional CRUD interfaces, following the established design system.

**Architecture:** Each view is a self-contained component: a read-only list panel on top, a create/edit form below that toggles between create and edit mode when the user clicks Edit on a list item. Pattern is identical to ProvidersView and AgentsView from Phase UI-2. RoutingRulesView additionally loads the agents list to populate supervisor/target pickers and sorts rules by `priority` on the client.

**Tech Stack:** React 19, TypeScript 5.9 (strict, verbatimModuleSyntax), Tailwind CSS 4 with design system from `docs/FRONTEND_DESIGN_CONVENTIONS.md` — dark/light mode via `dark:` variants, `animate-fade-in-up`, Inter font. All 10 backend endpoints are live; API client wrappers already exist in `ui/src/api/client.ts`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `ui/src/views/SkillsView.tsx` | Replace stub (10 lines) | Skills CRUD — list, create form, edit mode, delete |
| `ui/src/views/RoutingRulesView.tsx` | Replace stub (10 lines) | Routing rules CRUD — list sorted by priority, create form, edit mode (no supervisor change), delete |

No other files need touching. The API client and types are already complete.

---

## Design System Reference

Follow these patterns from the existing views (ProvidersView / AgentsView). Do not deviate.

**Card list container:**
```tsx
<div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
```

**List item row:**
```tsx
<li className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
```

**Form container:**
```tsx
<div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-none animate-fade-in-up">
```

**Input field class (reuse as `INPUT_CLS` constant):**
```tsx
'w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm'
```

**Code textarea class (reuse as `TEXTAREA_CLS` constant):**
```tsx
'w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono text-sm resize-y shadow-sm'
```

**Submit button:**
```tsx
<button type="submit" disabled={saving}
  className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50">
```

**Edit button:**
```tsx
className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
```

**Delete button:**
```tsx
className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 px-3 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
```

---

## Task 1: SkillsView — full CRUD

**Files:**
- Replace: `ui/src/views/SkillsView.tsx`

**What's being built:** A skills manager with a list showing name, description snippet, and a preview of the implementation code. Edit button populates the form. The implementation field is a tall monospace textarea where the user writes the Python body of a sandboxed function receiving `input: dict`.

**Backend contract:**
- `GET /api/skills` → `Skill[]`
- `POST /api/skills` body: `{ name, description, implementation, input_schema? }` — if `input_schema` is omitted, send `{}`
- `PUT /api/skills/:id` body: `Partial<{ name, description, implementation, input_schema }>` — all optional
- `DELETE /api/skills/:id`

- [ ] **Step 1: Write the full SkillsView component**

Replace all contents of `ui/src/views/SkillsView.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Skill } from '../api/client';

interface FormState {
  name: string;
  description: string;
  implementation: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  implementation: '',
};

const INPUT_CLS =
  'w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm';

const TEXTAREA_CLS =
  'w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono text-sm resize-y shadow-sm';

export default function SkillsView() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    void api.listSkills().then(setSkills).catch(() => setSkills([]));
  };

  useEffect(() => {
    load();
  }, []);

  const handleEdit = (skill: Skill) => {
    setEditingId(skill.id);
    setForm({
      name: skill.name,
      description: skill.description,
      implementation: skill.implementation,
    });
    setError(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId !== null) {
        await api.updateSkill(editingId, {
          name: form.name,
          description: form.description,
          implementation: form.implementation,
        });
        setEditingId(null);
      } else {
        await api.createSkill({
          name: form.name,
          description: form.description,
          implementation: form.implementation,
          input_schema: {},
        });
      }
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete skill "${name}"?`)) return;
    setError(null);
    try {
      await api.deleteSkill(id);
      if (editingId === id) handleCancel();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const isEditing = editingId !== null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-200 tracking-tight">Skills</h2>

      {/* List */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
        {skills.length === 0 ? (
          <p className="p-8 text-slate-500 dark:text-slate-400 text-sm text-center">
            No skills yet. Run{' '}
            <code className="bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded-md font-mono">
              python seed.py
            </code>{' '}
            or create one below.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {skills.map((skill) => (
              <li
                key={skill.id}
                className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-200 truncate">
                      {skill.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {skill.description}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-600 mt-1 font-mono truncate">
                      {skill.implementation.slice(0, 80)}
                      {skill.implementation.length > 80 ? '…' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleEdit(skill)}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        void handleDelete(skill.id, skill.name);
                      }}
                      className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 px-3 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error !== null && <p className="text-rose-500 text-sm">{error}</p>}

      {/* Create / Edit form */}
      <div
        className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-none animate-fade-in-up"
        style={{ animationDelay: '0.1s' }}
      >
        <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-6">
          {isEditing ? 'Edit Skill' : 'Add Skill'}
        </h3>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. classify_email"
                className={INPUT_CLS}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Description
              </label>
              <input
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What this skill does"
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Implementation{' '}
              <span className="normal-case font-normal text-slate-400 dark:text-slate-600">
                — Python body; receives{' '}
                <code className="bg-slate-100 dark:bg-white/10 px-1 rounded">input: dict</code>,
                must return a value
              </span>
            </label>
            <textarea
              required
              rows={10}
              value={form.implementation}
              onChange={(e) => setForm({ ...form, implementation: e.target.value })}
              placeholder={'# input is a dict passed by the agent\ntext = input.get("text", "")\nreturn {"output": text.upper()}'}
              className={TEXTAREA_CLS}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Skill'}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd D:/Projects/sniper-sharp-agent/ui && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd D:/Projects/sniper-sharp-agent
git add ui/src/views/SkillsView.tsx
git commit -m "feat(ui): SkillsView — list, create, edit, delete with code textarea"
```

---

## Task 2: RoutingRulesView — full CRUD

**Files:**
- Replace: `ui/src/views/RoutingRulesView.tsx`

**What's being built:** A routing rules manager. Rules are displayed sorted by `priority` (ascending). Each rule shows the intent label, supervisor name, target agent name, and priority number. The create form has four fields: supervisor select (supervisor agents only), intent label text, target agent select (non-supervisor agents), and priority number. The edit form locks the supervisor (cannot be changed after creation — the backend `PUT` endpoint does not accept `supervisor_id`) and shows it as read-only text. Both agents list and routing rules list are loaded on mount.

**Backend contract:**
- `GET /api/routing-rules` → `RoutingRule[]` (unsorted — sort client-side by `priority`)
- `GET /api/agents` → `Agent[]` (used to resolve names and filter supervisors vs specialists)
- `POST /api/routing-rules` body: `{ supervisor_id, intent_label, target_agent_id, priority }`
- `PUT /api/routing-rules/:id` body: `Partial<{ intent_label, target_agent_id, priority }>` — **no `supervisor_id`**
- `DELETE /api/routing-rules/:id`

**Key types (from `ui/src/api/client.ts`):**
```typescript
interface RoutingRule {
  id: string;
  supervisor_id: string;
  intent_label: string;
  target_agent_id: string;
  priority: number;
  created_at: string;
}
interface Agent {
  id: string; name: string; is_supervisor: boolean;
  // ...other fields not used here
}
```

- [ ] **Step 1: Write the full RoutingRulesView component**

Replace all contents of `ui/src/views/RoutingRulesView.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Agent, RoutingRule } from '../api/client';

interface FormState {
  supervisor_id: string;
  intent_label: string;
  target_agent_id: string;
  priority: string;
}

const EMPTY_FORM: FormState = {
  supervisor_id: '',
  intent_label: '',
  target_agent_id: '',
  priority: '0',
};

const INPUT_CLS =
  'w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm';

export default function RoutingRulesView() {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    void api
      .listRoutingRules()
      .then((list) => setRules([...list].sort((a, b) => a.priority - b.priority)))
      .catch(() => setRules([]));
  };

  useEffect(() => {
    load();
    void api.listAgents().then(setAgents).catch(() => setAgents([]));
  }, []);

  const supervisors = agents.filter((a) => a.is_supervisor);
  const specialists = agents.filter((a) => !a.is_supervisor);

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? id;

  const handleEdit = (rule: RoutingRule) => {
    setEditingId(rule.id);
    setForm({
      supervisor_id: rule.supervisor_id,
      intent_label: rule.intent_label,
      target_agent_id: rule.target_agent_id,
      priority: String(rule.priority),
    });
    setError(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const priority = parseInt(form.priority, 10);
      if (editingId !== null) {
        await api.updateRoutingRule(editingId, {
          intent_label: form.intent_label,
          target_agent_id: form.target_agent_id,
          priority,
        });
        setEditingId(null);
      } else {
        await api.createRoutingRule({
          supervisor_id: form.supervisor_id,
          intent_label: form.intent_label,
          target_agent_id: form.target_agent_id,
          priority,
        });
      }
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Delete routing rule "${label}"?`)) return;
    setError(null);
    try {
      await api.deleteRoutingRule(id);
      if (editingId === id) handleCancel();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const isEditing = editingId !== null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-200 tracking-tight">
        Routing Rules
      </h2>

      {/* List */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
        {rules.length === 0 ? (
          <p className="p-8 text-slate-500 dark:text-slate-400 text-sm text-center">
            No routing rules yet. Run{' '}
            <code className="bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded-md font-mono">
              python seed.py
            </code>{' '}
            or create one below.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="shrink-0 w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {rule.priority}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-200 font-mono text-sm">
                          {rule.intent_label}
                        </span>
                        <span className="text-slate-400 dark:text-slate-600 text-xs">→</span>
                        <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                          {agentName(rule.target_agent_id)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-600 mt-0.5 truncate">
                        Supervisor: {agentName(rule.supervisor_id)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleEdit(rule)}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        void handleDelete(rule.id, rule.intent_label);
                      }}
                      className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 px-3 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error !== null && <p className="text-rose-500 text-sm">{error}</p>}

      {/* Create / Edit form */}
      <div
        className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-none animate-fade-in-up"
        style={{ animationDelay: '0.1s' }}
      >
        <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-6">
          {isEditing ? 'Edit Rule' : 'Add Rule'}
        </h3>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4"
        >
          {/* Supervisor — select in create mode, read-only label in edit mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Supervisor Agent
            </label>
            {isEditing ? (
              <div className={`${INPUT_CLS} opacity-60 cursor-not-allowed`}>
                {agentName(form.supervisor_id)}
              </div>
            ) : (
              <select
                required
                value={form.supervisor_id}
                onChange={(e) => setForm({ ...form, supervisor_id: e.target.value })}
                className={INPUT_CLS}
              >
                <option value="">— select a supervisor —</option>
                {supervisors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
            {isEditing && (
              <p className="text-xs text-slate-400 dark:text-slate-600">
                Supervisor cannot be changed after creation.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Intent Label
              </label>
              <input
                required
                value={form.intent_label}
                onChange={(e) => setForm({ ...form, intent_label: e.target.value })}
                placeholder="e.g. PAYROLL or FALLBACK"
                className={INPUT_CLS}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Priority{' '}
                <span className="normal-case font-normal text-slate-400 dark:text-slate-600">
                  (lower = higher priority)
                </span>
              </label>
              <input
                required
                type="number"
                min={0}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Target Agent
            </label>
            <select
              required
              value={form.target_agent_id}
              onChange={(e) => setForm({ ...form, target_agent_id: e.target.value })}
              className={INPUT_CLS}
            >
              <option value="">— select a target agent —</option>
              {specialists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Rule'}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd D:/Projects/sniper-sharp-agent/ui && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd D:/Projects/sniper-sharp-agent
git add ui/src/views/RoutingRulesView.tsx
git commit -m "feat(ui): RoutingRulesView — list sorted by priority, create, edit, delete"
```

---

## Self-Review

**Spec coverage check:**

| Roadmap item | Covered by |
|---|---|
| `SkillsView`: list all skills, create/edit form with Python code textarea, delete | Task 1 |
| `RoutingRulesView`: list rules ordered by priority, create/edit form, delete | Task 2 |
| Priority numeric input | Task 2 — `<input type="number" min={0}>` |
| Supervisor picker (create only) | Task 2 — filters `agents.filter(a => a.is_supervisor)` |
| Target agent picker | Task 2 — filters `agents.filter(a => !a.is_supervisor)` |
| Design conventions (dark:, Inter, animate-fade-in-up) | Both tasks |

**Placeholder scan:** No TBDs, no "handle edge cases" without code. All code blocks complete.

**Type consistency check:**
- `FormState.priority` is `string` throughout — `parseInt(form.priority, 10)` on submit matches `RoutingRule.priority: number` ✅
- `api.updateRoutingRule` does NOT receive `supervisor_id` — handled by separate create/edit paths ✅
- `import type { Skill }` and `import type { Agent, RoutingRule }` — `verbatimModuleSyntax` compliant ✅
- `handleDelete` guards `editingId === id` before `handleCancel()` — mirrors Phase UI-2 pattern ✅
- Derived `supervisors` and `specialists` arrays computed from `agents` state — no extra state needed ✅

All clear.
