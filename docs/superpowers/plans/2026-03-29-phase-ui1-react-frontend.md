# Phase UI-1: React Frontend Foundation + Chat

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing React scaffold at `ui/` to the live FastAPI backend — typed API client, sidebar navigation, working provider management, and a fully functional chat interface.

**Architecture:** React Router v6 nested routes under a single `Layout` (sidebar + `<Outlet>`). A typed API client module (`ui/src/api/client.ts`) centralises all 27 backend calls. Views in `ui/src/views/`, shared components in `ui/src/components/`. No external component library — Tailwind CSS 4 only. The existing dark glassmorphism design language (indigo-950 gradient, white/5 glass cards, indigo/blue palette) is preserved throughout.

**Tech Stack:** React 19, Vite 8, TypeScript 5.9 (strict + `verbatimModuleSyntax`), Tailwind CSS 4, react-router-dom v7

---

## File Map

**Create:**
- `ui/src/api/client.ts` — typed fetch wrappers + TS interfaces for all 27 endpoints
- `ui/src/components/Layout.tsx` — sidebar + `<Outlet />` wrapper
- `ui/src/components/Sidebar.tsx` — nav links, `graph_compiled` health badge (polls every 10 s)
- `ui/src/views/ChatView.tsx` — agent select, session create, message thread, send
- `ui/src/views/ProvidersView.tsx` — provider list + create form + delete
- `ui/src/views/AgentsView.tsx` — stub ("Coming in Phase UI-2")
- `ui/src/views/SkillsView.tsx` — stub ("Coming in Phase UI-3")
- `ui/src/views/RoutingRulesView.tsx` — stub ("Coming in Phase UI-3")
- `ui/src/views/SystemView.tsx` — stub ("Coming in Phase UI-4")

**Modify:**
- `ui/vite.config.ts` — add `server.proxy` to forward `/api` → `http://localhost:8000`
- `ui/src/App.tsx` — replace with BrowserRouter + Routes + Layout
- `ui/package.json` — add `react-router-dom`

---

## Task 1: API Client + Vite Proxy

**Files:**
- Create: `ui/src/api/client.ts`
- Modify: `ui/vite.config.ts`

- [x] **Step 1: Update `ui/vite.config.ts`**

Read the file first, then overwrite entirely:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

- [x] **Step 2: Install react-router-dom**

```bash
cd D:/Projects/sniper-sharp-agent/ui
npm install react-router-dom
```

Expected: `react-router-dom` appears in `dependencies` in `package.json`. No errors.

- [x] **Step 3: Create `ui/src/api/client.ts`**

```typescript
// ─── Types ───────────────────────────────────────────────────────────────────

export type ProviderType =
  | 'anthropic-api-key'
  | 'anthropic-setup-auth'
  | 'openai-api-key'
  | 'openai-codex-oauth'
  | 'google-api-key'
  | 'custom-url';

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  model: string;
  credentials: Record<string, string>;
  created_at: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  implementation: string;
  input_schema: Record<string, unknown> | null;
  created_at: string;
}

export interface Agent {
  id: string;
  name: string;
  persona: string;
  rules: string | null;
  provider_id: string;
  is_supervisor: boolean;
  memory_enabled: boolean;
  config_hook_url: string | null;
  config_hook_secret: string | null;
  created_at: string;
  skills: Skill[];
}

export interface RoutingRule {
  id: string;
  supervisor_id: string;
  intent_label: string;
  target_agent_id: string;
  priority: number;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  agent_id: string;
  history: Array<{ role: string; content: string }>;
  created_at: string;
}

export interface ChatResponse {
  response: string;
  session_id: string;
  intent: string | null;
  turn_count: number;
}

export interface HealthResponse {
  status: string;
  graph_compiled: boolean;
}

export interface GraphStatusResponse {
  agent_count: number;
  skill_count: number;
  routing_rule_count: number;
}

// ─── HTTP Helpers ─────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  const data: unknown = await res.json();
  return data as T;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${detail}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  const data: unknown = await res.json();
  return data as T;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`);
  const data: unknown = await res.json();
  return data as T;
}

async function del(path: string): Promise<void> {
  const res = await fetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`);
}

// ─── API Surface ──────────────────────────────────────────────────────────────

export const api = {
  // System
  health: () => get<HealthResponse>('/api/health'),
  graphStatus: () => get<GraphStatusResponse>('/api/graph/status'),
  graphRebuild: () => post<void>('/api/graph/rebuild'),

  // Providers
  listProviders: () => get<Provider[]>('/api/providers'),
  createProvider: (body: {
    name: string;
    type: ProviderType;
    model: string;
    credentials: Record<string, string>;
  }) => post<Provider>('/api/providers', body),
  getProvider: (id: string) => get<Provider>(`/api/providers/${id}`),
  updateProvider: (
    id: string,
    body: Partial<{ name: string; type: ProviderType; model: string; credentials: Record<string, string> }>,
  ) => put<Provider>(`/api/providers/${id}`, body),
  deleteProvider: (id: string) => del(`/api/providers/${id}`),

  // Agents
  listAgents: () => get<Agent[]>('/api/agents'),
  createAgent: (body: {
    name: string;
    persona: string;
    provider_id: string;
    is_supervisor?: boolean;
    rules?: string;
    memory_enabled?: boolean;
    config_hook_url?: string;
    config_hook_secret?: string;
  }) => post<Agent>('/api/agents', body),
  getAgent: (id: string) => get<Agent>(`/api/agents/${id}`),
  updateAgent: (
    id: string,
    body: Partial<{
      name: string;
      persona: string;
      provider_id: string;
      is_supervisor: boolean;
      rules: string;
      memory_enabled: boolean;
      config_hook_url: string;
      config_hook_secret: string;
    }>,
  ) => put<Agent>(`/api/agents/${id}`, body),
  deleteAgent: (id: string) => del(`/api/agents/${id}`),
  attachSkill: (agentId: string, skillId: string) =>
    post<void>(`/api/agents/${agentId}/skills/${skillId}`),
  detachSkill: (agentId: string, skillId: string) =>
    del(`/api/agents/${agentId}/skills/${skillId}`),

  // Skills
  listSkills: () => get<Skill[]>('/api/skills'),
  createSkill: (body: {
    name: string;
    description: string;
    implementation: string;
    input_schema?: Record<string, unknown>;
  }) => post<Skill>('/api/skills', body),
  getSkill: (id: string) => get<Skill>(`/api/skills/${id}`),
  updateSkill: (
    id: string,
    body: Partial<{
      name: string;
      description: string;
      implementation: string;
      input_schema: Record<string, unknown>;
    }>,
  ) => put<Skill>(`/api/skills/${id}`, body),
  deleteSkill: (id: string) => del(`/api/skills/${id}`),

  // Routing Rules
  listRoutingRules: () => get<RoutingRule[]>('/api/routing-rules'),
  createRoutingRule: (body: {
    supervisor_id: string;
    intent_label: string;
    target_agent_id: string;
    priority: number;
  }) => post<RoutingRule>('/api/routing-rules', body),
  updateRoutingRule: (
    id: string,
    body: Partial<{
      supervisor_id: string;
      intent_label: string;
      target_agent_id: string;
      priority: number;
    }>,
  ) => put<RoutingRule>(`/api/routing-rules/${id}`, body),
  deleteRoutingRule: (id: string) => del(`/api/routing-rules/${id}`),

  // Sessions
  createSession: (body: { user_id: string; agent_id: string }) =>
    post<Session>('/api/sessions', body),
  deleteSession: (id: string) => del(`/api/sessions/${id}`),

  // Chat
  chat: (body: { session_id: string; message: string }) =>
    post<ChatResponse>('/api/chat', body),
};
```

- [x] **Step 4: Verify build**

```bash
cd D:/Projects/sniper-sharp-agent/ui
npm run build
```

Expected: Build succeeds, no TypeScript errors. Exported symbols are never "unused" from the compiler's perspective.

- [x] **Step 5: Commit**

```bash
cd D:/Projects/sniper-sharp-agent
git add ui/vite.config.ts ui/src/api/client.ts ui/package.json ui/package-lock.json
git commit -m "feat(ui): typed API client for all 27 backend endpoints + Vite /api proxy"
```

---

## Task 2: Routing Scaffold + Layout

**Files:**
- Create: `ui/src/components/Sidebar.tsx`
- Create: `ui/src/components/Layout.tsx`
- Create: `ui/src/views/ChatView.tsx` (stub)
- Create: `ui/src/views/ProvidersView.tsx` (stub)
- Create: `ui/src/views/AgentsView.tsx` (stub)
- Create: `ui/src/views/SkillsView.tsx` (stub)
- Create: `ui/src/views/RoutingRulesView.tsx` (stub)
- Create: `ui/src/views/SystemView.tsx` (stub)
- Modify: `ui/src/App.tsx`

- [x] **Step 1: Create `ui/src/components/Sidebar.tsx`**

```tsx
import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { HealthResponse } from '../api/client';

const NAV_ITEMS = [
  { to: '/', label: 'Chat', icon: '💬' },
  { to: '/providers', label: 'Providers', icon: '🔌' },
  { to: '/agents', label: 'Agents', icon: '🤖' },
  { to: '/skills', label: 'Skills', icon: '🛠' },
  { to: '/routing-rules', label: 'Routing Rules', icon: '📐' },
  { to: '/system', label: 'System', icon: '⚙️' },
] as const;

export default function Sidebar() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    const check = () => {
      void api.health().then((h) => setHealth(h)).catch(() => setHealth(null));
    };
    check();
    const id = setInterval(check, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <aside className="w-56 flex flex-col bg-white/5 backdrop-blur-xl border-r border-white/10 shrink-0">
      <div className="px-5 py-5 border-b border-white/10">
        <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Sniper Sharp
        </h1>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-white/10">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              health?.graph_compiled ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <span className="text-slate-500 truncate">
            {health === null
              ? 'Connecting…'
              : health.graph_compiled
              ? 'Graph ready'
              : 'Graph not compiled'}
          </span>
        </div>
      </div>
    </aside>
  );
}
```

- [x] **Step 2: Create `ui/src/components/Layout.tsx`**

```tsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="flex h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-black text-slate-200 font-sans overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [x] **Step 3: Create stub views**

Create each file below exactly as shown.

**`ui/src/views/ChatView.tsx`** (temporary — replaced in Task 4):
```tsx
export default function ChatView() {
  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-200 mb-6">Chat</h2>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-slate-400 text-center">
        Coming next — Task 4
      </div>
    </div>
  );
}
```

**`ui/src/views/ProvidersView.tsx`** (temporary — replaced in Task 3):
```tsx
export default function ProvidersView() {
  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-200 mb-6">Providers</h2>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-slate-400 text-center">
        Coming next — Task 3
      </div>
    </div>
  );
}
```

**`ui/src/views/AgentsView.tsx`**:
```tsx
export default function AgentsView() {
  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-200 mb-6">Agents</h2>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-slate-400 text-center">
        Coming in Phase UI-2
      </div>
    </div>
  );
}
```

**`ui/src/views/SkillsView.tsx`**:
```tsx
export default function SkillsView() {
  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-200 mb-6">Skills</h2>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-slate-400 text-center">
        Coming in Phase UI-3
      </div>
    </div>
  );
}
```

**`ui/src/views/RoutingRulesView.tsx`**:
```tsx
export default function RoutingRulesView() {
  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-200 mb-6">Routing Rules</h2>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-slate-400 text-center">
        Coming in Phase UI-3
      </div>
    </div>
  );
}
```

**`ui/src/views/SystemView.tsx`**:
```tsx
export default function SystemView() {
  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-200 mb-6">System</h2>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-slate-400 text-center">
        Coming in Phase UI-4
      </div>
    </div>
  );
}
```

- [x] **Step 4: Replace `ui/src/App.tsx`**

Read the file first, then overwrite:

```tsx
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ChatView from './views/ChatView';
import ProvidersView from './views/ProvidersView';
import AgentsView from './views/AgentsView';
import SkillsView from './views/SkillsView';
import RoutingRulesView from './views/RoutingRulesView';
import SystemView from './views/SystemView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ChatView />} />
          <Route path="providers" element={<ProvidersView />} />
          <Route path="agents" element={<AgentsView />} />
          <Route path="skills" element={<SkillsView />} />
          <Route path="routing-rules" element={<RoutingRulesView />} />
          <Route path="system" element={<SystemView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

Note: `App.css` is no longer imported — leave the file in place, it has no effect.

- [x] **Step 5: Verify build**

```bash
cd D:/Projects/sniper-sharp-agent/ui
npm run build
```

Expected: Build succeeds, no TypeScript errors.

- [x] **Step 6: Commit**

```bash
cd D:/Projects/sniper-sharp-agent
git add ui/src/App.tsx ui/src/components/Layout.tsx ui/src/components/Sidebar.tsx \
        ui/src/views/ChatView.tsx ui/src/views/ProvidersView.tsx \
        ui/src/views/AgentsView.tsx ui/src/views/SkillsView.tsx \
        ui/src/views/RoutingRulesView.tsx ui/src/views/SystemView.tsx
git commit -m "feat(ui): routing scaffold — Layout, Sidebar with health badge, stub views"
```

---

## Task 3: ProvidersView

**Files:**
- Modify: `ui/src/views/ProvidersView.tsx` (replace stub)

- [x] **Step 1: Replace `ui/src/views/ProvidersView.tsx`**

Read the stub first, then overwrite:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Provider, ProviderType } from '../api/client';

const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  'anthropic-api-key': 'Anthropic — API Key',
  'anthropic-setup-auth': 'Anthropic — CLI Auth',
  'openai-api-key': 'OpenAI — API Key',
  'openai-codex-oauth': 'OpenAI — Codex OAuth',
  'google-api-key': 'Google — API Key',
  'custom-url': 'Custom URL',
};

const ALL_TYPES = Object.keys(PROVIDER_TYPE_LABELS) as ProviderType[];
const NEEDS_API_KEY: ProviderType[] = ['anthropic-api-key', 'openai-api-key', 'google-api-key'];
const NEEDS_URL: ProviderType[] = ['custom-url'];
const NO_CREDENTIALS: ProviderType[] = ['anthropic-setup-auth', 'openai-codex-oauth'];

interface FormState {
  name: string;
  type: ProviderType;
  model: string;
  apiKey: string;
  baseUrl: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  type: 'anthropic-api-key',
  model: 'claude-opus-4-6',
  apiKey: '',
  baseUrl: '',
};

export default function ProvidersView() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    void api.listProviders().then((list) => setProviders(list)).catch(() => setProviders([]));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const credentials: Record<string, string> = {};
      if (NEEDS_API_KEY.includes(form.type)) credentials['api_key'] = form.apiKey;
      if (NEEDS_URL.includes(form.type)) credentials['base_url'] = form.baseUrl;
      await api.createProvider({ name: form.name, type: form.type, model: form.model, credentials });
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create provider');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this provider?')) return;
    setError(null);
    try {
      await api.deleteProvider(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete provider');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold text-slate-200">Providers</h2>

      {/* List */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {providers.length === 0 ? (
          <p className="p-6 text-slate-500 text-sm text-center">No providers configured yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {providers.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-medium text-slate-200">{p.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {PROVIDER_TYPE_LABELS[p.type]} · {p.model}
                  </p>
                </div>
                <button
                  onClick={() => { void handleDelete(p.id); }}
                  className="text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Create form */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider mb-5">
          Add Provider
        </h3>
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Display Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. My Anthropic"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Model</label>
              <input
                required
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="claude-opus-4-6"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Provider Type</label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as ProviderType, apiKey: '', baseUrl: '' })
              }
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            >
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>{PROVIDER_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {NEEDS_API_KEY.includes(form.type) && (
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">API Key</label>
              <input
                type="password"
                required
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>
          )}

          {NEEDS_URL.includes(form.type) && (
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Base URL</label>
              <input
                type="url"
                required
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="http://localhost:11434/v1"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>
          )}

          {NO_CREDENTIALS.includes(form.type) && (
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-sm flex items-start gap-3">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>No key required — credentials are read from your local environment.</span>
            </div>
          )}

          {error !== null && <p className="text-rose-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-blue-900/40 transition-all disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add Provider'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [x] **Step 2: Verify build**

```bash
cd D:/Projects/sniper-sharp-agent/ui
npm run build
```

Expected: Build succeeds, no TypeScript errors.

- [x] **Step 3: Commit**

```bash
cd D:/Projects/sniper-sharp-agent
git add ui/src/views/ProvidersView.tsx
git commit -m "feat(ui): ProvidersView — list + create + delete wired to /api/providers"
```

---

## Task 4: ChatView

**Files:**
- Modify: `ui/src/views/ChatView.tsx` (replace stub)

- [x] **Step 1: Replace `ui/src/views/ChatView.tsx`**

Read the stub first, then overwrite:

```tsx
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Agent, Session } from '../api/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  intent?: string | null;
}

export default function ChatView() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api
      .listAgents()
      .then((list) => {
        setAgents(list);
        const first = list[0];
        if (first !== undefined) setSelectedAgentId(first.id);
      })
      .catch(() => setAgents([]));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewSession = async () => {
    if (!selectedAgentId) return;
    setError(null);
    try {
      const s = await api.createSession({ user_id: 'local-user', agent_id: selectedAgentId });
      setSession(s);
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    const currentSession = session;
    if (!text || currentSession === null || sending) return;
    setInput('');
    setSending(true);
    setError(null);
    setMessages((prev) => [...prev, { role: 'user' as const, content: text }]);
    try {
      const res = await api.chat({ session_id: currentSession.id, message: text });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant' as const, content: res.response, intent: res.intent },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat request failed');
      setMessages((prev) => prev.slice(0, -1)); // remove optimistic user message
    } finally {
      setSending(false);
    }
  };

  const turnCount = messages.filter((m) => m.role === 'user').length;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            {agents.length === 0 && (
              <option value="">No agents — run python seed.py first</option>
            )}
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}{a.is_supervisor ? ' ★' : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => { void handleNewSession(); }}
            disabled={!selectedAgentId}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-40"
          >
            New Session
          </button>
        </div>
        {session !== null && (
          <span className="text-xs text-slate-500">
            {turnCount} turn{turnCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4 min-h-0">
        {session === null && (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm text-center p-8">
            Select an agent and press{' '}
            <span className="mx-1 px-2 py-0.5 bg-white/10 rounded text-slate-400 font-mono text-xs">
              New Session
            </span>{' '}
            to start chatting.
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-3 border ${
                msg.role === 'user'
                  ? 'bg-indigo-600/40 border-indigo-500/30'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </p>
              {msg.role === 'assistant' && msg.intent != null && msg.intent !== '' && (
                <span className="mt-2 inline-block text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  {msg.intent}
                </span>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
              <span className="text-slate-500 text-sm">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error !== null && (
        <p className="text-rose-400 text-xs mt-2 shrink-0">{error}</p>
      )}

      {/* Input */}
      <div className="mt-3 flex gap-2 shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          disabled={session === null || sending}
          placeholder={session !== null ? 'Type a message… (Enter to send)' : 'Create a session first'}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-40 transition-all"
        />
        <button
          onClick={() => { void handleSend(); }}
          disabled={session === null || !input.trim() || sending}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium transition-all disabled:opacity-40 shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

- [x] **Step 2: Verify build**

```bash
cd D:/Projects/sniper-sharp-agent/ui
npm run build
```

Expected: Build succeeds, no TypeScript errors.

- [x] **Step 3: Commit**

```bash
cd D:/Projects/sniper-sharp-agent
git add ui/src/views/ChatView.tsx
git commit -m "feat(ui): ChatView — agent select, session create, message thread, intent badges"
```

---

## Manual Smoke Test (after all 4 tasks)

```bash
# Terminal 1 — start backend (seed first if not done)
cd D:/Projects/sniper-sharp-agent/backend
python seed.py
uvicorn main:app --reload --port 8000

# Terminal 2 — start frontend
cd D:/Projects/sniper-sharp-agent/ui
npm run dev
```

Open `http://localhost:5173` in a browser.

**Verify:**
1. Sidebar shows "Graph ready" (green dot) within 10 s — confirms `/api/health` is reachable via proxy
2. Navigate to `/providers` — "No providers configured yet" shown (or seeded provider list)
3. Add a provider with name "Test", type "Anthropic — CLI Auth", model "claude-opus-4-6" → appears in list
4. Navigate to `/` (Chat) — agent dropdown shows `EmailClassifier ★` and `PayrollWorker`
5. Select `EmailClassifier ★`, press "New Session" — turn counter appears (0 turns)
6. Type "Hello" and press Enter — message appears in thread, response loads from backend
7. Intent badge appears on assistant bubble (e.g. `FALLBACK`)
